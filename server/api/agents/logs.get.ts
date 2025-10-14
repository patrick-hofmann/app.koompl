import { getAgentLogs, getRecentEmails } from '../../features/mail'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const agentId =
    typeof query.agentId === 'string' && query.agentId.trim().length > 0
      ? query.agentId.trim()
      : undefined
  const limit = Math.min(Math.max(parseInt(String(query.limit || '100'), 10) || 50, 1), 500)

  try {
    const items = agentId ? await getAgentLogs({ agentId }, limit) : await getRecentEmails(limit)

    return {
      ok: true,
      count: items.length,
      items
    }
  } catch (error) {
    console.error('Error fetching logs:', error)
    return {
      ok: false,
      count: 0,
      items: []
    }
  }
})
