import { clearAgentLogs } from '../../../features/mail'
import { agentLogger } from '../../../utils/agentLogging'
import { getAgentByEmail } from '../../../features/agent'

export default defineEventHandler(async (event) => {
  const email = getRouterParam(event, 'email') as string
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Agent email is required' })
  }

  const agent = await getAgentByEmail(email)
  if (!agent) {
    throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
  }

  const mailLogsResult = await clearAgentLogs({ agentId: agent.id })
  const activityLogsResult = await agentLogger.clearAgentLogs(agent.id)
  const totalDeleted = mailLogsResult.deletedCount + activityLogsResult.deletedCount

  return {
    ok: true,
    message: `Cleared ${totalDeleted} logs for agent ${email}`,
    deletedCount: totalDeleted,
    mailLogs: mailLogsResult.deletedCount,
    activityLogs: activityLogsResult.deletedCount
  }
})
