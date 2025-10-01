/**
 * Get comprehensive activity logs across all agents
 * Includes MCP usage, AI usage, and email activity
 */

import { agentLogger } from '../../utils/agentLogging'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const type = String(query.type || 'all') as 'all' | 'mcp_usage' | 'ai_usage' | 'email_activity'
  const limit = Math.min(Math.max(parseInt(String(query.limit || '100'), 10) || 100, 1), 500)

  try {
    let logs
    if (type === 'all') {
      logs = await agentLogger.getRecentLogs(limit)
    } else {
      logs = await agentLogger.getLogsByType(type, limit)
    }

    // Group logs by agent for summary
    const agentSummary = logs.reduce((acc, log) => {
      if (!acc[log.agentId]) {
        acc[log.agentId] = {
          agentId: log.agentId,
          agentEmail: log.agentEmail,
          counts: { mcp_usage: 0, ai_usage: 0, email_activity: 0 },
          lastActivity: log.timestamp
        }
      }
      acc[log.agentId].counts[log.type]++
      if (new Date(log.timestamp) > new Date(acc[log.agentId].lastActivity)) {
        acc[log.agentId].lastActivity = log.timestamp
      }
      return acc
    }, {} as Record<string, any>)

    return {
      ok: true,
      type,
      count: logs.length,
      logs,
      agentSummary: Object.values(agentSummary)
    }
  } catch (error) {
    console.error('Error fetching activity logs:', error)
    return {
      ok: false,
      type,
      count: 0,
      logs: [],
      agentSummary: [],
      error: String(error)
    }
  }
})
