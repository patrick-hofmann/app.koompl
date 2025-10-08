export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing id' })
    }

    const agentsStorage = useStorage('agents')

    const body = await readBody<{
      from?: string
      to?: string
      subject?: string
      text?: string
      html?: string
    }>(event)

    const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
    const agent = agents.find((a) => a?.id === id)
    if (!agent) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }

    // Construct full email from username + team domain
    const { getAgentFullEmail } = await import('../../../utils/agentEmailHelpers')
    const agentFullEmail = await getAgentFullEmail(agent.email, agent.teamId)

    // Build a synthetic Mailgun-like inbound payload targeting this agent's address unless overridden
    const recipient = String(body?.to || agentFullEmail || '')
    if (!recipient) {
      return { ok: false, error: 'missing_agent_email' }
    }

    // Generate a unique message-id for this test email
    const messageId = `roundtrip-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`

    const payload: Record<string, unknown> = {
      recipient,
      From: String(body?.from || 'Tester <tester@example.com>'),
      Subject: String(body?.subject || 'Round-trip test'),
      'stripped-text': String(body?.text || 'This is a round-trip test.'),
      'stripped-html': String(body?.html || ''),
      'Message-Id': messageId,
      'message-id': messageId
    }

    console.log('[RoundTrip] Generated message-id for test:', messageId)

    // Call the agent-specific inbound handler (preferred for testing)
    // This ensures we're testing the exact route that will be used in production
    const base = getRequestURL(event)
    const origin = `${base.protocol}//${base.host}`

    // Use agent-specific inbound route for more direct testing
    const inboundUrl = `${origin}/api/agent/${agentFullEmail}/inbound`
    console.log('[RoundTrip] Calling agent inbound route:', inboundUrl)

    const res = await $fetch<{
      ok: boolean
      flowId?: string
      newFlow?: boolean
      resumed?: boolean
    }>(inboundUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch((e) => ({ ok: false, error: String(e) }) as unknown as { ok: boolean })

    // Read the latest outbound snapshot for convenience feedback
    const outbound = (await agentsStorage.getItem<Record<string, unknown>>('outbound.json')) || null

    console.log('[RoundTrip] Inbound processing result:', res)

    const typedRes = res as unknown as {
      ok: boolean
      flowId?: string
      newFlow?: boolean
      resumed?: boolean
      error?: string
    }

    return {
      ok: Boolean(typedRes?.ok),
      messageId,
      flowId: typedRes?.flowId,
      newFlow: typedRes?.newFlow,
      resumed: typedRes?.resumed,
      agentEmail: agentFullEmail,
      outbound,
      error: typedRes?.error
    }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})
