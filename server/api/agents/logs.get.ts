export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const agentId = typeof query.agentId === 'string' && query.agentId.trim().length > 0
    ? query.agentId.trim()
    : undefined
  const limit = Math.min(Math.max(parseInt(String(query.limit || '100'), 10) || 50, 1), 500)

  const agentsStorage = useStorage('agents')
  const key = 'email:log.json'
  const all: Array<Record<string, unknown>> = (await agentsStorage.getItem(key)) || []

  // newest first (we push at end in inbound handler)
  const sorted = [...all].reverse()
  const filtered = agentId
    ? sorted.filter(entry => String((entry as Record<string, unknown>)?.agentId || '') === agentId)
    : sorted

  const items = filtered.slice(0, limit)

  return {
    ok: true,
    count: items.length,
    items
  }
})
