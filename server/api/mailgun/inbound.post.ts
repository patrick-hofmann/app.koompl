// Multi-round flow support
import { mailStorage } from '../../utils/mailStorage'
import { agentLogger } from '../../utils/agentLogging'
import { agentFlowEngine } from '../../utils/agentFlowEngine'
import { MessageRouter } from '../../utils/messageRouter'
import { evaluateInboundMail } from '../../utils/mailPolicy'
import type { Agent } from '~/types'

export default defineEventHandler(async (event) => {
  // Always return ok to Mailgun no matter what happens.
  try {
    const agentsStorage = useStorage('agents')

    let payload: Record<string, unknown> | null = null
    const contentType = getHeader(event, 'content-type') || ''

    if (contentType.includes('application/json')) {
      payload = await readBody(event)
    } else {
      // Parse form data for typical Mailgun POSTs
      const body = await readBody<Record<string, string>>(event)
      payload = body
    }

    // Basic shape we care about
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
    function extractMessageIdList(value: unknown): string[] {
      if (!value) return []
      const raw = String(value)
      if (!raw.trim()) return []
      const angleMatches = raw.match(/<[^>]+>/g)
      if (angleMatches && angleMatches.length > 0) {
        return Array.from(new Set(angleMatches.map((match) => match.trim())))
      }
      return Array.from(
        new Set(
          raw
            .split(/[\s,]+/)
            .map((part) => part.trim())
            .filter((part) => part.length > 0)
        )
      )
    }

    function normalizeMessageId(value: string | undefined): string | undefined {
      if (!value) return undefined
      const trimmed = value.trim()
      if (!trimmed) return undefined
      const angleMatch = trimmed.match(/<([^>]+)>/)
      const normalized = (angleMatch ? angleMatch[1] : trimmed).trim().toLowerCase()
      return normalized || undefined
    }
    const _receivedAt = new Date().toISOString()
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
    const inReplyToHeader = firstString(
      payload ? (payload as Record<string, unknown>)['In-Reply-To'] : undefined,
      payload ? (payload as Record<string, unknown>)['in-reply-to'] : undefined,
      getPath(payload, ['headers', 'in-reply-to'])
    )
    const referencesHeader = firstString(
      payload ? (payload as Record<string, unknown>)['References'] : undefined,
      payload ? (payload as Record<string, unknown>)['references'] : undefined,
      getPath(payload, ['headers', 'references'])
    )

    const inReplyToIds = extractMessageIdList(inReplyToHeader)
    const referenceIds = extractMessageIdList(referencesHeader)
    const normalizedInReplyTo = inReplyToIds
      .map((id) => normalizeMessageId(id))
      .filter((id): id is string => !!id)
    const normalizedReferences = referenceIds
      .map((id) => normalizeMessageId(id))
      .filter((id): id is string => !!id)
    const referencedThreadIds = new Set([...normalizedInReplyTo, ...normalizedReferences])

    // Store in unified mail storage system
    const _inboundEmail = await mailStorage.storeInboundEmail({
      messageId: String(messageId || ''),
      from: String(from || ''),
      to: String(to || ''),
      subject: String(subject || ''),
      body: String(text || ''),
      html: String(html || ''),
      inReplyTo: inReplyToIds,
      references: referenceIds,
      agentId: undefined, // Will be set below after agent resolution
      agentEmail: undefined,
      mcpContexts: [],
      rawPayload: payload
    })

    // Use shared helper to extract bare email address from header-like strings
    const { extractEmail } = await import('../../utils/mailgunHelpers')
    let toEmail = extractEmail(to)
    const fromEmail = extractEmail(from)

    // Debug logging for email extraction
    console.log('[Inbound] Email extraction debug:', {
      rawTo: to,
      extractedToEmail: toEmail,
      rawFrom: from,
      extractedFromEmail: fromEmail,
      payloadKeys: payload ? Object.keys(payload) : 'no payload'
    })

    // Fallback: try to extract email from other fields if primary extraction failed
    if (!toEmail && payload) {
      console.log('[Inbound] Primary extraction failed, trying fallback methods...')

      // Try different payload fields
      const fallbackFields = [
        'recipients',
        'Recipients',
        'envelope',
        'message',
        'X-Original-To',
        'x-original-to',
        'Delivered-To',
        'delivered-to'
      ]

      for (const field of fallbackFields) {
        const fieldValue = (payload as Record<string, unknown>)[field]
        if (fieldValue) {
          console.log(`[Inbound] Trying field ${field}:`, fieldValue)
          const extracted = extractEmail(String(fieldValue))
          if (extracted) {
            toEmail = extracted
            console.log(`[Inbound] Successfully extracted from ${field}:`, toEmail)
            break
          }
        }
      }

      // Try array fields
      if (!toEmail && Array.isArray((payload as Record<string, unknown>)['recipients'])) {
        const recipients = (payload as Record<string, unknown>)['recipients'] as string[]
        for (const recipient of recipients) {
          const extracted = extractEmail(recipient)
          if (extracted) {
            toEmail = extracted
            console.log('[Inbound] Successfully extracted from recipients array:', toEmail)
            break
          }
        }
      }
    }

    // Extract domain from recipient email
    const recipientDomain = toEmail?.split('@')[1]?.toLowerCase()
    if (!recipientDomain) {
      console.log('[Inbound] No domain found in recipient email:', toEmail)
      console.log('[Inbound] Raw recipient field:', to)
      console.log(
        '[Inbound] Available payload fields:',
        payload
          ? Object.keys(payload).filter(
              (k) => k.toLowerCase().includes('to') || k.toLowerCase().includes('recipient')
            )
          : 'no payload'
      )
      console.log(
        '[Inbound] Full payload structure:',
        payload ? JSON.stringify(payload, null, 2) : 'no payload'
      )
      return { ok: true, error: 'Invalid recipient email' }
    }

    // Look up team by domain
    const { getIdentity } = await import('../../utils/identityStorage')
    const identity = await getIdentity()
    const team = identity.teams.find((t) => t.domain?.toLowerCase() === recipientDomain)

    if (!team) {
      console.log('[Inbound] No team found for domain:', recipientDomain)
      return { ok: true, error: 'Team not found for domain' }
    }

    console.log('[Inbound] Found team for domain:', {
      teamId: team.id,
      teamName: team.name,
      domain: recipientDomain
    })

    // Extract username from recipient email (agent.email now stores username only)
    const recipientUsername = toEmail?.split('@')[0]?.toLowerCase()
    if (!recipientUsername) {
      console.log('[Inbound] No username found in recipient email:', toEmail)
      return { ok: true, error: 'Invalid recipient username' }
    }

    // Load agents and filter by team
    const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
    const teamAgents = agents.filter((a) => a.teamId === team.id)

    // Find agent by username within the team (agent.email stores username only)
    const agent = teamAgents.find((a) => String(a?.email || '').toLowerCase() === recipientUsername)

    if (!agent) {
      console.log('[Inbound] No agent found for username in team:', {
        username: recipientUsername,
        teamId: team.id
      })
      return { ok: true, error: 'Agent not found' }
    }

    // Construct full email for logging
    const fullAgentEmail = `${agent.email}@${recipientDomain}`
    console.log('[Inbound] Found agent:', {
      agentId: agent.id,
      username: agent.email,
      fullEmail: fullAgentEmail,
      teamId: agent.teamId
    })

    const datasafeStored: Array<{ path: string; name: string; size: number }> = []
    try {
      const { ensureTeamDatasafe, storeAttachment } = await import('../../utils/datasafeStorage')
      const { getAttachmentStats, validateAttachment, debugAttachments } = await import(
        '../../utils/mailgunHelpers'
      )

      // Enable debug mode for attachment processing (can be controlled via environment variable)
      const debugMode = process.env.MAILGUN_ATTACHMENT_DEBUG === 'true'
      if (debugMode) {
        debugAttachments(payload as Record<string, unknown>)
      }

      // Get attachment statistics first
      const stats = getAttachmentStats(payload as Record<string, unknown>)
      console.log(
        `[Inbound] Attachment stats: ${stats.totalCount} attachments, ${stats.totalSize} bytes, types: ${stats.mimeTypes.join(', ')}`
      )

      if (stats.hasAttachments) {
        await ensureTeamDatasafe(team.id)

        // Extract and validate attachments
        const { extractMailgunAttachments } = await import('../../utils/mailgunHelpers')
        const attachments = extractMailgunAttachments(payload as Record<string, unknown>)
        const validAttachments = []
        const invalidAttachments = []

        for (const attachment of attachments) {
          const validation = validateAttachment(attachment)
          if (validation.isValid) {
            validAttachments.push(attachment)
          } else {
            invalidAttachments.push({ attachment, errors: validation.errors })
            console.warn(
              `[Inbound] Skipping invalid attachment ${attachment.filename}:`,
              validation.errors
            )
          }
        }

        console.log(
          `[Inbound] Processing ${validAttachments.length} valid attachments (${invalidAttachments.length} invalid skipped)`
        )

        // Process valid attachments
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
            console.log(`[Inbound] ✓ Stored attachment: ${attachment.filename} -> ${node.path}`)
          } catch (storeErr) {
            console.error(`[Inbound] Failed to store attachment ${attachment.filename}:`, storeErr)
          }
        }

        if (datasafeStored.length > 0) {
          console.log(
            '[Inbound] Successfully stored attachments in datasafe:',
            datasafeStored.map((item) => `${item.name} (${item.path})`)
          )
        }
      } else {
        console.log('[Inbound] No attachments found in email')
      }
    } catch (datasafeErr) {
      console.error('[Inbound] Failed to process attachments:', datasafeErr)
    }

    // Log inbound email activity EARLY (before any outbound processing)
    try {
      await agentLogger.logEmailActivity({
        agentId: agent.id,
        agentEmail: fullAgentEmail, // Use full email for logging
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
      console.error('Failed to log inbound email activity:', logErr)
    }

    // Check if this is a response to THIS AGENT's existing flow
    console.log('\n[Inbound] ════════════════════════════════════════════')
    console.log('[Inbound] 📨 PROCESSING INBOUND EMAIL')
    console.log(`[Inbound] Agent: ${agent.name} (${agent.email})`)
    console.log(`[Inbound] From: ${fromEmail || from}`)
    console.log(`[Inbound] Subject: ${subject}`)
    console.log(`[Inbound] Multi-round enabled: ${agent.multiRoundConfig?.enabled ? 'YES' : 'NO'}`)
    console.log('[Inbound] ════════════════════════════════════════════')

    const inboundPolicy = await evaluateInboundMail(agent, String(fromEmail || from || ''), {
      agents,
      identity
    })
    if (!inboundPolicy.allowed) {
      console.warn('[Inbound] ✗ Email blocked by inbound mail policy:', inboundPolicy.reason)
      return { ok: true, blocked: true, reason: 'inbound_mail_policy' }
    }

    const messageRouter = new MessageRouter()
    const routingResult = await messageRouter.routeInboundEmail(
      {
        messageId: String(messageId || ''),
        from: String(fromEmail || from || ''),
        to: String(toEmail || to || ''),
        subject: String(subject || ''),
        body: String(text || ''),
        receivedAt: new Date().toISOString(),
        inReplyTo: inReplyToIds,
        references: referenceIds
      },
      agent.id
    )

    console.log(
      `[Inbound] Routing result: isFlowResponse=${routingResult.isFlowResponse}, flowId=${routingResult.flow?.id}`
    )

    if (routingResult.isFlowResponse && routingResult.flow) {
      // This is a response to one of this agent's flows - resume it
      console.log(`[Inbound] ✓ This is a RESPONSE to existing flow ${routingResult.flow.id}`)
      console.log('[Inbound] → Resuming flow...')

      await agentFlowEngine.resumeFlow(
        routingResult.flow.id,
        {
          type: 'email_response',
          email: {
            messageId: String(messageId || ''),
            from: String(fromEmail || from || ''),
            subject: String(subject || ''),
            body: String(text || ''),
            inReplyTo: inReplyToIds,
            references: referenceIds
          }
        },
        agent.id
      )
      console.log('[Inbound] ✓ Flow resumed successfully')
      return { ok: true, flowId: routingResult.flow.id, resumed: true }
    }

    // This is a NEW request for this agent
    console.log(`[Inbound] ✓ This is a NEW REQUEST for agent ${agent.name}`)

    // Look up user by email to get userId for MCP context (calendar, kanban, etc.)
    let userId: string | undefined
    let originalRequester: { name: string; email: string } | undefined
    if (fromEmail) {
      try {
        const { getIdentity } = await import('../../utils/identityStorage')
        const identity = await getIdentity()
        const user = identity.users.find(
          (u) => u.email.toLowerCase().trim() === fromEmail.toLowerCase().trim()
        )
        if (user) {
          userId = user.id
          originalRequester = { name: user.name, email: user.email }
          console.log(`[Inbound] Found user ID for ${fromEmail}: ${userId}`)
        } else {
          console.log(`[Inbound] No user found for email: ${fromEmail}`)

          // Check if sender is an agent (agent-to-agent delegation)
          const senderUsername = fromEmail.split('@')[0]?.toLowerCase()
          const senderAgent = agents.find((a) => {
            if (!a?.email) return false
            const agentIdentifier = String(a.email).toLowerCase()
            return agentIdentifier === senderUsername || agentIdentifier === fromEmail.toLowerCase()
          })
          if (senderAgent) {
            console.log(`[Inbound] Sender is an agent: ${senderAgent.name} (${senderAgent.email})`)
            console.log('[Inbound] → Looking for delegating flow to extract user context...')

            // Find the sender agent's active flows to extract original user context
            const senderFlows = await agentFlowEngine.listAgentFlows(senderAgent.id, {
              status: ['waiting', 'active']
            })

            let delegatingFlow = senderFlows.find((flow) => {
              const waitState = flow.waitingFor
              if (!waitState) return false
              const candidateIds = new Set(
                [waitState.messageId, ...(waitState.threadMessageIds || [])]
                  .map((id) => normalizeMessageId(id))
                  .filter((id): id is string => !!id)
              )
              if (candidateIds.size === 0) return false
              for (const id of candidateIds) {
                if (referencedThreadIds.has(id)) {
                  console.log(
                    `[Inbound] ✓ Matched delegating flow ${flow.id} by message headers (${id})`
                  )
                  return true
                }
              }
              return false
            })

            const requestId = messageRouter.extractRequestId(subject || '')
            if (!delegatingFlow && requestId) {
              console.log(`[Inbound] Extracted request ID: ${requestId}`)
              delegatingFlow = senderFlows.find(
                (f) =>
                  f.waitingFor?.type === 'agent_response' && f.waitingFor?.requestId === requestId
              )
            }

            if (delegatingFlow && delegatingFlow.userId) {
              userId = delegatingFlow.userId
              originalRequester = delegatingFlow.requester
              console.log(
                `[Inbound] ✓ Found user context from delegating flow ${delegatingFlow.id}`
              )
              console.log(`[Inbound] ✓ Using userId: ${userId}`)
              console.log(
                `[Inbound] ✓ Original requester: ${originalRequester.name} <${originalRequester.email}>`
              )
            } else if (delegatingFlow) {
              console.log(
                `[Inbound] ⚠ Delegating flow found but has no userId: ${delegatingFlow.id}`
              )
            } else if (requestId) {
              console.log('[Inbound] ⚠ No delegating flow found for request ID')
            }
          }
        }
      } catch (err) {
        console.error('[Inbound] Error looking up user:', err)
      }
    }

    // ALL agents now use multi-round flow processing (single-round is just maxRounds=1)
    const maxRounds = agent.multiRoundConfig?.maxRounds || 1
    const timeoutMinutes = agent.multiRoundConfig?.timeoutMinutes || 30

    console.log('[Inbound] → Starting flow...')
    console.log(`[Inbound]   Max rounds: ${maxRounds}`)
    console.log(`[Inbound]   Timeout: ${timeoutMinutes} minutes`)
    console.log(`[Inbound]   Context: teamId=${agent.teamId || 'none'}, userId=${userId || 'none'}`)

    const flow = await agentFlowEngine.startFlow({
      agentId: agent.id,
      trigger: {
        type: 'email',
        messageId: String(messageId || ''),
        from: String(fromEmail || from || ''),
        to: String(toEmail || to || ''),
        subject: String(subject || ''),
        body: String(text || ''),
        receivedAt: new Date().toISOString()
      },
      maxRounds,
      timeoutMinutes,
      teamId: agent.teamId,
      userId,
      requester: originalRequester || { name: 'Unknown', email: fromEmail || 'unknown@example.com' }
    })

    console.log(`[Inbound] ✓ Flow created: ${flow.id}`)
    console.log('[Inbound] → Executing first round...')

    // Execute first round
    await agentFlowEngine.executeRound(flow.id, agent.id)

    console.log('[Inbound] ✓ First round executed')
    console.log('[Inbound] ════════════════════════════════════════════\n')

    return { ok: true, flowId: flow.id, newFlow: true }
  } catch {
    // Even on error, Mailgun should receive ok
    return { ok: true }
  }
})

// Helper function no longer used in unified multi-round flow
// Kept for potential future use
// function formatEmailAddress(name: string | undefined, email: string): string {
//   const safeEmail = email.trim()
//   const safeName = (name || 'Agent').replace(/["<>]/g, '').trim()
//   return safeName ? `${safeName} <${safeEmail}>` : safeEmail
// }
