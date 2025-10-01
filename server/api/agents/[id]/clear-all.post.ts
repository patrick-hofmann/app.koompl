/**
 * Clear all emails and logs for a specific agent
 * This will remove all emails and activity logs for the agent
 */

export default defineEventHandler(async event => {
  try {
    const agentId = getRouterParam(event, 'id')
    if (!agentId) {
      throw createError({ statusCode: 400, statusMessage: 'Agent ID is required' })
    }

    const { mailStorage } = await import('../../../utils/mailStorage')
    const { agentLogger } = await import('../../../utils/agentLogging')

    // Clear all emails and logs for this agent
    const emailsResult = await mailStorage.clearAgentEmails(agentId)
    const mailLogsResult = await mailStorage.clearAgentLogs(agentId)
    const activityLogsResult = await agentLogger.clearAgentLogs(agentId)

    const totalDeleted = emailsResult.deletedCount + mailLogsResult.deletedCount + activityLogsResult.deletedCount

    return {
      ok: true,
      message: `Cleared ${totalDeleted} items for agent ${agentId}`,
      deletedCount: totalDeleted,
      emails: emailsResult.deletedCount,
      mailLogs: mailLogsResult.deletedCount,
      activityLogs: activityLogsResult.deletedCount
    }
  } catch (error) {
    console.error('Error clearing all agent data:', error)
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to clear data: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
  }
})
