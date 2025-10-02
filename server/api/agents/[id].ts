import type { Agent } from '~/types'
import { createAgentStorage, updateAgentObject } from '../../utils/shared'

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
    return agent
  }

  if (method === 'PUT' || method === 'PATCH') {
    const body = await readBody<Partial<Agent>>(event)
    const existing = await agentStorage.findById(id)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }

    const updated = updateAgentObject(existing, body)
    return await agentStorage.update(id, {
      ...updated,
      teamId: body.teamId !== undefined ? body.teamId : existing.teamId,
      updatedAt: new Date().toISOString()
    })
  }

  if (method === 'DELETE') {
    const success = await agentStorage.delete(id)
    if (!success) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    return { ok: true }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
