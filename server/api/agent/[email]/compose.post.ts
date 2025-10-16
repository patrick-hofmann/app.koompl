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

  // Redirect to the existing compose endpoint that takes agentId
  const body = await readBody(event)

  // Call the existing compose logic with the resolved agent ID
  const composeResult = await $fetch(`/api/agents/${agent.id}/compose`, {
    method: 'POST',
    body
  })

  return composeResult
})
