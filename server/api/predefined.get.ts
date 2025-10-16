import agentConfig from '~~/agents.config'

export default defineEventHandler(async () => {
  try {
    const data = Object.values(agentConfig.predefined.agents).map((agent) => ({
      id: agent.id,
      role: agent.role,
      description: agent.description,
      mcp_servers: agent.mcp_servers,
      system_prompt: agent.system_prompt
    }))
    return { ok: true, data }
  } catch (error) {
    console.error('[API] /api/predefined error:', error)
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
})
