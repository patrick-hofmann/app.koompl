import { createHash } from 'node:crypto'

function generateAvatar(name: string, email: string | undefined, id: string) {
  const basis = email || name || id
  const hash = createHash('sha256').update(basis).digest('hex').slice(0, 16)
  const seed = encodeURIComponent(hash)
  const src = `https://i.pravatar.cc/256?u=${seed}`
  const text = (name.split(' ').filter(w => w).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'AG').padEnd(2, (name[0] || 'A').toUpperCase())
  return { src, alt: name, text }
}
export default defineEventHandler(async (event) => {
  const storage = useStorage('agents')
  const prefix = 'agents'
  const collectionKey = `${prefix}.json`
  const id = getRouterParam(event, 'id') as string
  const method = getMethod(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  async function readAgents(): Promise<Agent[]> {
    const list = await storage.getItem<Agent[]>(collectionKey)
    return Array.isArray(list) ? list : []
  }

  async function writeAgents(agents: Agent[]): Promise<void> {
    await storage.setItem(collectionKey, agents)
  }

  if (method === 'GET') {
    const agents = await readAgents()
    const agent = agents.find(a => a?.id === id)
    if (!agent) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    return agent
  }

  if (method === 'PUT' || method === 'PATCH') {
    const body = await readBody<Partial<Agent>>(event)
    const agents = await readAgents()
    const idx = agents.findIndex(a => a?.id === id)
    if (idx === -1) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    const existing = agents[idx]
    const name = body.name || existing.name
    const updated = {
      ...existing,
      ...body,
      id,
      avatar: body.avatar || generateAvatar(name, body.email, id)
    }
    agents.splice(idx, 1, updated as Agent)
    await writeAgents(agents)
    return updated
  }

  if (method === 'DELETE') {
    const agents = await readAgents()
    const next = agents.filter(a => a?.id !== id)
    await writeAgents(next)
    return { ok: true }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
