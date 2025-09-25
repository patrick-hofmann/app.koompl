import { nanoid } from 'nanoid'
import { createHash } from 'node:crypto'

function generateAvatar(name: string, email: string | undefined, id: string) {
  const basis = email || name || id
  const hash = createHash('sha256').update(basis).digest('hex').slice(0, 16)
  const seed = encodeURIComponent(hash)
  // Use Pravatar for person-like avatars, deterministic via seed
  const src = `https://i.pravatar.cc/256?u=${seed}`
  const text = (name.split(' ').filter(w => w).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'AG').padEnd(2, (name[0] || 'A').toUpperCase())
  return { src, alt: name, text }
}

export default defineEventHandler(async (event) => {
  const storage = useStorage('agents')
  const prefix = 'agents'
  const collectionKey = `${prefix}.json`
  const method = getMethod(event)

  async function readAgents(): Promise<Agent[]> {
    const list = await storage.getItem<Agent[]>(collectionKey)
    return Array.isArray(list) ? list : []
  }

  async function writeAgents(agents: Agent[]): Promise<void> {
    await storage.setItem(collectionKey, agents)
  }

  if (method === 'GET') {
    // List all agents from single collection
    const agents = await readAgents()
    return agents
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
    const existingAgents = await readAgents()
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
      avatar: body.avatar || generateAvatar(name, body.email, id)
    }
    const updatedAgents = [...existingAgents, agent]
    await writeAgents(updatedAgents)
    return agent
  }

  if (method === 'PUT' || method === 'PATCH') {
    const body = await readBody<Partial<Agent>>(event)
    if (!body.id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing agent id' })
    }
    const agents = await readAgents()
    const idx = agents.findIndex(a => a?.id === body.id)
    if (idx === -1) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    const existing = agents[idx]
    const updated = { ...existing, ...body }
    agents.splice(idx, 1, updated as Agent)
    await writeAgents(agents)
    return updated
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const id = String(query.id || '')
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing id' })
    }
    const agents = await readAgents()
    const next = agents.filter(a => a?.id !== id)
    await writeAgents(next)
    return { ok: true }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
