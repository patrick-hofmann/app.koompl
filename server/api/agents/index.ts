import type { Agent } from '~/types'
import {
  createAgentStorage,
  createAgentObject,
  updateAgentObject,
  extractUsername
} from '../../utils/shared'

export default defineEventHandler(async (event) => {
  const agentStorage = createAgentStorage()
  const method = getMethod(event)

  if (method === 'GET') {
    // Get all agents and filter by session teamId
    const session = await getUserSession(event)
    const allAgents = await agentStorage.read()

    // Filter agents by current team
    if (session?.team?.id) {
      return allAgents.filter((agent) => agent.teamId === session.team?.id)
    }

    // If no team, return all (for super admin)
    return allAgents
  }

  if (method === 'POST') {
    const body = await readBody<Partial<Agent>>(event)
    const session = await getUserSession(event)

    const existingAgents = await agentStorage.read()

    // Auto-assign teamId from session if not provided
    const teamId = body.teamId || session?.team?.id

    // For predefined agents, check if already exists and use the provided ID
    let agent: Agent
    if (body.isPredefined && body.id) {
      // Check if predefined agent already exists
      const existing = existingAgents.find((a) => a.id === body.id)
      if (existing) {
        throw createError({ statusCode: 409, statusMessage: 'Predefined agent already exists' })
      }
      // Use the provided ID and username for predefined agents
      const username = body.email ? extractUsername(body.email) : body.id
      agent = {
        id: body.id,
        name: body.name || '',
        email: username, // Store only username
        role: body.role || 'Agent',
        prompt: body.prompt || '',
        avatar: body.avatar,
        mcpServerIds: body.mcpServerIds || [],
        isPredefined: true
      }
    } else {
      // For custom agents, generate ID and extract username
      agent = createAgentObject(
        body,
        existingAgents.map((a) => a.id)
      )
    }

    return await agentStorage.create({
      ...agent,
      multiRoundConfig: body.multiRoundConfig,
      teamId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
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
    return await agentStorage.update(body.id, {
      ...updated,
      multiRoundConfig: body.multiRoundConfig ?? existing.multiRoundConfig,
      teamId: body.teamId ?? existing.teamId,
      updatedAt: new Date().toISOString()
    })
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const id = String(query.id || '')
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing id' })
    }

    // Check if agent exists
    const agent = await agentStorage.findById(id)
    if (!agent) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }

    // Predefined agents can be deleted (they will just be "disabled")
    // No special restriction here, as deleting a predefined agent is how we "disable" it

    const success = await agentStorage.delete(id)
    if (!success) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    return { ok: true }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
