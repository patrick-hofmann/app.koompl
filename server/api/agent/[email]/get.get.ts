import { getAgentByEmail } from '~~/server/features/agent'

export default defineEventHandler(async (event) => {
  const email = getRouterParam(event, 'email') as string
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Missing agent email' })
  }

  const agent = await getAgentByEmail(email)
  if (!agent) {
    throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
  }

  return agent
})
