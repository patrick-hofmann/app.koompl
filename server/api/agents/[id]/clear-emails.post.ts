/**
 * Clear all emails for a specific agent
 * This will remove all inbound and outbound emails for the agent
 */

import { clearAgentEmails } from '../../../features/mail'

export default defineEventHandler(async (event) => {
  try {
    const agentId = getRouterParam(event, 'id')
    if (!agentId) {
      throw createError({ statusCode: 400, statusMessage: 'Agent ID is required' })
    }

    // Clear all emails for this agent
    const result = await clearAgentEmails({ agentId })

    return {
      ok: true,
      message: `Cleared ${result.deletedCount} emails for agent ${agentId}`,
      deletedCount: result.deletedCount
    }
  } catch (error) {
    console.error('Error clearing agent emails:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to clear emails: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
