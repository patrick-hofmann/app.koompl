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
    mcpServerIds: ['builtin-agents', 'builtin-email'],
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
  },
  'dara-datasafe': {
    id: 'dara-datasafe',
    role: 'Records Archivist',
    description:
      'Keeps the team datasafe organized, applies storage policies, and files critical documents. Handles email attachments bidirectionally.',
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
