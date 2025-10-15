import { createAgentStorage } from '../../utils/shared'

export default defineEventHandler(async (event) => {
  const agentStorage = createAgentStorage()
  const id = getRouterParam(event, 'id') as string
  const method = getMethod(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  if (method === 'GET') {
    const agent = await agentStorage.findById(id)
    if (!agent) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    // Only return predefined agents
    if (!agent.isPredefined) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    return agent
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
