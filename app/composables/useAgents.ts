import type { Agent, PredefinedAgent } from '~/types'
import agentConfig from '~~/agents.config'

// Re-export the PredefinedAgent type as PredefinedKoompl for backward compatibility
export type PredefinedKoompl = PredefinedAgent

// Get predefined agents directly from config
export const PREDEFINED_KOOMPLS: PredefinedKoompl[] = Object.values(agentConfig.predefined.agents)

export function useAgents() {
  function getPredefinedKoompls() {
    return PREDEFINED_KOOMPLS
  }

  function getPredefinedKoompl(id: string) {
    return PREDEFINED_KOOMPLS.find((k) => k.id === id)
  }

  function predefinedToAgentConverter(
    predefined: PredefinedKoompl,
    teamId?: string
  ): Partial<Agent> {
    return {
      id: predefined.id,
      name: predefined.name,
      email: predefined.email,
      role: predefined.role,
      prompt: predefined.system_prompt,
      mcpServerIds: predefined.mcp_servers,
      multiRoundConfig: predefined.multiRoundConfig,
      isPredefined: true,
      teamId
    }
  }

  async function getPredefinedKoomplsMerged() {
    try {
      const res = await $fetch<{
        ok: boolean
        data?: Array<{
          id: string
          role: string
          description: string
          mcp_servers: string[]
          multiRoundConfig: any
          system_prompt: string
        }>
      }>('/api/predefined')
      if (!res?.ok || !Array.isArray(res.data)) return PREDEFINED_KOOMPLS

      const map = new Map(res.data.map((p) => [p.id, p]))
      return PREDEFINED_KOOMPLS.map((k) => {
        const s = map.get(k.id)
        return s
          ? {
              ...k,
              role: s.role || k.role,
              description: s.description || k.description,
              mcp_servers: s.mcp_servers || k.mcp_servers,
              multiRoundConfig: s.multiRoundConfig || k.multiRoundConfig,
              // Populate system_prompt for UI display only
              system_prompt: s.system_prompt || k.system_prompt
            }
          : k
      })
    } catch {
      return PREDEFINED_KOOMPLS
    }
  }

  function isPredefinedEnabled(predefinedId: string, agents: Agent[]) {
    return agents.some((agent) => agent.id === predefinedId && agent.isPredefined)
  }

  return {
    getPredefinedKoompls,
    getPredefinedKoompl,
    predefinedToAgent: predefinedToAgentConverter,
    getPredefinedKoomplsMerged,
    isPredefinedEnabled
  }
}
