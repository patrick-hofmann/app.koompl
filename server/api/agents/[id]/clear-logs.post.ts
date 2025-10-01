/**
 * Clear all logs for a specific agent
 * This will remove all activity logs (MCP, AI, Email) for the agent
 */

export default defineEventHandler(async event => {
  try {
    const agentId = getRouterParam(event, 'id')
    if (!agentId) {
      throw createError({ statusCode: 400, statusMessage: 'Agent ID is required' })
    }

    const { agentLogger } = await import('../../../utils/agentLogging')
    const { mailStorage } = await import('../../../utils/mailStorage')

    // Clear all logs for this agent
    const mailLogsResult = await mailStorage.clearAgentLogs(agentId)
    const activityLogsResult = await agentLogger.clearAgentLogs(agentId)

    const totalDeleted = mailLogsResult.deletedCount + activityLogsResult.deletedCount

    return {
      ok: true,
      message: `Cleared ${totalDeleted} logs for agent ${agentId}`,
      deletedCount: totalDeleted,
      mailLogs: mailLogsResult.deletedCount,
      activityLogs: activityLogsResult.deletedCount
    }
  } catch (error) {
    console.error('Error clearing agent logs:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to clear logs: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
