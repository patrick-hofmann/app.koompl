/**
 * Get conversations for a specific agent
 * Returns conversation list with excerpts for inbox view
 */

import { getAgentConversations } from '../../../features/mail'

export default defineEventHandler(async (event) => {
  const agentId = getRouterParam(event, 'id')
  if (!agentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing agent id'
    })
  }

  const query = getQuery(event)
  const limit = Math.min(Math.max(parseInt(String(query.limit || '50'), 10) || 50, 1), 200)

  try {
    // Get conversations from storage
    const conversations = await getAgentConversations({ agentId }, limit)

    console.log(
      `[ConversationsAPI] Found ${conversations.length} conversations for agent ${agentId}`
    )

    return {
      agentId,
      conversations,
      count: conversations.length
    }
  } catch (error) {
    console.error('[ConversationsAPI] Error fetching conversations:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch conversations: ${error instanceof Error ? error.message : String(error)}`
    })
  }
})
