import type { Agent } from '~/types'
import { listAgents, createAgent, updateAgent, deleteAgent } from '../../features/agent'

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
    const body = await readBody<Partial<Agent>>(event)
    const session = await getUserSession(event)

    const agent = await createAgent({ teamId: session?.team?.id, userId: session?.user?.id }, body)
    return agent
  }

  if (method === 'PUT' || method === 'PATCH') {
    const body = await readBody<Partial<Agent>>(event)
    if (!body.id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing agent id' })
    }

    const agent = await updateAgent(body.id, body)
    if (!agent) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    return agent
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const id = String(query.id || '')
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing id' })
    }

    const success = await deleteAgent(id)
    if (!success) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    return { ok: true }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
