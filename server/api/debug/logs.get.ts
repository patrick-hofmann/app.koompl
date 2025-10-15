import { getAllLogs } from '../../features/mail'

export default defineEventHandler(async (_event) => {
  try {
    // Get all logs from unified storage
    const allLogs = await getAllLogs()

    // Group by agentId to see what's there
    const logsByAgent = allLogs.reduce(
      (acc, log) => {
        const agentId = log.agentId || 'NO_AGENT_ID'
        if (!acc[agentId]) {
          acc[agentId] = []
        }
        acc[agentId].push(log)
        return acc
      },
      {} as Record<string, typeof allLogs>
    )

    // Get unique agent IDs
    const uniqueAgentIds = Object.keys(logsByAgent)

    // Get agents from storage using feature function
    const { listAgents } = await import('../../features/agent')
    const agents = await listAgents({})
    const existingAgentIds = agents.map((a) => a.id).filter(Boolean)

    return {
      totalLogs: allLogs.length,
      uniqueAgentIds,
      existingAgentIds,
      logsByAgent: Object.fromEntries(
        Object.entries(logsByAgent).map(([agentId, logs]) => [
          agentId,
          {
            count: logs.length,
            types: [...new Set(logs.map((l) => l.type))],
            sample: logs.slice(0, 3).map((l) => ({
              id: l.id,
              type: l.type,
              timestamp: l.timestamp,
              messageId: l.messageId,
              from: l.from,
              to: l.to,
              subject: l.subject
            }))
          }
        ])
      ),
      orphanedLogs: logsByAgent['NO_AGENT_ID'] || [],
      logsWithNonExistentAgents: Object.entries(logsByAgent)
        .filter(([agentId]) => agentId !== 'NO_AGENT_ID' && !existingAgentIds.includes(agentId))
        .map(([agentId, logs]) => ({ agentId, count: logs.length }))
    }
  } catch (error) {
    return { error: String(error) }
  }
})
