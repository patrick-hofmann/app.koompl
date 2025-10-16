import { getAgentEmails } from '../../../features/mail'
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
  const type = String(query.type || 'all')
  const limit = Math.min(Math.max(parseInt(String(query.limit || '50'), 10) || 50, 1), 200)

  const emails = await getAgentEmails({ agentId: agent.id })
  const incoming = emails.incoming.slice(0, limit)
  const outgoing = emails.outgoing.slice(0, limit)

  if (type === 'incoming') return { incoming, outgoing: [] }
  if (type === 'outgoing') return { incoming: [], outgoing }
  return { incoming, outgoing }
})
