/**
 * Get comprehensive logs for a specific agent
 * Includes MCP usage, AI usage, and email activity
 */

import { agentLogger } from '../../../utils/agentLogging'

export default defineEventHandler(async event => {
  const agentId = getRouterParam(event, 'id') as string
  if (!agentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing agent id' })
  }

  const query = getQuery(event)
  const type = String(query.type || 'all') as 'all' | 'mcp_usage' | 'ai_usage' | 'email_activity'
  const limit = Math.min(Math.max(parseInt(String(query.limit || '100'), 10) || 100, 1), 500)

  try {
    let logs
    if (type === 'all') {
      logs = await agentLogger.getAgentLogs(agentId, limit)
    } else {
      const allLogs = await agentLogger.getAgentLogs(agentId, limit * 2)
      logs = allLogs.filter(log => log.type === type).slice(0, limit)
    }

    return {
      ok: true,
      agentId,
      type,
      count: logs.length,
      logs
    }
  } catch (error) {
    console.error('Error fetching agent logs:', error)
    return {
      ok: false,
      agentId,
      type,
      count: 0,
      logs: [],
      error: String(error)
    }
  }
})
