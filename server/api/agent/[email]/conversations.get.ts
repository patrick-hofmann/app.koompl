import { getAgentConversations } from '../../../features/mail'
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
  const limit = Math.min(Math.max(parseInt(String(query.limit || '50'), 10) || 50, 1), 200)

  const conversations = await getAgentConversations({ agentId: agent.id }, limit)
  return { email, agentId: agent.id, conversations, count: conversations.length }
})
