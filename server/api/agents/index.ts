import { listAgents } from '../../features/agent'

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  if (method === 'GET') {
    // Get all agents and filter by session teamId
    const session = await getUserSession(event)

    // If no team, return all (for super admin), otherwise filter by team
    const agents = await listAgents({ teamId: session?.team?.id, userId: session?.user?.id })
    return agents
  }

  if (method === 'POST') {
    // Custom agent creation is no longer supported
    throw createError({
      statusCode: 403,
      statusMessage: 'Custom agent creation is not allowed. Only predefined agents are supported.'
    })
  }

  if (method === 'PUT' || method === 'PATCH') {
    // Custom agent updates are no longer supported
    throw createError({
      statusCode: 403,
      statusMessage: 'Custom agent updates are not allowed. Only predefined agents are supported.'
    })
  }

  if (method === 'DELETE') {
    // Custom agent deletion is no longer supported
    throw createError({
      statusCode: 403,
      statusMessage: 'Custom agent deletion is not allowed. Only predefined agents are supported.'
    })
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
