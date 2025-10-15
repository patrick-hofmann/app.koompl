import type { AgentConfigHierarchy } from './app/types/agents.config'

/**
 * Agent Configuration - Hierarchical Structure
 * Pure configuration file with no execution behavior
 */
export const agentConfig: AgentConfigHierarchy = {
  predefined: {
    general: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 8000,
      max_steps: 5,
      mcp_servers: ['builtin-email'] as const,
      system_prompt:
        'This is the general system prompt for all agents. It is prepended to the system prompt of each agent.'
    },
    agents: {
      'chris-coordinator': {
        id: 'chris-coordinator',
        name: 'Chris Coordinator',
        email: 'chris',
        role: 'Coordinator',
        description: 'Knows all active Koompls and delegates mails to the right specialist',
        short_description: 'Knows all active Koompls and delegates mails to the right specialist',
        long_description:
          'You are Chris Coordinator, the central coordination agent for the Koompl team. Your role is to help customers by gathering information from specialized agents.',
        system_prompt: `You are Chris Coordinator, the central coordination agent for the Koompl team.

Your role is triage and delegation only.

Core rules:
- You do NOT execute operational work yourself (no calendar/task/tool actions).
- Your primary task is to forward the request to the correct specialist agent(s).
- Prefer WAIT_FOR_AGENT over COMPLETE, unless you are only summarizing final outcomes after all needed agents have responded.
- If a request spans multiple domains (e.g., calendar and kanban), forward sequentially to each appropriate agent in separate rounds.
- After receiving the required responses from the contacted agent(s), synthesize a brief final answer to the original user and then COMPLETE.
- Keep messages concise and professional.`,
        icon: 'i-lucide-users-round',
        color: 'blue',
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 8000,
        max_steps: 5,
        mcp_servers: ['builtin-agents', 'builtin-email'],
        multiRoundConfig: {}
      },
      'cassy-calendar': {
        id: 'cassy-calendar',
        name: 'Cassy Calendar',
        email: 'cassy',
        role: 'Calendar Manager',
        description: 'Manages your calendar and schedules appointments using the built-in calendar',
        short_description:
          'Manages your calendar and schedules appointments using the built-in calendar',
        long_description:
          'You are Cassy Calendar, the calendar management specialist. Your role is to manage your calendar and schedules appointments using the built-in calendar.',
        system_prompt: `You are Cassy Calendar, the calendar management specialist.

Use calendar tools to manage events precisely. Confirm changes with clear ISO-8601 dates/times.`,
        icon: 'i-lucide-calendar',
        color: 'green',
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 8000,
        max_steps: 5,
        mcp_servers: ['builtin-email', 'builtin-calendar'],
        multiRoundConfig: {}
      },
      'tracy-task': {
        id: 'tracy-task',
        name: 'Tracy Task',
        email: 'tracy',
        role: 'Task Manager',
        description: 'Manages your taskboard and helps organize projects using the built-in kanban',
        short_description:
          'Manages your taskboard and helps organize projects using the built-in kanban',
        long_description:
          'You are Tracy Task, the task and project management specialist. Your role is to manage tasks and projects using the built-in kanban system.',
        system_prompt: `You are Tracy Task, the task and project management specialist.

Use kanban tools to create/update tasks and keep boards organized. Confirm actions clearly.`,
        icon: 'i-lucide-kanban-square',
        color: 'purple',
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 8000,
        max_steps: 5,
        mcp_servers: ['builtin-email', 'builtin-kanban'],
        multiRoundConfig: {}
      },
      'dara-datasafe': {
        id: 'dara-datasafe',
        name: 'Dara Datasafe',
        email: 'dara',
        role: 'Records Archivist',
        description:
          'Keeps the team datasafe organized, applies storage policies, and files critical documents. Handles email attachments bidirectionally.',
        short_description:
          'Keeps the team datasafe organized, applies storage policies, and files critical documents. Handles email attachments bidirectionally.',
        long_description:
          "You are Dara Datasafe, the team's records archivist. Your role is to manage document storage, apply storage policies, and handle email attachments.",
        system_prompt: `You are Dara Datasafe, the team's records archivist.

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
        icon: 'i-lucide-archive',
        color: 'orange',
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 8000,
        max_steps: 5,
        mcp_servers: ['builtin-email', 'builtin-datasafe'],
        multiRoundConfig: {}
      }
    }
  },
  mcp: {
    servers: {
      'builtin-kanban': '/api/mcp/builtin-kanban',
      'builtin-datasafe': '/api/mcp/builtin-datasafe',
      'builtin-agents': '/api/mcp/builtin-agents',
      'builtin-calendar': '/api/mcp/builtin-calendar',
      'builtin-email': '/api/mcp/builtin-email'
    },
    metadata: {
      'builtin-kanban': {
        id: 'builtin-kanban',
        name: 'Kanban Board',
        provider: 'Builtin',
        category: 'Productivity',
        description: 'Task and project management with kanban boards'
      },
      'builtin-datasafe': {
        id: 'builtin-datasafe',
        name: 'Datasafe',
        provider: 'Builtin',
        category: 'Storage',
        description: 'Secure file storage and document management'
      },
      'builtin-agents': {
        id: 'builtin-agents',
        name: 'Agent Directory',
        provider: 'Builtin',
        category: 'Communication',
        description: 'Inter-agent communication and delegation'
      },
      'builtin-calendar': {
        id: 'builtin-calendar',
        name: 'Calendar',
        provider: 'Builtin',
        category: 'Productivity',
        description: 'Calendar management and event scheduling'
      },
      'builtin-email': {
        id: 'builtin-email',
        name: 'Email',
        provider: 'Builtin',
        category: 'Communication',
        description: 'Email sending and receiving capabilities'
      }
    }
  },
  behavior: {
    emailGuidelines: `Email Guidelines:
- Use reply_to_email and forward_email tools (require message-id)
- Process: 1) Acknowledge request 2) Complete action 3) Send results
- Be professional, concise, direct

File Handling:
- Use copy_email_attachment_to_datasafe for email attachments
- Use datasafe_path references for sending files (e.g., {datasafe_path: "Documents/file.png"})
- NEVER use download_file tool - it causes context overflow
- For file discovery, use these efficient tools:
  * get_recent_files - find latest files by type (image, document, etc.)
  * search_files - search by name, type, or keyword
  * get_file_info - get details about a specific file
  * list_folder - browse folders with enhanced metadata
- All file tools provide size, mimeType, dates, and categories without downloading`
  }
}

export default agentConfig
