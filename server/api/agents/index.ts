import type { Agent } from '~/types'
import { createAgentStorage, createAgentObject, updateAgentObject } from '../../utils/shared'

export default defineEventHandler(async (event) => {
  const agentStorage = createAgentStorage()
  const method = getMethod(event)

  if (method === 'GET') {
    return await agentStorage.read()
  }

  if (method === 'POST') {
    const body = await readBody<Partial<Agent>>(event)
    const existingAgents = await agentStorage.read()
    const agent = createAgentObject(body, existingAgents.map(a => a.id))
    return await agentStorage.create({ ...agent, multiRoundConfig: body.multiRoundConfig })
  }

  if (method === 'PUT' || method === 'PATCH') {
    const body = await readBody<Partial<Agent>>(event)
    if (!body.id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing agent id' })
    }
    const existing = await agentStorage.findById(body.id)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    const updated = updateAgentObject(existing, body)
    return await agentStorage.update(body.id, { ...updated, multiRoundConfig: body.multiRoundConfig ?? existing.multiRoundConfig })
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const id = String(query.id || '')
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing id' })
    }
    const success = await agentStorage.delete(id)
    if (!success) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    return { ok: true }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
