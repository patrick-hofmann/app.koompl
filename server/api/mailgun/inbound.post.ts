// MCP fetching and AI generation are handled in /api/agents/[id]/respond
import { mailStorage } from '../../utils/mailStorage'
import { agentLogger } from '../../utils/agentLogging'
import type { Agent } from '~/types'
// import type { StoredMcpServer } from '../../utils/mcpStorage'

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
    const messageId = String(firstString(
      payload ? (payload as Record<string, unknown>)['Message-Id'] : undefined,
      payload ? (payload as Record<string, unknown>)['message-id'] : undefined,
      getPath(payload, ['message', 'headers', 'message-id']),
      (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.(),
      Math.random().toString(36).slice(2)
    ))
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

    // Helper: extract the bare email address from header-like strings
    const extractEmail = (value: string | undefined | null): string | null => {
      if (!value) return null
      const v = String(value)
      const angle = v.match(/<([^>]+)>/)
      const email = (angle ? angle[1] : v).trim()
      // If multiple recipients, take first
      const first = email.split(',')[0].trim()
      return first.toLowerCase()
    }

    const toEmail = extractEmail(to)
    const fromEmail = extractEmail(from)

    // Load agents and try to resolve the agent by recipient address
    const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
    const agent = toEmail ? agents.find(a => String(a?.email || '').toLowerCase() === toEmail) : undefined

    // Do not fetch MCP contexts here

    // Log inbound email activity EARLY (before any outbound processing)
    try {
      if (agent && agent.id && agent.email) {
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
      }
    } catch (logErr) {
      console.error('Failed to log inbound email activity:', logErr)
    }

    // Prepare settings for mailgun
    const settings = (await settingsStorage.getItem<Record<string, unknown>>('settings.json')) || {}
    const allowedDomains = firstString((settings as Record<string, unknown>)['allowedDomains'])

    // Check domain filtering before processing AI response
    let isDomainAllowed = false
    if (allowedDomains && fromEmail) {
      // Import domain matcher utility
      const { isEmailAllowed } = await import('~/utils/domainMatcher')
      isDomainAllowed = isEmailAllowed(fromEmail, allowedDomains)
    }

    // Generate AI response by delegating to respond endpoint (handles MCP fetching/logging)
    let aiAnswer: string | null = null
    if (agent && isDomainAllowed) {
      try {
        const base = getRequestURL(event)
        const origin = `${base.protocol}//${base.host}`
        const response = await $fetch<{ ok: boolean, result?: string, error?: string }>(`${origin}/api/agents/${agent.id}/respond`, {
          method: 'POST',
          body: {
            subject: String(subject || ''),
            text: String(text || ''),
            from: String(fromEmail || from || ''),
            includeQuote: true,
            maxTokens: 700,
            temperature: 0.4
          }
        })
        if (response.ok && response.result) {
          aiAnswer = response.result.trim()
        }
      } catch (error) {
        console.error('Respond endpoint error:', error)
        aiAnswer = null
      }
    }

    // Compose TOFU response: answer text on top, full quote below
    let answerText: string
    if (!isDomainAllowed) {
      answerText = 'Sorry, your email domain is not authorized to receive automated responses. Please contact the administrator if you believe this is an error.'
    } else if (aiAnswer) {
      answerText = aiAnswer
    } else {
      answerText = 'Sorry, I\'m not sure how to respond to that. There may be a problem with your email or the agent may not be configured correctly.'
    }

    const quoted = String(text || '')
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n')
    const tofuBody = `${answerText}\n\nOn ${receivedAt}, ${from || '(sender)'} wrote:\n${quoted}`

    // Preserve UTF-8 characters (no ASCII-only sanitization)
    const cleanBody = String(tofuBody || '').trim()

    // Send reply via dedicated outbound route if we have agent and email addresses
    let _outboundResult: { ok: boolean, id?: string, message?: string, error?: string } = { ok: false }
    if (agent && fromEmail && toEmail && aiAnswer) {
      try {
        const base = getRequestURL(event)
        const origin = `${base.protocol}//${base.host}`
        const response = await $fetch(`${origin}/api/mailgun/outbound`, {
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

        _outboundResult = response.ok ? { ok: true, id: response.messageId, message: 'Sent via outbound route' } : { ok: false, error: response.error }
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
