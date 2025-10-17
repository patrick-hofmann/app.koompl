export default defineEventHandler(async (event) => {
  try {
    // Load predefined agents from content files
    console.log('[API] About to call loadPredefinedAgents from predefined.get.ts')
    const { loadPredefinedAgents } = await import('~~/server/features/koompl/predefined')
    const agents = await loadPredefinedAgents(event)

    const data = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      mcp_servers: agent.mcp_servers,
      system_prompt: agent.system_prompt
    }))

    console.log('[API] /api/predefined loaded agents:', data.length)
    return { ok: true, data }
  } catch (error) {
    console.error('[API] /api/predefined error:', error)
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
})
