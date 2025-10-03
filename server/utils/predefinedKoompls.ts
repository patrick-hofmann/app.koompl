import type { Agent } from '~/types'

type Predef = Pick<Agent, 'id' | 'role' | 'prompt' | 'mcpServerIds' | 'multiRoundConfig'> & {
  description: string
}

const PREDEFINED: Record<string, Predef> = {
  'chris-coordinator': {
    id: 'chris-coordinator',
    role: 'Coordinator',
    description: 'Knows all active Koompls and delegates mails to the right specialist',
    prompt: `You are Chris Coordinator, the central coordination agent for the Koompl team.

Your role is triage and delegation only.

Core rules:
- You do NOT execute operational work yourself (no calendar/task/tool actions).
- Your primary task is to forward the request to the correct specialist agent(s).
- Prefer WAIT_FOR_AGENT over COMPLETE, unless you are only summarizing final outcomes after all needed agents have responded.
- If a request spans multiple domains (e.g., calendar and kanban), forward sequentially to each appropriate agent in separate rounds.
- After receiving the required responses from the contacted agent(s), synthesize a brief final answer to the original user and then COMPLETE.
- Keep messages concise and professional.`,
    mcpServerIds: [],
    multiRoundConfig: {
      enabled: true,
      maxRounds: 10,
      timeoutMinutes: 60,
      canCommunicateWithAgents: true,
      allowedAgentEmails: [],
      autoResumeOnResponse: true
    } as unknown as Agent['multiRoundConfig']
  },
  'cassy-calendar': {
    id: 'cassy-calendar',
    role: 'Calendar Manager',
    description: 'Manages your calendar and schedules appointments using the built-in calendar',
    prompt: `You are Cassy Calendar, the calendar management specialist.

Use calendar tools to manage events precisely. Confirm changes with clear ISO-8601 dates/times.`,
    mcpServerIds: ['builtin-calendar'],
    multiRoundConfig: {
      enabled: true,
      maxRounds: 5,
      timeoutMinutes: 30,
      canCommunicateWithAgents: false,
      allowedAgentEmails: [],
      autoResumeOnResponse: true
    } as unknown as Agent['multiRoundConfig']
  },
  'tracy-task': {
    id: 'tracy-task',
    role: 'Task Manager',
    description: 'Manages your taskboard and helps organize projects using the built-in kanban',
    prompt: `You are Tracy Task, the task and project management specialist.

Use kanban tools to create/update tasks and keep boards organized. Confirm actions clearly.`,
    mcpServerIds: ['builtin-kanban'],
    multiRoundConfig: {
      enabled: true,
      maxRounds: 5,
      timeoutMinutes: 30,
      canCommunicateWithAgents: false,
      allowedAgentEmails: [],
      autoResumeOnResponse: true
    } as unknown as Agent['multiRoundConfig']
  }
}

export function getPredefinedAgentOverride(agent?: Partial<Agent> | null): Partial<Agent> | null {
  if (!agent?.id) return null
  const key = String(agent.id).toLowerCase()
  const predef = PREDEFINED[key]
  if (!predef) return null

  return {
    role: predef.role,
    prompt: predef.prompt,
    mcpServerIds: predef.mcpServerIds,
    multiRoundConfig: predef.multiRoundConfig
  }
}

export function withPredefinedOverride<T extends Agent>(agent: T): T {
  const override = getPredefinedAgentOverride(agent)
  if (!override) return agent
  return { ...agent, ...override }
}

export function getPredefinedPublic(): Array<{
  id: string
  role: string
  description: string
  mcpServerIds: string[]
  multiRoundConfig: Agent['multiRoundConfig']
  prompt: string
}> {
  return Object.values(PREDEFINED).map((p) => ({
    id: p.id,
    role: p.role,
    description: p.description,
    mcpServerIds: p.mcpServerIds,
    multiRoundConfig: p.multiRoundConfig,
    prompt: p.prompt
  }))
}
