import { listMcpServers } from '../../utils/mcpStorage'
import { fetchMcpContext, type McpContextResult } from '../../utils/mcpClients'
import { createGeneralAgent } from '../../utils/mcpAgent'
import type { Agent } from '~/types'
import type { StoredMcpServer } from '../../utils/mcpStorage'

export default defineEventHandler(async (event) => {
  // Always return ok to Mailgun no matter what happens.
  try {
    const config = useRuntimeConfig()
    const mailgunKey = config?.mailgun?.key

    // Mailgun forwards MIME or parsed form fields depending on route settings.
    // We accept both JSON and form-urlencoded payloads.

    const inboundStorage = useStorage('inbound')
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

    // Persist raw payload for traceability (namespaced by inbound storage)
    const inboundKey = `${receivedAt}_${(messageId || '').replace(/[^a-zA-Z0-9_-]/g, '') || Math.random().toString(36).slice(2)}.json`
    await inboundStorage.setItem(inboundKey, {
      receivedAt,
      messageId,
      from,
      to,
      subject,
      text,
      html,
      raw: payload
    })

    // Also persist simplified inbound snapshot to agents storage as inbound.json
    await agentsStorage.setItem('inbound.json', {
      receivedAt,
      messageId,
      from,
      to,
      subject,
      text: String(text || ''),
      html: String(html || ''),
      mcpContexts: []
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

    let mcpContexts: McpContextResult[] = []
    if (agent?.mcpServerIds?.length) {
      try {
        const allServers = await listMcpServers()
        const selectedServers = allServers.filter(server => agent.mcpServerIds?.includes(server.id))
        if (selectedServers.length) {
          const emailContext = {
            subject: String(subject || ''),
            text: String(text || ''),
            from: String(fromEmail || from || ''),
            receivedAt
          }
          const results = await Promise.allSettled(selectedServers.map((server: StoredMcpServer) => fetchMcpContext(server, emailContext, { limit: 5 })))
          mcpContexts = results
            .filter((entry): entry is PromiseFulfilledResult<McpContextResult | null> => entry.status === 'fulfilled')
            .map(entry => entry.value)
            .filter((value): value is McpContextResult => Boolean(value))
        }
      } catch (err) {
        console.error('Failed to fetch MCP context', err)
        mcpContexts = []
      }
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

    // Generate AI response using MCP agents
    let aiAnswer: string | null = null
    if (agent && isDomainAllowed) {
      try {
        // Create MCP agent based on agent configuration
        const mcpAgent = createGeneralAgent()

        // Get MCP servers for this agent
        const allServers = await listMcpServers()
        const agentServers = agent.mcpServerIds?.length
          ? allServers.filter(server => agent.mcpServerIds?.includes(server.id))
          : []

        // Process email with MCP agent
        const emailContext = {
          subject: String(subject || ''),
          text: String(text || ''),
          from: String(fromEmail || from || ''),
          receivedAt
        }

        const agentResponse = await mcpAgent.processEmail(
          emailContext,
          agent.prompt || 'You are a helpful AI assistant.',
          agentServers
        )

        if (agentResponse.success && agentResponse.result) {
          aiAnswer = agentResponse.result.trim()
        } else {
          // Fallback to original method if MCP agent fails
          const response = await $fetch<{ ok: boolean, result?: string, error?: string }>(`/api/agents/${agent.id}/respond`, {
            method: 'POST',
            body: {
              subject: String(subject || ''),
              text: String(text || ''),
              from: String(fromEmail || from || ''),
              includeQuote: true,
              maxTokens: 700,
              temperature: 0.4,
              mcpContexts: mcpContexts.map(entry => ({
                serverId: entry.serverId,
                serverName: entry.serverName,
                provider: entry.provider,
                category: entry.category,
                summary: entry.summary
              }))
            }
          })

          if (response.ok && response.result) {
            aiAnswer = response.result.trim()
          }
        }

        // Cleanup MCP agent
        await mcpAgent.cleanup()
      } catch (error) {
        console.error('MCP Agent processing error:', error)
        // Fallback to original method
        try {
          const response = await $fetch<{ ok: boolean, result?: string, error?: string }>(`/api/agents/${agent.id}/respond`, {
            method: 'POST',
            body: {
              subject: String(subject || ''),
              text: String(text || ''),
              from: String(fromEmail || from || ''),
              includeQuote: true,
              maxTokens: 700,
              temperature: 0.4,
              mcpContexts: mcpContexts.map(entry => ({
                serverId: entry.serverId,
                serverName: entry.serverName,
                provider: entry.provider,
                category: entry.category,
                summary: entry.summary
              }))
            }
          })

          if (response.ok && response.result) {
            aiAnswer = response.result.trim()
          }
        } catch {
          // Swallow errors; we still return ok to Mailgun
          aiAnswer = null
        }
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

    // Send reply via Mailgun if we have credentials and a resolvable routing
    let outboundResult: { ok: boolean, id?: string, message?: string, error?: string } = { ok: false }
    if (mailgunKey && fromEmail && toEmail) {
      try {
        const domain = String(toEmail.split('@')[1] || '').trim()
        if (domain) {
          const form = new URLSearchParams()
          form.set('to', fromEmail)
          form.set('subject', `Re: ${String(subject || '').replace(/^Re:\s*/i, '')}`)
          form.set('text', cleanBody)
          form.set('from', `${agent?.name || 'Agent'} <${toEmail}>`)
          form.set('o:tracking', 'no')
          form.set('o:tracking-clicks', 'no')
          form.set('o:tracking-opens', 'no')
          form.set('h:Content-Type', 'text/plain; charset=utf-8')
          form.set('h:MIME-Version', '1.0')
          // Let Mailgun set appropriate transfer encoding for UTF-8

          const url = `https://api.mailgun.net/v3/${encodeURIComponent(domain)}/messages`
          const res: { id?: string, message?: string, status?: string } = await $fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(`api:${mailgunKey}`).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: form.toString()
          }).catch(e => ({ message: String(e), status: 'error' }))

          outboundResult = res?.status === 'error' ? { ok: false, error: res?.message } : { ok: true, id: res?.id, message: res?.message }
        }
      } catch {
        outboundResult = { ok: false }
      }
    }

    // Persist outbound snapshot alongside inbound for auditability
    await agentsStorage.setItem('outbound.json', {
      sentAt: new Date().toISOString(),
      inReplyTo: messageId,
      to: fromEmail || from || '',
      from: toEmail || to || '',
      subject: `Re: ${String(subject || '').replace(/^Re:\s*/i, '')}`,
      text: cleanBody,
      result: outboundResult
    })

    // Write agent activity log entry
    const logKey = 'email:log.json'
    const currentLog: Array<Record<string, unknown>> = (await agentsStorage.getItem<Array<Record<string, unknown>>>(logKey)) || []
    currentLog.push({
      timestamp: new Date().toISOString(),
      type: 'inbound_processed',
      messageId,
      to: toEmail,
      from: fromEmail,
      subject,
      agentId: agent?.id || null,
      usedOpenAI: Boolean(aiAnswer),
      mailgunSent: Boolean(outboundResult?.ok),
      domainFiltered: !isDomainAllowed,
      storageInboundKey: inboundKey,
      mcpServerIds: agent?.mcpServerIds || [],
      mcpContextCount: mcpContexts.length
    })
    await agentsStorage.setItem(logKey, currentLog)

    return { ok: true, id: inboundKey }
  } catch {
    // Even on error, Mailgun should receive ok
    return { ok: true }
  }
})
