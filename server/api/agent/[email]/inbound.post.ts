/**
 * Agent-Specific Inbound Email Handler (Simplified)
 *
 * Receives emails for a specific agent and processes them directly.
 * No complex flow engine - just store, validate, and respond.
 */

import { mailStorage } from '../../../utils/mailStorage'
import { agentLogger } from '../../../utils/agentLogging'
import { evaluateInboundMail } from '../../../utils/mailPolicy'
import { runMCPAgent } from '../../../utils/mcpAgentHelper'
import type { Agent } from '~/types'

export default defineEventHandler(async (event) => {
  // Always return ok to Mailgun no matter what happens
  try {
    const agentEmail = getRouterParam(event, 'email')

    if (!agentEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing agent email parameter'
      })
    }

    // Parse Mailgun payload
    let payload: Record<string, unknown> | null = null
    const contentType = getHeader(event, 'content-type') || ''

    console.log('[AgentInbound] Content-Type:', contentType)
    console.log('[AgentInbound] Request method:', getMethod(event))

    // Parse payload (multipart, JSON, or form data)
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
                console.log(
                  `[AgentInbound] Found file attachment: ${field.name} = ${field.filename} (${field.data.length} bytes)`
                )
              } else {
                const value =
                  field.data instanceof Buffer ? field.data.toString('utf8') : field.data
                payload[field.name] = value
              }
            }
          }
          console.log('[AgentInbound] Parsed multipart form data, fields:', Object.keys(payload))
        }
      } catch (error) {
        console.error('[AgentInbound] Failed to parse multipart form data:', error)
        const body = await readBody<Record<string, string>>(event)
        payload = body
      }
    } else {
      console.log('[AgentInbound] Parsing as regular form data...')
      const body = await readBody<Record<string, string>>(event)
      payload = body
    }

    console.log('[AgentInbound] Final payload type:', typeof payload)
    console.log(
      '[AgentInbound] Final payload keys:',
      payload ? Object.keys(payload).slice(0, 20) : 'no payload'
    )

    // Helper functions for extracting email fields
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

    function firstString(...values: Array<unknown>): string | undefined {
      for (const v of values) {
        if (v === undefined || v === null) continue
        const s = String(v)
        if (s.length > 0) return s
      }
      return undefined
    }

    // Extract email fields from payload
    const messageId = String(
      firstString(
        payload ? (payload as Record<string, unknown>)['Message-Id'] : undefined,
        payload ? (payload as Record<string, unknown>)['message-id'] : undefined,
        getPath(payload, ['message', 'headers', 'message-id']),
        (
          globalThis as unknown as { crypto?: { randomUUID?: () => string } }
        ).crypto?.randomUUID?.(),
        Math.random().toString(36).slice(2)
      )
    )
    const from = firstString(
      payload ? (payload as Record<string, unknown>)['from'] : undefined,
      payload ? (payload as Record<string, unknown>)['sender'] : undefined,
      payload ? (payload as Record<string, unknown>)['From'] : undefined,
      getPath(payload, ['headers', 'from'])
    )
    const to = firstString(
      payload ? (payload as Record<string, unknown>)['recipient'] : undefined,
      payload ? (payload as Record<string, unknown>)['to'] : undefined,
      payload ? (payload as Record<string, unknown>)['To'] : undefined,
      payload ? (payload as Record<string, unknown>)['recipients'] : undefined,
      payload ? (payload as Record<string, unknown>)['Recipients'] : undefined,
      getPath(payload, ['headers', 'to']),
      getPath(payload, ['headers', 'To']),
      getPath(payload, ['message', 'recipients', 0]),
      getPath(payload, ['envelope', 'to'])
    )
    const subject = firstString(
      payload ? (payload as Record<string, unknown>)['subject'] : undefined,
      payload ? (payload as Record<string, unknown>)['Subject'] : undefined,
      getPath(payload, ['headers', 'subject'])
    )
    const text = firstString(
      payload ? (payload as Record<string, unknown>)['stripped-text'] : undefined,
      payload ? (payload as Record<string, unknown>)['text'] : undefined,
      payload ? (payload as Record<string, unknown>)['body-plain'] : undefined,
      payload ? (payload as Record<string, unknown>)['body'] : undefined
    )
    const html = firstString(
      payload ? (payload as Record<string, unknown>)['stripped-html'] : undefined,
      payload ? (payload as Record<string, unknown>)['html'] : undefined,
      payload ? (payload as Record<string, unknown>)['body-html'] : undefined
    )

    // ═══════════════════════════════════════════════════════════════════
    // STORE EMAIL IN NITRO STORAGE BEFORE AI PROCESSING
    // ═══════════════════════════════════════════════════════════════════
    console.log(`[AgentInbound] 💾 Storing email: message-id=${messageId}`)

    const storedEmail = await mailStorage.storeInboundEmail({
      messageId: String(messageId || ''),
      from: String(from || ''),
      to: String(to || ''),
      subject: String(subject || ''),
      body: String(text || ''),
      html: String(html || ''),
      inReplyTo: [],
      references: [],
      agentId: undefined,
      agentEmail: undefined,
      mcpContexts: [],
      rawPayload: payload
    })

    console.log(`[AgentInbound] ✓ Email stored: ${storedEmail.id}`)

    // Extract bare email addresses
    const { extractEmail } = await import('../../../utils/mailgunHelpers')
    const toEmail = extractEmail(to) || agentEmail
    const fromEmail = extractEmail(from)

    console.log('[AgentInbound] Email extraction:', {
      rawTo: to,
      extractedToEmail: toEmail,
      rawFrom: from,
      extractedFromEmail: fromEmail,
      agentEmail
    })

    // Extract domain and username from agent email
    const emailParts = agentEmail.split('@')
    if (emailParts.length !== 2) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid email format. Expected: username@domain.com'
      })
    }

    const recipientUsername = emailParts[0].toLowerCase()
    const recipientDomain = emailParts[1].toLowerCase()

    console.log('[AgentInbound] Looking up agent:', {
      email: agentEmail,
      username: recipientUsername,
      domain: recipientDomain
    })

    // Look up team by domain
    const { getIdentity } = await import('../../../utils/identityStorage')
    const identity = await getIdentity()
    const team = identity.teams.find((t) => t.domain?.toLowerCase() === recipientDomain)

    if (!team) {
      console.log('[AgentInbound] No team found for domain:', recipientDomain)
      return { ok: true, error: 'Team not found for domain' }
    }

    console.log('[AgentInbound] Found team:', {
      teamId: team.id,
      teamName: team.name,
      domain: recipientDomain
    })

    // Load agents and find the agent
    const agentsStorage = useStorage('agents')
    const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
    const teamAgents = agents.filter((a) => a.teamId === team.id)
    const agent = teamAgents.find((a) => String(a?.email || '').toLowerCase() === recipientUsername)

    if (!agent) {
      console.log('[AgentInbound] No agent found for username in team:', {
        username: recipientUsername,
        teamId: team.id
      })
      return { ok: true, error: 'Agent not found' }
    }

    const fullAgentEmail = `${agent.email}@${recipientDomain}`
    console.log('[AgentInbound] Found agent:', {
      agentId: agent.id,
      username: agent.email,
      fullEmail: fullAgentEmail,
      teamId: agent.teamId
    })

    // Process attachments to datasafe
    const datasafeStored: Array<{ path: string; name: string; size: number }> = []
    try {
      const { ensureTeamDatasafe, storeAttachment } = await import('../../../utils/datasafeStorage')
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

    // Log inbound email activity
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
          body: String(text || '')
        },
        metadata: {
          mailgunSent: false,
          isAutomatic: false,
          mcpContextCount: 0,
          datasafeStoredPaths: datasafeStored.map((item) => item.path)
        }
      })
    } catch (logErr) {
      console.error('[AgentInbound] Failed to log email activity:', logErr)
    }

    console.log('\n[AgentInbound] ════════════════════════════════════════════')
    console.log('[AgentInbound] 📨 PROCESSING INBOUND EMAIL')
    console.log(`[AgentInbound] Agent: ${agent.name} (${agent.email})`)
    console.log(`[AgentInbound] From: ${fromEmail || from}`)
    console.log(`[AgentInbound] Subject: ${subject}`)
    console.log('[AgentInbound] ════════════════════════════════════════════')

    // Check mail policy
    const inboundPolicy = await evaluateInboundMail(agent, String(fromEmail || from || ''), {
      agents,
      identity
    })
    if (!inboundPolicy.allowed) {
      console.warn('[AgentInbound] ✗ Email blocked by mail policy:', inboundPolicy.reason)
      return { ok: true, blocked: true, reason: 'inbound_mail_policy' }
    }

    // Look up user by email for MCP context
    let userId: string | undefined
    if (fromEmail) {
      const user = identity.users.find(
        (u) => u.email.toLowerCase().trim() === fromEmail.toLowerCase().trim()
      )
      if (user) {
        userId = user.id
        console.log(`[AgentInbound] Found user ID for ${fromEmail}: ${userId}`)
      } else {
        console.log(`[AgentInbound] No user found for email: ${fromEmail}`)
      }
    }

    // Get MCP configuration for the agent
    let mcpConfigs: Record<string, { url: string }> = {}

    try {
      const configResponse = await $fetch(`/api/agent/${agentEmail}/mcp-config`, {
        method: 'GET'
      })
      mcpConfigs = configResponse.mcpConfigs
      console.log('[AgentInbound] Loaded MCP config:', {
        serverIds: configResponse.serverIds,
        configuredServers: Object.keys(mcpConfigs)
      })
    } catch (error) {
      console.error('[AgentInbound] Failed to load MCP config:', error)
      mcpConfigs = {}
    }

    // Apply predefined agent overrides
    const { withPredefinedOverride } = await import('../../../utils/predefinedKoompls')
    const effectiveAgent = withPredefinedOverride(agent)

    console.log('[AgentInbound] Using agent prompt:', {
      hasPrompt: !!effectiveAgent.prompt,
      promptPreview: effectiveAgent.prompt
        ? effectiveAgent.prompt.substring(0, 100) + '...'
        : 'NO PROMPT SET'
    })

    // Build system prompt
    const baseEmailGuidelines = `
Email Communication Guidelines:
- You have access to reply_to_email and forward_email tools
- To reply, use: reply_to_email with message_id="${messageId}"
- The system automatically quotes and formats emails
- Always be professional and concise
`

    const systemPrompt = `${effectiveAgent.prompt || 'You are a helpful AI assistant.'}

${baseEmailGuidelines}`

    // Build user prompt
    const userPrompt = `You received an email:

From: ${fromEmail || from}
Subject: ${subject || 'No Subject'}

Message:
${text || 'No message body'}

MESSAGE-ID: ${messageId}

Please process this email and reply using the reply_to_email tool.`

    console.log('[AgentInbound] → Calling agent...')

    // Call agent directly (no flow engine)
    const result = await runMCPAgent({
      mcpConfigs,
      teamId: team.id,
      userId,
      systemPrompt,
      userPrompt,
      event
    })

    console.log('[AgentInbound] ✓ Agent execution complete')
    console.log('[AgentInbound] Result preview:', result?.substring(0, 100))
    console.log('[AgentInbound] ════════════════════════════════════════════\n')

    return { ok: true, messageId, result }
  } catch (error) {
    console.error('[AgentInbound] Error:', error)
    return { ok: true } // Always return ok to Mailgun
  }
})
