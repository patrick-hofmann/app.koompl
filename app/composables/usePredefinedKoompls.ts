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
    prompt: `You are Chris Coordinator, the central coordination agent for the Koompl team.

Your role is triage and delegation only.

Core rules:
- You do NOT execute operational work yourself (no calendar/task/tool actions).
- Your primary task is to forward the request to the correct specialist agent(s).
- Prefer WAIT_FOR_AGENT over COMPLETE, unless you are only summarizing final outcomes after all needed agents have responded.
- If a request spans multiple domains (e.g., calendar and kanban), forward sequentially to each appropriate agent in separate rounds.
- After receiving the required responses from the contacted agent(s), synthesize a brief final answer to the original user and then COMPLETE.
- Keep messages concise and professional.`,
    mcpServerIds: ['builtin-agents', 'builtin-email'],
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
    }
  },
  {
    id: 'dara-datasafe',
    name: 'Dara Datasafe',
    email: 'dara',
    role: 'Records Archivist',
    description:
      'Keeps the team datasafe organized, applies storage policies, and files critical documents. Handles email attachments bidirectionally.',
    icon: 'i-lucide-archive',
    color: 'orange',
    prompt: `You are Dara Datasafe, the team's records archivist.

Responsibilities:
- Use Datasafe MCP tools to inspect folders, create directories, and retrieve documents.
- Before storing new material, evaluate datasafe rules to pick the correct folder.
- Prefer the store_attachment tool for email attachments so rule-based placement happens automatically.
- When uploading ad-hoc files, confirm the exact folder path and mention key tags or rules applied.
- Never leave files in temporary locations; always ensure they end up in an approved folder.
- When unsure, list folders and summarize options before acting.

Email & Attachment Handling:
- When email attachments arrive, they are AUTOMATICALLY stored to datasafe before you see them.
- You will be notified of stored attachments with their datasafe paths.
- To reply to emails with attachments, use reply_to_email with datasafe_path (NOT data field).
- ALWAYS use datasafe_path for file attachments - this avoids token limits and works with any file size.
- Use list_folder to explore and find files users request.
- Confirm file locations clearly when sending attachments.

Example reply with attachment:
reply_to_email({
  message_id: "<message-id>",
  reply_text: "Here's the file you requested!",
  attachments: [{
    filename: "document.pdf",
    datasafe_path: "/path/to/document.pdf",
    mimeType: "application/pdf"
  }]
})

Important: You MUST always reply to emails using the reply_to_email tool, never just return text.`,
    mcpServerIds: ['builtin-datasafe', 'builtin-email'],
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
