/**
 * Agent-Specific Inbound Email Handler (Simplified Storage)
 *
 * Receives emails for a specific agent (either from team/inbound relay or direct),
 * stores the email and attachments, and processes with MCP if enabled.
 *
 * Flow: ... → team/[teamId]/inbound → agent/[email]/inbound (storage)
 */

import {
  storeInboundEmail,
  updateInboundEmailContext,
  storeEmailAttachments
} from '../../../features/mail'
import { agentLogger } from '../../../utils/agentLogging'
import { evaluateInboundMail } from '../../../utils/mailPolicy'
import { runMCPAgent } from '../../../utils/mcpAgentHelper'
import agentConfig from '~~/agents.config'
import type { Agent } from '~/types'

export default defineEventHandler(async (event) => {
  const requestStartTime = Date.now()
  const requestStartTimestamp = new Date().toISOString()
  console.log(`[${requestStartTimestamp}] [AgentInbound] ⏱️  Request started`)

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

      // Use feature function to get agent
      const { getAgent } = await import('../../../features/agent')
      agent = await getAgent(forwardedAgentId)
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

      // Use feature function to find agent by email
      const { getAgentByEmail } = await import('../../../features/agent')
      agent = await getAgentByEmail(recipientUsername, team.id)

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
    await storeInboundEmail({
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

    const emailStoredTime = Date.now()
    console.log(`[AgentInbound] ✓ Email stored (${emailStoredTime - requestStartTime}ms elapsed)`)

    // ═══════════════════════════════════════════════════════════════════
    // PROCESS ATTACHMENTS TO MAIL STORAGE
    // ═══════════════════════════════════════════════════════════════════

    const attachmentStart = Date.now()
    // Use centralized attachment processing from mail feature
    const { attachments: emailAttachments, storedCount } = await storeEmailAttachments(payload, {
      teamId: team.id,
      messageId: String(messageId || ''),
      from: String(from || ''),
      subject: String(subject || '')
    })

    // Update stored email with attachment metadata
    if (emailAttachments.length > 0) {
      await updateInboundEmailContext({
        messageId: String(messageId || ''),
        agentId: agent.id,
        agentEmail: fullAgentEmail,
        mcpContexts: [],
        attachments: emailAttachments
      })
    }

    const attachmentDuration = Date.now() - attachmentStart
    console.log(
      `[AgentInbound] ⏱️  Attachment processing: ${attachmentDuration}ms (${storedCount} stored)`
    )

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
          attachments: storedCount
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
      const mcpStart = Date.now()
      console.log(
        `[AgentInbound] 🤖 Calling MCP agent... (${mcpStart - requestStartTime}ms elapsed so far)`
      )

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
      const baseEmailGuidelines = agentConfig.behavior.emailGuidelines

      const agentInstructions = (agent as any).prompt || 'You are a helpful AI assistant.'
      const systemPrompt = `${agentInstructions}\n\n${baseEmailGuidelines}`

      // Build user prompt with attachment information if present
      let userPrompt = `New inbound email for ${fullAgentEmail}.\nMessage-ID: ${String(messageId || '')}\nFrom: ${String(from || '')}\nTo: ${String(to || '')}\nSubject: ${String(subject || '')}\nBody:\n${String(text || '')}`

      // Add attachment information if attachments were stored
      if (emailAttachments.length > 0) {
        userPrompt += `\n\n📎 EMAIL ATTACHMENTS (${emailAttachments.length}):`
        for (const att of emailAttachments) {
          userPrompt += `\n- File: ${att.filename}`
          userPrompt += `\n  Type: ${att.mimeType}`
          userPrompt += `\n  Size: ${att.size} bytes`
          userPrompt += `\n  ID: ${att.id}`
        }
        userPrompt += `\n\n✅ IMPORTANT: Email attachments workflow:`
        userPrompt += `\n1. Attachments are stored in email storage (not datasafe yet)`
        userPrompt += `\n2. To work with attachments, use the copy_email_attachment_to_datasafe tool`
        userPrompt += `\n3. This tool copies the attachment to your datasafe without passing data through AI`
        userPrompt += `\n4. After copying, use regular datasafe tools to read/process the file`
        userPrompt += `\n\nExample: copy_email_attachment_to_datasafe(message_id="${String(messageId || '')}", filename="${emailAttachments[0]?.filename}", target_path="Documents/${emailAttachments[0]?.filename}")`
      }

      console.log('[AgentInbound] Prompt includes:', {
        hasAttachments: emailAttachments.length > 0,
        attachmentCount: emailAttachments.length,
        attachmentIds: emailAttachments.map((a) => a.id)
      })

      // Resolve model settings: general defaults → agent frontmatter overrides
      const generalDefaults = agentConfig.predefined?.general || ({} as any)
      let fmModel: string | undefined
      let fmTemperature: number | undefined
      let fmMaxTokens: number | undefined
      let fmMaxSteps: number | undefined

      try {
        const { loadPredefinedAgentById } = await import('../../../features/koompl/predefined')
        const doc = await loadPredefinedAgentById(agent.id)
        if (doc) {
          fmModel = doc.model
          fmTemperature = doc.temperature
          fmMaxTokens = doc.max_tokens
          fmMaxSteps = doc.max_steps
        }
      } catch (e) {
        console.warn('[AgentInbound] Failed to load agent frontmatter from content:', e)
      }

      const effectiveModel = fmModel || generalDefaults.model
      const effectiveTemperature =
        fmTemperature ?? (generalDefaults.temperature as number | undefined)
      const effectiveMaxTokens = fmMaxTokens ?? (generalDefaults.max_tokens as number | undefined)
      const effectiveMaxSteps = fmMaxSteps ?? (generalDefaults.max_steps as number | undefined)

      const result = await runMCPAgent({
        mcpConfigs,
        teamId: team.id,
        userId: undefined,
        systemPrompt,
        userPrompt,
        attachments: undefined,
        event,
        agentEmail: fullAgentEmail,
        currentMessageId: String(messageId || ''),
        // Effective model settings for this agent
        model: effectiveModel,
        temperature: effectiveTemperature,
        maxTokens: effectiveMaxTokens,
        maxSteps: effectiveMaxSteps
      })

      const mcpDuration = Date.now() - mcpStart
      const totalDuration = Date.now() - requestStartTime
      console.log(
        `[AgentInbound] ⏱️  MCP agent completed in ${mcpDuration}ms (total: ${totalDuration}ms)`
      )
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
        attachments: storedCount,
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
        attachments: storedCount,
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
