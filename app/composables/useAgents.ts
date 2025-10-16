import type { PredefinedAgent } from '~/types'

// Re-export the PredefinedAgent type as PredefinedKoompl for backward compatibility
export type PredefinedKoompl = PredefinedAgent

// Load predefined agents from Nuxt Content 'agents' collection
async function loadPredefinedFromContent(): Promise<PredefinedKoompl[]> {
  // @ts-expect-error injected by @nuxt/content at runtime
  const docs = await queryCollection('agents').all()
  return (docs || []) as PredefinedKoompl[]
}

export function useAgents() {
  async function getPredefinedKoompls() {
    return await loadPredefinedFromContent()
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
      const base = await loadPredefinedFromContent()
      if (!res?.ok || !Array.isArray(res.data)) return base

      const map = new Map(res.data.map((p) => [p.id, p]))
      return base.map((k) => {
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
      return await loadPredefinedFromContent()
    }
  }

  return {
    getPredefinedKoompls,
    getPredefinedKoomplsMerged
  }
}
