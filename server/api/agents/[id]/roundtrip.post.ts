export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing id' })
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

    // Use feature function to get agent
    const { getAgent } = await import('../../../features/agent')
    const agent = await getAgent(id)
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

    // Add attachments in Mailgun format if provided
    if (body?.attachments && body.attachments.length > 0) {
      payload.attachments = body.attachments.map((att) => ({
        id: att.filename,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        data: att.base64
      }))
      console.log(`[RoundTrip] Added ${body.attachments.length} attachment(s) to payload`)
    }

    console.log('[RoundTrip] Generated message-id for test:', messageId)

    // Call the agent-specific inbound handler (preferred for testing)
    // This ensures we're testing the exact route that will be used in production
    const base = getRequestURL(event)
    const origin = `${base.protocol}//${base.host}`

    // Use agent-specific inbound route for more direct testing
    const inboundUrl = `${origin}/api/agent/${agentFullEmail}/inbound`
    console.log('[RoundTrip] Calling agent inbound route:', inboundUrl)

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
    }).catch((e) => ({
      ok: false,
      error: 'inbound_request_failed',
      details: String(e)
    }))

    console.log('[RoundTrip] Inbound processing result:', inboundResult)

    // Return the full inbound result with our roundtrip metadata
    return {
      ok: Boolean(inboundResult?.ok),
      testMessageId: messageId, // The message-id we generated for the test
      agentEmail: agentFullEmail,
      ...inboundResult // Spread all data from inbound (messageId, agentId, teamId, conversationId, etc.)
    }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})
