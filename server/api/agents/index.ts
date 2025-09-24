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
  const method = getMethod(event)

  if (method === 'GET') {
    // List all agents
    const keys = await storage.getKeys('')
    const agents = await Promise.all(keys.map(key => storage.getItem<Agent>(key)))
    return agents.filter(Boolean)
  }

  if (method === 'POST') {
    const body = await readBody<Partial<Agent>>(event)
    // Generate a human-readable id (slug) from name when possible, fallback to nanoid
    const baseSlug = (body.name || 'agent')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'agent'
    let id = body.id || baseSlug
    // Ensure uniqueness
    if (await storage.hasItem(`${id}.json`)) {
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
    await storage.setItem(`${id}.json`, agent)
    return agent
  }

  if (method === 'PUT' || method === 'PATCH') {
    const body = await readBody<Partial<Agent>>(event)
    if (!body.id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing agent id' })
    }
    const existing = await storage.getItem<Agent>(`${body.id}.json`)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    const updated = { ...existing, ...body }
    await storage.setItem(`${existing.id}.json`, updated)
    return updated
  }

  if (method === 'DELETE') {
    const query = getQuery(event)
    const id = String(query.id || '')
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing id' })
    }
    await storage.removeItem(`${id}.json`)
    return { ok: true }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
