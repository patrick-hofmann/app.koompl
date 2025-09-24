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
  const id = getRouterParam(event, 'id') as string
  const method = getMethod(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  if (method === 'GET') {
    const agent = await storage.getItem<Agent>(`${id}.json`)
    if (!agent) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    return agent
  }

  if (method === 'PUT' || method === 'PATCH') {
    const body = await readBody<Partial<Agent>>(event)
    const existing = await storage.getItem<Agent>(`${id}.json`)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }
    const name = body.name || existing.name
    const updated = {
      ...existing,
      ...body,
      id,
      avatar: body.avatar || generateAvatar(name, body.email, id)
    }
    await storage.setItem(`${id}.json`, updated)
    return updated
  }

  if (method === 'DELETE') {
    await storage.removeItem(`${id}.json`)
    return { ok: true }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
