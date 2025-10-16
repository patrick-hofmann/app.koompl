import { getAgentByEmail } from '../../../../features/agent'

export default defineEventHandler(async (event) => {
  const email = getRouterParam(event, 'email') as string
  const conversationId = getRouterParam(event, 'conversationId') as string

  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Missing agent email' })
  }

  if (!conversationId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing conversation ID' })
  }

  const agent = await getAgentByEmail(email)
  if (!agent) {
    throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
  }

  // Redirect to the existing conversation endpoint that takes agentId
  const result = await $fetch(`/api/agents/${agent.id}/conversations/${conversationId}`)
  return result
})
