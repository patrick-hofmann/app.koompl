/**
 * Compose and send email from agent
 * Handles new emails, replies, and forwards
 */

import { getEmail, storeOutboundEmail, createConversationId } from '../../../features/mail'

interface ComposeRequest {
  to: string
  subject: string
  body: string
  type: 'new' | 'reply' | 'forward'
  inReplyTo?: string // message-id if reply/forward
  attachments?: Array<{ filename: string; data: string; mimeType?: string }>
}

export default defineEventHandler(async (event) => {
  const agentId = getRouterParam(event, 'id')
  if (!agentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing agent id'
    })
  }

  const request = await readBody<ComposeRequest>(event)

  // Validate request
  if (!request.to || !request.subject || !request.body) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: to, subject, body'
    })
  }

  try {
    // Get agent details using feature function
    const { getAgent } = await import('../../../features/agent')
    const agent = await getAgent(agentId)

    if (!agent) {
      throw createError({
        statusCode: 404,
        statusMessage: `Agent not found: ${agentId}`
      })
    }

    // Get team details
    const { getIdentity } = await import('../../../features/team/storage')
    const identity = await getIdentity()
    const team = identity.teams.find((t) => t.id === agent.teamId)

    if (!team || !team.domain) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Agent team not found or has no domain configured'
      })
    }

    const agentEmail = `${agent.email}@${team.domain}`

    console.log('[ComposeAPI] Sending email:', {
      agentId,
      agentEmail,
      to: request.to,
      subject: request.subject,
      type: request.type
    })

    // Build threading headers
    let inReplyTo: string | undefined
    let references: string[] = []
    let conversationId: string

    if (request.type === 'reply' && request.inReplyTo) {
      // Load original email to get references
      const originalEmail = await getEmail(request.inReplyTo)
      if (originalEmail) {
        inReplyTo = originalEmail.email.messageId
        references = [
          ...(originalEmail.email.references || []),
          ...(originalEmail.email.inReplyTo || []),
          originalEmail.email.messageId
        ].filter((id): id is string => Boolean(id))

        conversationId =
          originalEmail.email.conversationId ||
          createConversationId(
            originalEmail.email.messageId,
            originalEmail.email.inReplyTo,
            originalEmail.email.references
          )
      } else {
        // Original email not found, treat as new conversation
        conversationId = `new-${Date.now()}-${Math.random().toString(36).slice(2)}`
      }
    } else {
      // New email - create new conversation
      conversationId = `new-${Date.now()}-${Math.random().toString(36).slice(2)}`
    }

    // Send via Mailgun
    const { sendMailgunEmail } = await import('../../../utils/mailgunHelpers')

    // Parse attachments if provided
    const mailgunAttachments = request.attachments?.map((att) => ({
      filename: att.filename,
      data: Buffer.from(att.data, 'base64'),
      contentType: att.mimeType || 'application/octet-stream'
    }))

    const mailgunResult = await sendMailgunEmail({
      from: agentEmail,
      to: request.to,
      subject: request.subject,
      text: request.body,
      inReplyTo,
      references: references.join(' '),
      attachments: mailgunAttachments
    })

    // Store outbound email
    const sentMessageId =
      mailgunResult.id || `sent-${Date.now()}-${Math.random().toString(36).slice(2)}`

    await storeOutboundEmail({
      messageId: sentMessageId,
      from: agentEmail,
      to: request.to,
      subject: request.subject,
      body: request.body,
      agentId: agent.id,
      agentEmail,
      teamId: team.id,
      conversationId,
      inReplyTo,
      references,
      usedOpenAI: false,
      mailgunSent: true,
      isAutomatic: false,
      attachments: request.attachments?.map((att, index) => ({
        id: att.filename || `compose-${index}-${Date.now()}`,
        filename: att.filename,
        mimeType: att.mimeType || 'application/octet-stream',
        size: Buffer.from(att.data, 'base64').length
      }))
    })

    console.log('[ComposeAPI] ✓ Email sent successfully:', sentMessageId)

    return {
      ok: true,
      messageId: sentMessageId,
      conversationId,
      sentAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('[ComposeAPI] Error sending email:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to send email: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})
