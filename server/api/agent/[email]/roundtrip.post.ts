export default defineEventHandler(async (event) => {
  try {
    const email = getRouterParam(event, 'email') as string
    if (!email) {
      throw createError({ statusCode: 400, statusMessage: 'Missing agent email' })
    }

    const body = await readBody<{
      from?: string
      to?: string
      subject?: string
      text?: string
      html?: string
      attachments?: Array<{
        filename: string
        base64: string
        mimeType: string
        size: number
      }>
    }>(event)

    const { getAgentByEmail } = await import('../../../features/agent')
    const agent = await getAgentByEmail(email)
    if (!agent) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }

    const { getAgentFullEmail } = await import('../../../utils/agentEmailHelpers')
    const agentFullEmail = await getAgentFullEmail(agent.email, agent.teamId)

    const recipient = String(body?.to || agentFullEmail || '')
    if (!recipient) {
      return { ok: false, error: 'missing_agent_email' }
    }

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

    if (body?.attachments && body.attachments.length > 0) {
      payload.attachments = body.attachments.map((att) => ({
        id: att.filename,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        data: att.base64
      }))
    }

    const base = getRequestURL(event)
    const origin = `${base.protocol}//${base.host}`
    const inboundUrl = `${origin}/api/agent/${agentFullEmail}/inbound`

    const inboundResult = await $fetch<{
      ok: boolean
      messageId?: string
      agentId?: string
      teamId?: string
      conversationId?: string
      attachments?: number
      mcpProcessed?: boolean
      policyAllowed?: boolean
      policyReason?: string
      error?: string
      details?: string
    }>(inboundUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch((e) => ({ ok: false, error: 'inbound_request_failed', details: String(e) }))

    return {
      ok: Boolean(inboundResult?.ok),
      testMessageId: messageId,
      agentEmail: agentFullEmail,
      ...inboundResult
    }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})
