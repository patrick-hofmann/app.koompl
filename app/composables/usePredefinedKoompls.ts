import type { Agent } from '~/types'

export interface PredefinedKoompl {
  id: string
  name: string
  email: string
  role: string
  prompt: string
  description: string
  icon: string
  color: string
  mcpServerIds: string[]
  multiRoundConfig: {
    enabled: boolean
    maxRounds: number
    timeoutMinutes: number
    canCommunicateWithAgents: boolean
    allowedAgentEmails: string[]
    autoResumeOnResponse: boolean
  }
}

export const PREDEFINED_KOOMPLS: PredefinedKoompl[] = [
  {
    id: 'chris-coordinator',
    name: 'Chris Coordinator',
    email: 'chris',
    role: 'Coordinator',
    description: 'Knows all active Koompls and delegates mails to the right specialist',
    icon: 'i-lucide-users-round',
    color: 'blue',
    prompt: '',
    mcpServerIds: [],
    multiRoundConfig: {
      enabled: true,
      maxRounds: 10,
      timeoutMinutes: 60,
      canCommunicateWithAgents: true,
      allowedAgentEmails: [],
      autoResumeOnResponse: true
    }
  },
  {
    id: 'cassy-calendar',
    name: 'Cassy Calendar',
    email: 'cassy',
    role: 'Calendar Manager',
    description: 'Manages your calendar and schedules appointments using the built-in calendar',
    icon: 'i-lucide-calendar',
    color: 'green',
    prompt: '',
    mcpServerIds: ['builtin-calendar'],
    multiRoundConfig: {
      enabled: true,
      maxRounds: 5,
      timeoutMinutes: 30,
      canCommunicateWithAgents: false,
      allowedAgentEmails: [],
      autoResumeOnResponse: true
    }
  },
  {
    id: 'tracy-task',
    name: 'Tracy Task',
    email: 'tracy',
    role: 'Task Manager',
    description: 'Manages your taskboard and helps organize projects using the built-in kanban',
    icon: 'i-lucide-kanban-square',
    color: 'purple',
    prompt: '',
    mcpServerIds: ['builtin-kanban'],
    multiRoundConfig: {
      enabled: true,
      maxRounds: 5,
      timeoutMinutes: 30,
      canCommunicateWithAgents: false,
      allowedAgentEmails: [],
      autoResumeOnResponse: true
    }
  }
]

export function usePredefinedKoompls() {
  function getPredefinedKoompls() {
    return PREDEFINED_KOOMPLS
  }

  function getPredefinedKoompl(id: string) {
    return PREDEFINED_KOOMPLS.find((k) => k.id === id)
  }

  function predefinedToAgent(predefined: PredefinedKoompl, teamId?: string): Partial<Agent> {
    return {
      id: predefined.id,
      name: predefined.name,
      email: predefined.email,
      role: predefined.role,
      // Intentionally empty; server overlays authoritative prompt
      prompt: '',
      mcpServerIds: predefined.mcpServerIds,
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
          mcpServerIds: string[]
          multiRoundConfig: any
          prompt: string
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
              mcpServerIds: s.mcpServerIds || k.mcpServerIds,
              multiRoundConfig: s.multiRoundConfig || k.multiRoundConfig,
              // Populate prompt for UI display only
              prompt: s.prompt || k.prompt
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
    predefinedToAgent,
    getPredefinedKoomplsMerged,
    isPredefinedEnabled
  }
}
