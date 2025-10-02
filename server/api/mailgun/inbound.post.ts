// Multi-round flow support
import { mailStorage } from '../../utils/mailStorage'
import { agentLogger } from '../../utils/agentLogging'
import { agentFlowEngine } from '../../utils/agentFlowEngine'
import { MessageRouter } from '../../utils/messageRouter'
import { generateAgentResponse } from '../../utils/agentResponder'
import type { Agent } from '~/types'

export default defineEventHandler(async (event) => {
  // Always return ok to Mailgun no matter what happens.
  try {
    const agentsStorage = useStorage('agents')
    const settingsStorage = useStorage('settings')

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
    const receivedAt = new Date().toISOString()
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
      getPath(payload, ['headers', 'to'])
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

    // Store in unified mail storage system
    const inboundEmail = await mailStorage.storeInboundEmail({
      messageId: String(messageId || ''),
      from: String(from || ''),
      to: String(to || ''),
      subject: String(subject || ''),
      body: String(text || ''),
      html: String(html || ''),
      agentId: undefined, // Will be set below after agent resolution
      agentEmail: undefined,
      mcpContexts: [],
      rawPayload: payload
    })

    // Use shared helper to extract bare email address from header-like strings
    const { extractEmail } = await import('../../utils/mailgunHelpers')
    const toEmail = extractEmail(to)
    const fromEmail = extractEmail(from)

    // Load agents and try to resolve the agent by recipient address
    const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
    const agent = toEmail
      ? agents.find((a) => String(a?.email || '').toLowerCase() === toEmail)
      : undefined

    if (!agent) {
      console.log('[Inbound] No agent found for email:', toEmail)
      return { ok: true, error: 'Agent not found' }
    }

    // Log inbound email activity EARLY (before any outbound processing)
    try {
      await agentLogger.logEmailActivity({
        agentId: agent.id,
        agentEmail: agent.email,
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
          mcpContextCount: 0
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

    const messageRouter = new MessageRouter()
    const routingResult = await messageRouter.routeInboundEmail(
      {
        messageId: String(messageId || ''),
        from: String(fromEmail || from || ''),
        to: String(toEmail || to || ''),
        subject: String(subject || ''),
        body: String(text || ''),
        receivedAt: new Date().toISOString()
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
            body: String(text || '')
          }
        },
        agent.id
      )
      console.log('[Inbound] ✓ Flow resumed successfully')
      return { ok: true, flowId: routingResult.flow.id, resumed: true }
    }

    // This is a NEW request for this agent
    console.log(`[Inbound] ✓ This is a NEW REQUEST for agent ${agent.name}`)

    // Check if agent has multi-round enabled
    if (agent.multiRoundConfig?.enabled) {
      // Start a new multi-round flow FOR THIS AGENT
      console.log('[Inbound] → Starting new multi-round flow...')
      console.log(`[Inbound]   Max rounds: ${agent.multiRoundConfig.maxRounds}`)
      console.log(`[Inbound]   Timeout: ${agent.multiRoundConfig.timeoutMinutes} minutes`)

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
        maxRounds: agent.multiRoundConfig.maxRounds,
        timeoutMinutes: agent.multiRoundConfig.timeoutMinutes
      })

      console.log(`[Inbound] ✓ Flow created: ${flow.id}`)
      console.log('[Inbound] → Executing first round...')

      // Execute first round
      await agentFlowEngine.executeRound(flow.id, agent.id)

      console.log('[Inbound] ✓ First round executed')
      console.log('[Inbound] ════════════════════════════════════════════\n')

      return { ok: true, flowId: flow.id, newFlow: true }
    }

    console.log('[Inbound] ⚠ Multi-round NOT enabled, falling back to single-round processing')
    console.log('[Inbound] ════════════════════════════════════════════\n')

    // Fall back to legacy single-round processing
    console.log(`[Inbound] Processing as single-round for agent ${agent.id}`)

    // Prepare settings for mailgun
    const settings = (await settingsStorage.getItem<Record<string, unknown>>('settings.json')) || {}
    const allowedDomains = firstString((settings as Record<string, unknown>)['allowedDomains'])
    const isProduction = process.env.NODE_ENV === 'production'

    // Check domain filtering before processing AI response
    let isDomainAllowed = true
    if (isProduction && allowedDomains && fromEmail) {
      // Import domain matcher utility
      const { isEmailAllowed } = await import('~/utils/domainMatcher')
      isDomainAllowed = isEmailAllowed(fromEmail, allowedDomains)
      console.log(`[Inbound] Domain check (${fromEmail}) allowed=${isDomainAllowed}`)
    } else if (!isProduction) {
      console.log('[Inbound] Skipping domain check in development environment')
    }

    // Generate AI response by delegating to shared responder utility
    let aiAnswer: string | null = null
    if (agent && isDomainAllowed) {
      const response = await generateAgentResponse({
        agentId: agent.id,
        subject: String(subject || ''),
        text: String(text || ''),
        from: String(fromEmail || from || ''),
        includeQuote: true,
        maxTokens: 700,
        temperature: 0.4
      })
      if (response.ok && response.result) {
        aiAnswer = response.result.trim()
      } else {
        console.warn(
          '[Inbound] Respond helper returned no result:',
          response.error || 'unknown_error'
        )
      }
    }

    // Compose TOFU response: answer text on top, full quote below
    let answerText: string
    if (!isDomainAllowed) {
      answerText =
        'Sorry, your email domain is not authorized to receive automated responses. Please contact the administrator if you believe this is an error.'
    } else if (aiAnswer) {
      answerText = aiAnswer
    } else {
      answerText =
        "Sorry, I'm not sure how to respond to that. There may be a problem with your email or the agent may not be configured correctly."
    }

    const quoted = String(text || '')
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
    const tofuBody = `${answerText}\n\nOn ${receivedAt}, ${from || '(sender)'} wrote:\n${quoted}`

    // Preserve UTF-8 characters (no ASCII-only sanitization)
    const cleanBody = String(tofuBody || '').trim()

    // Send reply via dedicated outbound route if we have agent and email addresses
    let _outboundResult: { ok: boolean; id?: string; message?: string; error?: string } = {
      ok: false
    }
    if (agent && fromEmail && toEmail && isDomainAllowed) {
      if (!aiAnswer) {
        console.log('[Inbound] Using fallback response text; AI answer unavailable')
      }
      try {
        const response = await event.$fetch('/api/mailgun/outbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `${agent.name || 'Agent'} <${toEmail}>`,
            to: fromEmail,
            subject: `Re: ${String(subject || '').replace(/^Re:\s*/i, '')}`,
            text: cleanBody,
            agentId: agent.id,
            agentEmail: agent.email,
            mcpServerIds: agent.mcpServerIds || [],
            mcpContextCount: 0,
            isAutomatic: true // This is an automatic response via Mailgun
          })
        })

        _outboundResult = response.ok
          ? { ok: true, id: response.messageId, message: 'Sent via outbound route' }
          : { ok: false, error: response.error }
      } catch (error) {
        console.error('Failed to send via outbound route:', error)
        _outboundResult = { ok: false, error: String(error) }
      }
    }

    // Update the inbound email with agent information without creating a duplicate log entry
    await mailStorage.updateInboundEmailContext({
      messageId: String(messageId || ''),
      agentId: agent?.id,
      agentEmail: agent?.email,
      mcpContexts: []
    })

    // (inbound email activity was already logged earlier)

    return { ok: true, id: inboundEmail.id }
  } catch {
    // Even on error, Mailgun should receive ok
    return { ok: true }
  }
})
