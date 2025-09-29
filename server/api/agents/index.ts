import { nanoid } from 'nanoid'
import type { Agent } from '~/types'
import { generateAvatar, normalizeMcpServerIds, createAgentStorage } from '../../utils/shared'

export default defineEventHandler(async (event) => {
  const agentStorage = createAgentStorage()
  const method = getMethod(event)

  if (method === 'GET') {
    return await agentStorage.read()
  }

  if (method === 'POST') {
    const body = await readBody<Partial<Agent>>(event)
    // Generate a human-readable id (slug) from name when possible, fallback to nanoid
    const baseSlug = (body.name || 'agent')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'agent'
    let id = body.id || baseSlug
    // Ensure uniqueness against existing collection
    const existingAgents = await agentStorage.read()
    if (existingAgents.some(a => a?.id === id)) {
      id = `${baseSlug}-${nanoid(4)}`
    }
    const name = body.name || 'Unnamed'
    const agent: Agent = {
      id,
      name,
      email: body.email || `${id}@agents.local`,
      role: body.role || 'Agent',
      prompt: body.prompt || '',
      avatar: body.avatar || generateAvatar(name, body.email, id),
      mcpServerIds: normalizeMcpServerIds(body.mcpServerIds)
    }
    return await agentStorage.create(agent)
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
    const mcpServerIds = body.mcpServerIds !== undefined
      ? normalizeMcpServerIds(body.mcpServerIds)
      : existing.mcpServerIds || []
    const updated = { ...existing, ...body, mcpServerIds }
    return await agentStorage.update(body.id, updated)
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
