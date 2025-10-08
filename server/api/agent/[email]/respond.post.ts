interface AgentEmailRequest {
  subject?: string
  text?: string
  from?: string
  includeQuote?: boolean
  userId?: string
  messageId?: string
  files?: Array<{
    base64: string
    mimeType: string
    type?: 'image' | 'file'
  }>
}

export default defineEventHandler(async (event) => {
  const agentEmail = getRouterParam(event, 'email')

  if (!agentEmail) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing agent email parameter'
    })
  }

  // Parse the request body
  const body = await readBody<AgentEmailRequest>(event)

  if (!body || !body.text) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required field: text'
    })
  }

  // Build the user prompt from email content
  const includeQuote = body.includeQuote ?? true
  const subject = body.subject || 'No Subject'
  const from = body.from || 'Unknown Sender'
  const text = body.text || ''

  // Generate or use provided message-id
  const messageId = body.messageId || `test-${Date.now()}-${Math.random().toString(36).slice(2)}`

  console.log('[AgentRespond] Storing email before processing:', {
    agentEmail,
    from,
    subject,
    messageId
  })

  // Store email in storage so AI can use reply_to_email
  try {
    const { mailStorage } = await import('../../../utils/mailStorage')

    await mailStorage.storeInboundEmail({
      messageId,
      from,
      to: agentEmail,
      subject,
      body: text,
      agentId: undefined, // Will be resolved later
      agentEmail,
      inReplyTo: [],
      references: [],
      mcpContexts: []
    })

    console.log('[AgentRespond] ✓ Email stored with message-id:', messageId)
  } catch (storeError) {
    console.error('[AgentRespond] Failed to store email:', storeError)
    // Continue anyway
  }

  let userPrompt = `You received an email with the following details:

From: ${from}
Subject: ${subject}

Message:
${text}

MESSAGE-ID: ${messageId}

To reply to this email, use: reply_to_email with message_id="${messageId}" and your reply_text

Please generate a professional and helpful email response using the reply_to_email tool.`

  if (includeQuote) {
    userPrompt += `\n\nThe system will automatically quote the original message.`
  }

  console.log('[AgentRespond] Forwarding to prompt endpoint:', {
    agentEmail,
    from,
    subject,
    messageId,
    hasFiles: !!body.files && body.files.length > 0
  })

  // Call the prompt endpoint to do the actual work (use event.$fetch to preserve session)
  const result = await event.$fetch(`/api/agent/${agentEmail}/prompt`, {
    method: 'POST',
    body: {
      userPrompt,
      userId: body.userId,
      files: body.files
    }
  })

  // Enhance the response with email context
  return {
    ...result,
    emailContext: {
      from,
      subject,
      originalText: text
    }
  }
})
