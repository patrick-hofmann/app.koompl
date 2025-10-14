/**
 * Get all emails in a specific conversation
 * Returns conversation thread with all messages
 */

import { mailStorage } from '../../../../features/mail/storage'

export default defineEventHandler(async (event) => {
  const agentId = getRouterParam(event, 'id')
  const conversationId = getRouterParam(event, 'conversationId')

  if (!agentId || !conversationId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing agent id or conversation id'
    })
  }

  try {
    // Get all emails in the conversation
    const emails = await mailStorage.getConversationEmails(conversationId, agentId)

    console.log(
      `[ConversationDetailAPI] Found ${emails.length} emails for conversation ${conversationId}`
    )

    // Mark conversation as read
    await mailStorage.markConversationAsRead(agentId, conversationId)

    return {
      conversationId,
      agentId,
      emails,
      count: emails.length
    }
  } catch (error) {
    console.error('[ConversationDetailAPI] Error fetching conversation:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch conversation: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})
