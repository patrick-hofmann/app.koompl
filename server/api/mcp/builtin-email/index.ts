/**
 * Builtin Email MCP Server Endpoint
 *
 * Allows agents to reply to and forward emails via Mailgun.
 * All emails must reference an existing email in storage by message-id.
 * Recipients must be either in the team domain or be team members.
 */

import {
  defineEventHandler,
  getRequestHeaders,
  readBody,
  setResponseHeader,
  setResponseStatus,
  createError
} from 'h3'
import type { H3Event } from 'h3'

interface JsonRpcRequest {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: {
    name?: string
    arguments?: Record<string, unknown>
  }
}

function resolveJsonRpcId(id: unknown): string | number {
  if (typeof id === 'string' || typeof id === 'number') {
    return id
  }
  return '0'
}

function formatJson(content: unknown): string {
  return JSON.stringify(content, null, 2)
}

function applyCors(event: H3Event) {
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
  setResponseHeader(event, 'Access-Control-Allow-Headers', '*')
}

async function parseAttachments(
  args: Record<string, unknown>,
  teamId: string,
  userId: string
): Promise<
  Array<{
    filename: string
    data: string
    encoding: 'base64'
    mimeType: string
    size: number
  }>
> {
  const attachments: Array<{
    filename: string
    data: string
    encoding: 'base64'
    mimeType: string
    size: number
  }> = []

  if (args.attachments && Array.isArray(args.attachments)) {
    for (const att of args.attachments) {
      if (att && typeof att === 'object') {
        const filename = String(att.filename || `attachment-${Date.now()}.bin`)
        let data = String(att.data || '')
        let mimeType = String(att.mimeType || 'application/octet-stream')
        let size = typeof att.size === 'number' ? att.size : 0

        // If datasafe_path is provided, fetch from datasafe server-side
        if (att.datasafe_path && typeof att.datasafe_path === 'string') {
          console.log(`[BuiltinEmailMCP] Fetching attachment from datasafe: ${att.datasafe_path}`)
          try {
            const { downloadDatasafeFile } = await import('../builtin-datasafe/operations')
            const { base64, node } = await downloadDatasafeFile(
              { teamId, userId, agentId: userId },
              att.datasafe_path
            )
            data = base64
            mimeType = node.mimeType || mimeType
            size = node.size || Buffer.from(base64, 'base64').length
            console.log(`[BuiltinEmailMCP] ✓ Fetched ${filename} from datasafe (${size} bytes)`)
          } catch (fetchError) {
            console.error(
              `[BuiltinEmailMCP] Failed to fetch from datasafe: ${att.datasafe_path}`,
              fetchError
            )
            continue // Skip this attachment
          }
        } else if (!data) {
          continue // No data and no datasafe_path, skip
        }

        if (!size) {
          size = Buffer.from(data, 'base64').length
        }

        if (data) {
          attachments.push({
            filename,
            data,
            encoding: 'base64' as const,
            mimeType,
            size
          })
        }
      }
    }
  }

  return attachments
}

export default defineEventHandler(async (event) => {
  applyCors(event)

  const method = event.node.req.method || 'GET'

  if (method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }

  if (method === 'GET') {
    return {
      ok: true,
      message: 'Builtin Email MCP endpoint. Send JSON-RPC 2.0 requests via POST.'
    }
  }

  if (method !== 'POST') {
    setResponseStatus(event, 405)
    return {
      error: true,
      message: `Unsupported method ${method}`
    }
  }

  // Authenticate the request (supports dev mode with bearer token or localhost)
  const { authenticateMcpRequest } = await import('../shared/auth')
  const { teamId, userId, isDevelopmentMode } = await authenticateMcpRequest(event)

  const headers = getRequestHeaders(event)
  const agentEmail = headers['x-agent-email']

  console.log('[BuiltinEmailMCP] Authenticated:', {
    teamId,
    userId,
    agentEmail,
    devMode: isDevelopmentMode
  })
  let session

  // Check if this is a webhook call (no cookies) or browser call (has cookies)
  const hasCookies = !!getRequestHeader(event, 'cookie')

  if (hasCookies) {
    // Browser call with cookies - validate session
    try {
      session = await getUserSession(event)
    } catch {
      session = null
    }

    if (session) {
      // Session exists - validate headers match session (browser-based call)
      if (session.team?.id !== teamId) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Team ID mismatch between session and header'
        })
      }

      if (session.user?.id !== userId) {
        throw createError({
          statusCode: 403,
          statusMessage: 'User ID mismatch between session and header'
        })
      }
      console.log('[BuiltinEmailMCP] Authenticated via session:', { teamId, userId })
    } else {
      // No valid session - fall through to header auth
      console.log('[BuiltinEmailMCP] No valid session, using header auth')
    }
  }

  if (!session) {
    // No session (webhook call) - trust headers (they're set by our own code)
    console.log('[BuiltinEmailMCP] Authenticated via headers (webhook):', {
      teamId,
      userId,
      hasCookies
    })
    session = {
      user: { id: userId, name: 'Agent User', email: 'agent@system' },
      team: { id: teamId, name: 'Team' }
    }
  }

  const body = (await readBody<JsonRpcRequest>(event)) || {}
  const requestId = resolveJsonRpcId(body.id)

  if (body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: -32600,
        message: 'Invalid JSON-RPC format'
      }
    }
  }

  try {
    let result: unknown

    switch (body.method) {
      case 'initialize': {
        console.log('[BuiltinEmailMCP] Method: initialize')
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'builtin-email-server',
            version: '1.0.0'
          }
        }
        break
      }

      case 'tools/list': {
        console.log('[BuiltinEmailMCP] Method: tools/list')
        result = {
          tools: [
            {
              name: 'reply_to_email',
              description:
                'Reply to an existing email by message-id. Automatically quotes the original email and sets proper threading headers. Recipients must be in the team domain or be team members. Supports attachments from datasafe.',
              inputSchema: {
                type: 'object',
                properties: {
                  message_id: {
                    type: 'string',
                    description: 'The message-id of the email to reply to'
                  },
                  reply_text: {
                    type: 'string',
                    description:
                      'Your reply text (original email will be automatically quoted below)'
                  },
                  from: {
                    type: 'string',
                    description: 'Optional sender email (defaults to agent email)'
                  },
                  attachments: {
                    type: 'array',
                    description:
                      'Optional attachments. Use datasafe_path (preferred) or data for small files.',
                    items: {
                      type: 'object',
                      properties: {
                        filename: {
                          type: 'string',
                          description: 'Name of the file'
                        },
                        datasafe_path: {
                          type: 'string',
                          description:
                            'Path to file in datasafe (PREFERRED - avoids token limits, fetched server-side)'
                        },
                        data: {
                          type: 'string',
                          description: 'Base64 encoded file content (only for small files <50KB)'
                        },
                        mimeType: {
                          type: 'string',
                          description: 'MIME type of the file'
                        },
                        size: {
                          type: 'number',
                          description: 'Size in bytes'
                        }
                      },
                      required: ['filename']
                    }
                  }
                },
                required: ['message_id', 'reply_text'],
                additionalProperties: false
              }
            },
            {
              name: 'forward_email',
              description:
                'Forward an existing email by message-id to another recipient. Automatically formats the email with forwarding headers. Recipients must be in the team domain or be team members. Supports attachments from datasafe.',
              inputSchema: {
                type: 'object',
                properties: {
                  message_id: {
                    type: 'string',
                    description: 'The message-id of the email to forward'
                  },
                  to: {
                    type: 'string',
                    description: 'Recipient email address (must be team domain or team member)'
                  },
                  forward_message: {
                    type: 'string',
                    description: 'Optional message to add before the forwarded email'
                  },
                  from: {
                    type: 'string',
                    description: 'Optional sender email (defaults to agent email)'
                  },
                  attachments: {
                    type: 'array',
                    description:
                      'Optional attachments. Use datasafe_path (preferred) or data for small files.',
                    items: {
                      type: 'object',
                      properties: {
                        filename: {
                          type: 'string',
                          description: 'Name of the file'
                        },
                        datasafe_path: {
                          type: 'string',
                          description:
                            'Path to file in datasafe (PREFERRED - avoids token limits, fetched server-side)'
                        },
                        data: {
                          type: 'string',
                          description: 'Base64 encoded file content (only for small files <50KB)'
                        },
                        mimeType: {
                          type: 'string',
                          description: 'MIME type of the file'
                        },
                        size: {
                          type: 'number',
                          description: 'Size in bytes'
                        }
                      },
                      required: ['filename']
                    }
                  }
                },
                required: ['message_id', 'to'],
                additionalProperties: false
              }
            }
          ]
        }
        break
      }

      case 'notifications/initialized': {
        // MCP protocol notification - acknowledge and continue
        result = { success: true }
        break
      }

      case 'tools/call': {
        const toolName = body.params?.name
        const args = body.params?.arguments || {}

        if (!toolName) {
          throw createError({ statusCode: 400, statusMessage: 'Tool name is required' })
        }

        console.log(`[BuiltinEmailMCP] Tool called: ${toolName}`, {
          args: Object.keys(args).reduce(
            (acc, key) => {
              // Truncate long data for logging
              if (key === 'reply_text' || key === 'forward_message') {
                const text = String(args[key] || '')
                acc[key] = text.length > 100 ? text.substring(0, 100) + '...' : text
              } else if (key === 'attachments' && Array.isArray(args[key])) {
                acc[key] = `${args[key].length} attachment(s)`
              } else {
                acc[key] = args[key]
              }
              return acc
            },
            {} as Record<string, unknown>
          )
        })

        // Get team and identity for validation
        const { getIdentity } = await import('../../../features/team/storage')
        const identity = await getIdentity()
        const team = identity.teams.find((t) => t.id === teamId)

        if (!team) {
          throw createError({ statusCode: 404, statusMessage: 'Team not found' })
        }

        const teamDomain = team.domain?.toLowerCase()
        const { extractEmail } = await import('../../../utils/mailgunHelpers')

        // Helper to validate recipient
        const validateRecipient = (email: string): { isAllowed: boolean; reason: string } => {
          const recipientEmail = extractEmail(email) || email
          const recipientDomain = recipientEmail.split('@')[1]?.toLowerCase()

          let isAllowed = false
          let reason = ''

          if (teamDomain && recipientDomain === teamDomain) {
            isAllowed = true
            reason = 'team domain'
          } else {
            // Check if recipient is a team member
            const teamMemberships = identity.memberships.filter((m) => m.teamId === teamId)
            const teamUserIds = teamMemberships.map((m) => m.userId)
            const teamMembers = identity.users.filter((u) => teamUserIds.includes(u.id))
            const isTeamMember = teamMembers.some(
              (u) => u.email.toLowerCase() === recipientEmail.toLowerCase()
            )

            if (isTeamMember) {
              isAllowed = true
              reason = 'team member'
            }
          }

          return { isAllowed, reason }
        }

        if (toolName === 'reply_to_email') {
          // Validate required fields
          if (!args.message_id || typeof args.message_id !== 'string') {
            throw createError({ statusCode: 400, statusMessage: 'message_id is required' })
          }
          if (!args.reply_text || typeof args.reply_text !== 'string') {
            throw createError({ statusCode: 400, statusMessage: 'reply_text is required' })
          }

          const messageId = String(args.message_id).trim()
          const replyText = String(args.reply_text)
          const from = args.from ? String(args.from) : undefined

          // Parse attachments if provided (fetches from datasafe if needed)
          const attachments = await parseAttachments(args, teamId, userId)

          console.log('[BuiltinEmailMCP] Replying to email:', {
            messageId,
            teamId,
            userId,
            attachmentCount: attachments.length
          })

          // Load the original email from storage
          const { mailStorage } = await import('../../../features/mail/storage')
          const storedEmail = await mailStorage.getEmailByMessageId(messageId)

          if (!storedEmail || storedEmail.type !== 'inbound') {
            throw createError({
              statusCode: 404,
              statusMessage: `Email not found in storage for message-id: ${messageId}. Can only reply to emails we have received.`
            })
          }

          const originalEmail = storedEmail.email

          // Reply to the sender of the original email
          const recipientEmail = extractEmail(originalEmail.from) || originalEmail.from
          const validation = validateRecipient(recipientEmail)

          if (!validation.isAllowed) {
            throw createError({
              statusCode: 403,
              statusMessage: `Email sending restricted: recipient must be in team domain (${teamDomain}) or be a team member`
            })
          }

          // Format reply with quoted original
          const originalDate = new Date(originalEmail.timestamp).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
          })
          const quotedBody = originalEmail.body
            .split(/\r?\n/)
            .map((line) => `> ${line}`)
            .join('\n')

          const formattedReply = `${replyText}

On ${originalDate}, ${originalEmail.from} wrote:
${quotedBody}`

          // Build proper threading headers
          const inReplyTo = originalEmail.messageId
          const references = [
            ...(originalEmail.references || []),
            ...(originalEmail.inReplyTo || []),
            originalEmail.messageId
          ]
            .filter((id): id is string => Boolean(id))
            .join(' ')

          const replySubject = originalEmail.subject.startsWith('Re: ')
            ? originalEmail.subject
            : `Re: ${originalEmail.subject}`

          // Send reply via Mailgun
          const { sendMailgunEmail } = await import('../../../utils/mailgunHelpers')

          try {
            await sendMailgunEmail({
              from: from || agentEmail || `Agent <noreply@${teamDomain}>`,
              to: recipientEmail,
              subject: replySubject,
              text: formattedReply,
              inReplyTo,
              references,
              attachments: attachments.length > 0 ? attachments : undefined
            })

            result = {
              content: [
                {
                  type: 'text',
                  text: formatJson({
                    success: true,
                    summary: `Reply sent successfully to ${recipientEmail}${attachments.length > 0 ? ` with ${attachments.length} attachment(s)` : ''}`,
                    data: {
                      to: recipientEmail,
                      subject: replySubject,
                      originalMessageId: messageId,
                      reason: validation.reason,
                      attachmentCount: attachments.length,
                      sentAt: new Date().toISOString()
                    }
                  })
                }
              ],
              isError: false
            }
          } catch (sendError) {
            console.error('[BuiltinEmailMCP] Failed to send reply:', sendError)
            throw createError({
              statusCode: 500,
              statusMessage: `Failed to send reply: ${sendError instanceof Error ? sendError.message : String(sendError)}`
            })
          }
        } else if (toolName === 'forward_email') {
          // Validate required fields
          if (!args.message_id || typeof args.message_id !== 'string') {
            throw createError({ statusCode: 400, statusMessage: 'message_id is required' })
          }
          if (!args.to || typeof args.to !== 'string') {
            throw createError({ statusCode: 400, statusMessage: 'to is required' })
          }

          const messageId = String(args.message_id).trim()
          const to = String(args.to).trim()
          const forwardMessage = args.forward_message ? String(args.forward_message) : ''
          const from = args.from ? String(args.from) : undefined

          // Parse attachments if provided (fetches from datasafe if needed)
          const attachments = await parseAttachments(args, teamId, userId)

          console.log('[BuiltinEmailMCP] Forwarding email:', {
            messageId,
            to,
            teamId,
            userId,
            attachmentCount: attachments.length
          })

          // Load the original email from storage
          const { mailStorage } = await import('../../../features/mail/storage')
          const storedEmail = await mailStorage.getEmailByMessageId(messageId)

          if (!storedEmail) {
            throw createError({
              statusCode: 404,
              statusMessage: `Email not found in storage for message-id: ${messageId}. Can only forward emails we have in storage.`
            })
          }

          const originalEmail = storedEmail.email

          // Validate the forward recipient
          const recipientEmail = extractEmail(to) || to
          const validation = validateRecipient(recipientEmail)

          if (!validation.isAllowed) {
            throw createError({
              statusCode: 403,
              statusMessage: `Email sending restricted: recipient must be in team domain (${teamDomain}) or be a team member`
            })
          }

          // Format forwarded email
          const originalDate = new Date(originalEmail.timestamp).toLocaleString('en-US', {
            dateStyle: 'full',
            timeStyle: 'short'
          })

          const forwardedContent = `${forwardMessage ? forwardMessage + '\n\n' : ''}---------- Forwarded message ---------
From: ${originalEmail.from}
Date: ${originalDate}
Subject: ${originalEmail.subject}
To: ${originalEmail.to}

${originalEmail.body}`

          const forwardSubject = originalEmail.subject.startsWith('Fwd: ')
            ? originalEmail.subject
            : `Fwd: ${originalEmail.subject}`

          // Send forwarded email via Mailgun
          const { sendMailgunEmail } = await import('../../../utils/mailgunHelpers')

          try {
            await sendMailgunEmail({
              from: from || agentEmail || `Agent <noreply@${teamDomain}>`,
              to: recipientEmail,
              subject: forwardSubject,
              text: forwardedContent,
              attachments: attachments.length > 0 ? attachments : undefined
            })

            result = {
              content: [
                {
                  type: 'text',
                  text: formatJson({
                    success: true,
                    summary: `Email forwarded successfully to ${recipientEmail}${attachments.length > 0 ? ` with ${attachments.length} attachment(s)` : ''}`,
                    data: {
                      to: recipientEmail,
                      subject: forwardSubject,
                      originalMessageId: messageId,
                      reason: validation.reason,
                      attachmentCount: attachments.length,
                      sentAt: new Date().toISOString()
                    }
                  })
                }
              ],
              isError: false
            }
          } catch (sendError) {
            console.error('[BuiltinEmailMCP] Failed to forward email:', sendError)
            throw createError({
              statusCode: 500,
              statusMessage: `Failed to forward email: ${sendError instanceof Error ? sendError.message : String(sendError)}`
            })
          }
        } else {
          throw createError({ statusCode: 400, statusMessage: `Unknown tool: ${toolName}` })
        }

        break
      }

      default:
        throw createError({ statusCode: 400, statusMessage: `Unknown method: ${body.method}` })
    }

    return {
      jsonrpc: '2.0',
      id: requestId,
      result
    }
  } catch (error) {
    console.error('[BuiltinEmailMCP] Error handling request:', error)
    return {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: error.statusCode || -32603,
        message: error.statusMessage || error.message || 'Internal error'
      }
    }
  }
})
