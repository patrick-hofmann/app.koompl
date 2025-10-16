import type { PredefinedAgent } from '~/types'

// Re-export the PredefinedAgent type as PredefinedKoompl for backward compatibility
export type PredefinedKoompl = PredefinedAgent

// Load predefined agents from koompl feature
async function loadPredefinedFromContent(): Promise<PredefinedKoompl[]> {
  const { loadPredefinedAgents } = await import('~~/server/features/koompl/predefined')
  return await loadPredefinedAgents()
}

export function useAgents() {
  async function getPredefinedKoompls() {
    return await loadPredefinedFromContent()
  }

  return {
    getPredefinedKoompls
  }
}
