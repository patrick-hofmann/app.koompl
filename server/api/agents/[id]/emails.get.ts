import { mailStorage } from '../../../utils/mailStorage'

export default defineEventHandler(async event => {
  const agentId = getRouterParam(event, 'id') as string
  if (!agentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing agent id' })
  }

  const query = getQuery(event)
  const type = String(query.type || 'all') // 'incoming', 'outgoing', or 'all'
  const limit = Math.min(Math.max(parseInt(String(query.limit || '50'), 10) || 50, 1), 200)

  try {
    // Use unified mail storage to get agent emails
    const emails = await mailStorage.getAgentEmails(agentId)

    // Apply limit and type filtering
    const incoming = emails.incoming.slice(0, limit)
    const outgoing = emails.outgoing.slice(0, limit)

    if (type === 'incoming') {
      return { incoming, outgoing: [] }
    } else if (type === 'outgoing') {
      return { incoming: [], outgoing }
    } else {
      return { incoming, outgoing }
    }
  } catch (error) {
    console.error('Error fetching agent emails:', error)
    return { incoming: [], outgoing: [] }
  }
})
