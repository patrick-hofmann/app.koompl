export default defineEventHandler(async event => {
  try {
    const id = getRouterParam(event, 'id') as string
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing id' })
    }

    const agentsStorage = useStorage('agents')

    const body = await readBody<{
      from?: string;
      to?: string;
      subject?: string;
      text?: string;
      html?: string
    }>(event)

    const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
    const agent = agents.find(a => a?.id === id)
    if (!agent) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }

    // Build a synthetic Mailgun-like inbound payload targeting this agent's address unless overridden
    const recipient = String(body?.to || agent.email || '')
    if (!recipient) {
      return { ok: false, error: 'missing_agent_email' }
    }

    const payload: Record<string, unknown> = {
      recipient,
      'From': String(body?.from || 'Tester <tester@example.com>'),
      'Subject': String(body?.subject || 'Round-trip test'),
      'stripped-text': String(body?.text || 'This is a round-trip test.'),
      'stripped-html': String(body?.html || '')
    }

    // Call the existing inbound handler as if Mailgun posted to it
    // We cannot directly import event handler; instead we post to the same route
    const base = getRequestURL(event)
    const origin = `${base.protocol}//${base.host}`

    const res = await $fetch<{ ok: boolean; id?: string }>(`${origin}/api/mailgun/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(e => ({ ok: false, error: String(e) } as unknown as { ok: boolean }))

    // Read the latest outbound snapshot for convenience feedback
    const outbound = (await agentsStorage.getItem<Record<string, unknown>>('outbound.json')) || null

    return { ok: Boolean((res as unknown as { ok: boolean })?.ok), inboundSavedId: (res as unknown as { id?: string })?.id, outbound }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})
