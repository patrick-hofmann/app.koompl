import { agentLogger } from '../../../utils/agentLogging'
import { getAgentByEmail } from '../../../features/agent'

export default defineEventHandler(async (event) => {
  const email = getRouterParam(event, 'email') as string
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Missing agent email' })
  }

  const agent = await getAgentByEmail(email)
  if (!agent) {
    throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
  }

  const query = getQuery(event)
  const type = String(query.type || 'all') as 'all' | 'mcp_usage' | 'ai_usage' | 'email_activity'
  const limit = Math.min(Math.max(parseInt(String(query.limit || '100'), 10) || 100, 1), 500)

  let logs
  if (type === 'all') {
    logs = await agentLogger.getAgentLogs(agent.id, limit)
  } else {
    const allLogs = await agentLogger.getAgentLogs(agent.id, limit * 2)
    logs = allLogs.filter((log) => log.type === type).slice(0, limit)
  }

  return { ok: true, email, agentId: agent.id, type, count: logs.length, logs }
})
