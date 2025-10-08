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

  const headers = getRequestHeaders(event)
  const headerTeamId = headers['x-team-id']
  const headerUserId = headers['x-user-id']

  if (!headerTeamId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing x-team-id header'
    })
  }

  if (!headerUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing x-user-id header'
    })
  }

  const teamId = headerTeamId
  const userId = headerUserId
  let session

  // In production, verify the teamId and userId against the session
  if (process.env.NODE_ENV !== 'development') {
    try {
      session = await requireUserSession(event)

      // Verify that the header teamId matches the session teamId
      if (session.team?.id !== teamId) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Team ID mismatch between session and header'
        })
      }

      // Verify that the header userId matches the session userId
      if (session.user?.id !== userId) {
        throw createError({
          statusCode: 403,
          statusMessage: 'User ID mismatch between session and header'
        })
      }
    } catch (authError) {
      console.error('[BuiltinEmailMCP] Authentication failed:', authError)
      throw authError
    }
  } else {
    // Development mode: skip session validation, use header values
    console.log('[BuiltinEmailMCP] Development mode - using teamId from header:', teamId)
    session = {
      user: { id: userId, name: 'Test User', email: 'test@example.com' },
      team: { id: teamId, name: 'Test Team' }
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
        result = {
          tools: [
            {
              name: 'reply_to_email',
              description:
                'Reply to an existing email by message-id. Automatically quotes the original email and sets proper threading headers. Recipients must be in the team domain or be team members.',
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
                  }
                },
                required: ['message_id', 'reply_text'],
                additionalProperties: false
              }
            },
            {
              name: 'forward_email',
              description:
                'Forward an existing email by message-id to another recipient. Automatically formats the email with forwarding headers. Recipients must be in the team domain or be team members.',
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

        // Get team and identity for validation
        const { getIdentity } = await import('../../utils/identityStorage')
        const identity = await getIdentity()
        const team = identity.teams.find((t) => t.id === teamId)

        if (!team) {
          throw createError({ statusCode: 404, statusMessage: 'Team not found' })
        }

        const teamDomain = team.domain?.toLowerCase()
        const { extractEmail } = await import('../../utils/mailgunHelpers')

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

          console.log('[BuiltinEmailMCP] Replying to email:', { messageId, teamId, userId })

          // Load the original email from storage
          const { mailStorage } = await import('../../utils/mailStorage')
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
          const { sendMailgunEmail } = await import('../../utils/mailgunHelpers')

          try {
            await sendMailgunEmail({
              from: from || `Agent <noreply@${teamDomain}>`,
              to: recipientEmail,
              subject: replySubject,
              text: formattedReply,
              inReplyTo,
              references
            })

            result = {
              content: [
                {
                  type: 'text',
                  text: formatJson({
                    success: true,
                    summary: `Reply sent successfully to ${recipientEmail}`,
                    data: {
                      to: recipientEmail,
                      subject: replySubject,
                      originalMessageId: messageId,
                      reason: validation.reason,
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

          console.log('[BuiltinEmailMCP] Forwarding email:', { messageId, to, teamId, userId })

          // Load the original email from storage
          const { mailStorage } = await import('../../utils/mailStorage')
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
          const { sendMailgunEmail } = await import('../../utils/mailgunHelpers')

          try {
            await sendMailgunEmail({
              from: from || `Agent <noreply@${teamDomain}>`,
              to: recipientEmail,
              subject: forwardSubject,
              text: forwardedContent
            })

            result = {
              content: [
                {
                  type: 'text',
                  text: formatJson({
                    success: true,
                    summary: `Email forwarded successfully to ${recipientEmail}`,
                    data: {
                      to: recipientEmail,
                      subject: forwardSubject,
                      originalMessageId: messageId,
                      reason: validation.reason,
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
