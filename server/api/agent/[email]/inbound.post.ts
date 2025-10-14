/**
 * Agent-Specific Inbound Email Handler (Simplified Storage)
 *
 * Receives emails for a specific agent (either from team/inbound relay or direct),
 * stores the email and attachments, and processes with MCP if enabled.
 *
 * Flow: ... → team/[teamId]/inbound → agent/[email]/inbound (storage)
 */

import { mailStorage } from '../../../features/mail/storage'
import { agentLogger } from '../../../utils/agentLogging'
import { evaluateInboundMail } from '../../../utils/mailPolicy'
import { runMCPAgent } from '../../../utils/mcpAgentHelper'
import type { Agent } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const agentEmail = getRouterParam(event, 'email')

    if (!agentEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing agent email parameter'
      })
    }

    // Check if this is a relayed request from team/inbound
    const forwardedBy = getHeader(event, 'x-forwarded-by')
    const forwardedTeamId = getHeader(event, 'x-team-id')
    const forwardedAgentId = getHeader(event, 'x-agent-id')

    console.log('[AgentInbound] Processing email for:', agentEmail, {
      forwardedBy,
      hasTeamId: !!forwardedTeamId,
      hasAgentId: !!forwardedAgentId
    })

    // ═══════════════════════════════════════════════════════════════════
    // PARSE PAYLOAD (same format as Mailgun sends)
    // ═══════════════════════════════════════════════════════════════════

    let payload: Record<string, unknown> | null = null
    const contentType = getHeader(event, 'content-type') || ''

    if (contentType.includes('application/json')) {
      payload = await readBody(event)
      console.log('[AgentInbound] Parsed as JSON payload')
    } else if (contentType.includes('multipart/form-data')) {
      console.log('[AgentInbound] Parsing multipart form data...')
      try {
        const formData = await readMultipartFormData(event)
        if (formData) {
          payload = {}
          for (const field of formData) {
            if (field.name && field.data) {
              if (field.filename) {
                payload[field.name] = {
                  filename: field.filename,
                  data: field.data,
                  type: field.type,
                  size: field.data.length
                }
              } else {
                const value =
                  field.data instanceof Buffer ? field.data.toString('utf8') : field.data
                payload[field.name] = value
              }
            }
          }
        }
      } catch (error) {
        console.error('[AgentInbound] Failed to parse multipart form data:', error)
        const body = await readBody<Record<string, string>>(event)
        payload = body
      }
    } else {
      const body = await readBody<Record<string, string>>(event)
      payload = body
    }

    if (!payload) {
      throw createError({ statusCode: 400, statusMessage: 'No payload received' })
    }

    // Helper to extract email fields
    function firstString(...values: Array<unknown>): string | undefined {
      for (const v of values) {
        if (v === undefined || v === null) continue
        const s = String(v)
        if (s.length > 0) return s
      }
      return undefined
    }

    function getPath(source: unknown, path: Array<string>): unknown {
      let current: unknown = source
      for (const key of path) {
        if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[key]
        } else {
          return undefined
        }
      }
      return current
    }

    // ═══════════════════════════════════════════════════════════════════
    // EXTRACT EMAIL FIELDS
    // ═══════════════════════════════════════════════════════════════════

    const messageId = String(
      firstString(
        payload['Message-Id'],
        payload['message-id'],
        getPath(payload, ['message', 'headers', 'message-id']),
        (
          globalThis as unknown as { crypto?: { randomUUID?: () => string } }
        ).crypto?.randomUUID?.(),
        Math.random().toString(36).slice(2)
      )
    )

    const from = firstString(
      payload.from,
      payload.sender,
      payload.From,
      getPath(payload, ['headers', 'from'])
    )

    const to = firstString(
      payload.recipient,
      payload.to,
      payload.To,
      payload.recipients,
      payload.Recipients,
      getPath(payload, ['headers', 'to']),
      getPath(payload, ['message', 'recipients', 0])
    )

    const subject = firstString(
      payload.subject,
      payload.Subject,
      getPath(payload, ['headers', 'subject'])
    )

    const text = firstString(
      payload['stripped-text'],
      payload.text,
      payload['body-plain'],
      payload.body
    )

    const html = firstString(payload['stripped-html'], payload.html, payload['body-html'])

    console.log('[AgentInbound] Email fields:', {
      messageId: messageId.slice(0, 30),
      from,
      subject
    })

    // ═══════════════════════════════════════════════════════════════════
    // RESOLVE AGENT AND TEAM
    // ═══════════════════════════════════════════════════════════════════

    let team: { id: string; name: string; domain?: string } | null = null
    let agent: Agent | null = null

    // If relayed from team/inbound, use forwarded IDs
    if (forwardedBy === 'team-inbound' && forwardedTeamId && forwardedAgentId) {
      console.log('[AgentInbound] Using forwarded team/agent IDs')

      const storage = useStorage('settings')
      team = await storage.getItem(`teams/${forwardedTeamId}/settings.json`)

      const agentsStorage = useStorage('agents')
      const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
      agent = agents.find((a) => a.id === forwardedAgentId) || null
    } else {
      // Fallback: lookup by email (for direct calls or testing)
      console.log('[AgentInbound] Looking up agent by email (no forwarded headers)')

      const emailParts = agentEmail.split('@')
      if (emailParts.length !== 2) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid email format. Expected: username@domain.com'
        })
      }

      const recipientUsername = emailParts[0].toLowerCase()
      const recipientDomain = emailParts[1].toLowerCase()

      // Look up team by domain
      const { getIdentity } = await import('../../../features/team/storage')
      const identity = await getIdentity()
      team = identity.teams.find((t) => t.domain?.toLowerCase() === recipientDomain) || null

      if (!team) {
        throw createError({ statusCode: 404, statusMessage: 'Team not found for domain' })
      }

      // Load agents and find the agent
      const agentsStorage = useStorage('agents')
      const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
      const teamAgents = agents.filter((a) => a.teamId === team!.id)
      agent =
        teamAgents.find((a) => String(a?.email || '').toLowerCase() === recipientUsername) || null

      if (!agent) {
        throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
      }
    }

    if (!team || !agent) {
      throw createError({ statusCode: 404, statusMessage: 'Team or agent not found' })
    }

    const fullAgentEmail = agent.email.includes('@') ? agent.email : `${agent.email}@${team.domain}`

    console.log('[AgentInbound] ✓ Resolved:', {
      teamId: team.id,
      teamName: team.name,
      agentId: agent.id,
      agentEmail: fullAgentEmail
    })

    // ═══════════════════════════════════════════════════════════════════
    // EXTRACT THREADING HEADERS AND STORE EMAIL
    // ═══════════════════════════════════════════════════════════════════

    const { extractThreadingHeaders, buildConversationId } = await import(
      '../../../features/mail/threading'
    )
    const threadHeaders = extractThreadingHeaders(payload)
    const conversationId = buildConversationId(
      String(messageId || ''),
      threadHeaders.inReplyTo,
      threadHeaders.references
    )

    console.log('[AgentInbound] Threading:', {
      conversationId,
      inReplyTo: threadHeaders.inReplyTo
    })

    const rawAttachments = Array.isArray(payload.attachments) ? payload.attachments : []

    // Store email with full context
    await mailStorage.storeInboundEmail({
      messageId: String(messageId || ''),
      from: String(from || ''),
      to: String(to || ''),
      subject: String(subject || ''),
      body: String(text || ''),
      html: String(html || ''),
      inReplyTo: threadHeaders.inReplyTo,
      references: threadHeaders.references,
      conversationId,
      agentId: agent.id,
      agentEmail: fullAgentEmail,
      teamId: team.id,
      mcpContexts: [],
      rawPayload: payload,
      attachments: rawAttachments
    })

    console.log('[AgentInbound] ✓ Email stored')

    // ═══════════════════════════════════════════════════════════════════
    // PROCESS ATTACHMENTS TO DATASAFE
    // ═══════════════════════════════════════════════════════════════════

    const datasafeStored: Array<{ path: string; name: string; size: number }> = []
    const emailAttachments: Array<{
      id: string
      filename: string
      mimeType: string
      size: number
      datasafePath?: string
      storageKey?: string
    }> = []

    try {
      const { ensureTeamDatasafe, storeAttachment } = await import(
        '../../../features/datasafe/storage'
      )
      const { getAttachmentStats, validateAttachment, extractMailgunAttachments } = await import(
        '../../../utils/mailgunHelpers'
      )

      const stats = getAttachmentStats(payload as Record<string, unknown>)
      console.log(
        `[AgentInbound] Attachment stats: ${stats.totalCount} attachments, ${stats.totalSize} bytes`
      )

      if (stats.hasAttachments) {
        await ensureTeamDatasafe(team.id)
        const attachments = extractMailgunAttachments(payload as Record<string, unknown>)
        const validAttachments = []

        for (const attachment of attachments) {
          const validation = validateAttachment(attachment)
          if (validation.isValid) {
            validAttachments.push(attachment)
          } else {
            console.warn(
              `[AgentInbound] Skipping invalid attachment ${attachment.filename}:`,
              validation.errors
            )
          }
        }

        console.log(`[AgentInbound] Processing ${validAttachments.length} valid attachments`)

        for (const attachment of validAttachments) {
          try {
            const node = await storeAttachment(team.id, {
              filename: attachment.filename,
              data: attachment.data,
              encoding: 'base64',
              mimeType: attachment.mimeType,
              size: attachment.size,
              source: 'email-attachment',
              emailMeta: {
                messageId: String(messageId || ''),
                from: String(from || ''),
                subject: String(subject || '')
              }
            })
            datasafeStored.push({ path: node.path, name: node.name, size: node.size })
            emailAttachments.push({
              id: `${messageId}-${attachment.filename}`,
              filename: attachment.filename,
              mimeType: attachment.mimeType,
              size: attachment.size,
              datasafePath: node.path,
              storageKey: node.path
            })
            console.log(
              `[AgentInbound] ✓ Stored attachment: ${attachment.filename} -> ${node.path}`
            )
          } catch (storeErr) {
            console.error(
              `[AgentInbound] Failed to store attachment ${attachment.filename}:`,
              storeErr
            )
          }
        }
      }
    } catch (datasafeErr) {
      console.error('[AgentInbound] Failed to process attachments:', datasafeErr)
    }

    // Update stored email with datasafe attachment paths
    if (emailAttachments.length > 0) {
      await mailStorage.updateInboundEmailContext({
        messageId: String(messageId || ''),
        agentId: agent.id,
        agentEmail: fullAgentEmail,
        mcpContexts: [],
        attachments: emailAttachments
      })
    }

    // ═══════════════════════════════════════════════════════════════════
    // LOG EMAIL ACTIVITY
    // ═══════════════════════════════════════════════════════════════════

    try {
      await agentLogger.logEmailActivity({
        agentId: agent.id,
        agentEmail: fullAgentEmail,
        direction: 'inbound',
        email: {
          messageId: String(messageId || ''),
          from: String(from || ''),
          to: String(to || ''),
          subject: String(subject || ''),
          body: String(text || ''),
          html: String(html || ''),
          conversationId,
          attachments: datasafeStored.length
        }
      })
    } catch (logErr) {
      console.error('[AgentInbound] Failed to log email activity:', logErr)
    }

    // ═══════════════════════════════════════════════════════════════════
    // EVALUATE POLICY AND PROCESS WITH MCP
    // ═══════════════════════════════════════════════════════════════════

    // Extract bare email address for policy evaluation
    const { extractEmail } = await import('../../../utils/mailgunHelpers')
    const fromEmail = extractEmail(from) || String(from || '')

    const policyDecision = await evaluateInboundMail(agent, fromEmail)

    console.log(
      '[AgentInbound] Policy decision:',
      policyDecision.allowed ? 'allowed' : 'blocked',
      policyDecision.reason || ''
    )

    if (policyDecision.allowed) {
      console.log('[AgentInbound] 🤖 Calling MCP agent...')

      // Load MCP configuration for this agent
      let mcpConfigs: Record<string, { url: string }> = {}
      try {
        const configResponse = await event.$fetch(`/api/agent/${agentEmail}/mcp-config`, {
          method: 'GET'
        })
        mcpConfigs = configResponse.mcpConfigs
        console.log('[AgentInbound] Loaded MCP config for inbound:', Object.keys(mcpConfigs))
      } catch (error) {
        console.error('[AgentInbound] Failed to load MCP config for inbound:', error)
        mcpConfigs = {}
      }

      // Build prompts
      const baseEmailGuidelines = `\nEmail Communication Guidelines:\n- You have access to reply_to_email and forward_email tools to communicate with users\n- These tools require a message-id from the email storage\n- When you receive a request via email:\n  FIRST: Send a brief acknowledgment reply to the sender - if possible estimate a response time\n  Then, completing the action: Send a concise follow-up with key results in reply to the sender\n- Always use professional and friendly language\n- Be concise and direct\n`

      const agentInstructions = (agent as any).prompt || 'You are a helpful AI assistant.'
      const systemPrompt = `${agentInstructions}\n\n${baseEmailGuidelines}`

      const userPrompt = `New inbound email for ${fullAgentEmail}.\nMessage-ID: ${String(messageId || '')}\nFrom: ${String(from || '')}\nTo: ${String(to || '')}\nSubject: ${String(subject || '')}\nBody:\n${String(text || '')}`

      const result = await runMCPAgent({
        mcpConfigs,
        teamId: team.id,
        userId: undefined,
        systemPrompt,
        userPrompt,
        attachments: undefined,
        event,
        agentEmail: fullAgentEmail,
        currentMessageId: String(messageId || '')
      })

      console.log(
        '[AgentInbound] MCP result:',
        typeof result === 'string' ? result.substring(0, 160) + '...' : result
      )

      return {
        ok: true,
        messageId,
        agentId: agent.id,
        teamId: team.id,
        conversationId,
        attachments: datasafeStored.length,
        mcpProcessed: true,
        policyAllowed: policyDecision.allowed
      }
    } else {
      console.log('[AgentInbound] Email blocked by policy:', policyDecision.reason)

      return {
        ok: true,
        messageId,
        agentId: agent.id,
        teamId: team.id,
        conversationId,
        attachments: datasafeStored.length,
        mcpProcessed: false,
        policyAllowed: policyDecision.allowed,
        policyReason: policyDecision.reason
      }
    }
  } catch (error) {
    console.error('[AgentInbound] Error processing email:', error)

    // Return success to Mailgun even on error (don't retry)
    return {
      ok: true,
      error: 'Internal processing error',
      details: error instanceof Error ? error.message : String(error)
    }
  }
})
