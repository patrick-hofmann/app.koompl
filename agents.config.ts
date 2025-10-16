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
    agents: {}
  },
  mcp: {
    servers: {
      'builtin-kanban': '/api/mcp/builtin-kanban',
      'builtin-datasafe': '/api/mcp/builtin-datasafe',
      'builtin-agents': '/api/mcp/builtin-agents',
      'builtin-calendar': '/api/mcp/builtin-calendar',
      'builtin-email': '/api/mcp/builtin-email',
      'builtin-crm': '/api/mcp/builtin-crm',
      'builtin-accounting': '/api/mcp/builtin-accounting',
      'builtin-ticketing': '/api/mcp/builtin-ticketing',
      'builtin-github': '/api/mcp/builtin-github',
      'builtin-monitoring': '/api/mcp/builtin-monitoring',
      'builtin-deployment': '/api/mcp/builtin-deployment',
      'builtin-hr': '/api/mcp/builtin-hr',
      'builtin-social': '/api/mcp/builtin-social',
      'builtin-analytics': '/api/mcp/builtin-analytics',
      'builtin-procurement': '/api/mcp/builtin-procurement',
      'builtin-research': '/api/mcp/builtin-research',
      'builtin-legal': '/api/mcp/builtin-legal'
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
      },
      'builtin-crm': {
        id: 'builtin-crm',
        name: 'CRM',
        provider: 'Builtin',
        category: 'Business',
        description: 'Customer relationship management and sales pipeline tracking'
      },
      'builtin-accounting': {
        id: 'builtin-accounting',
        name: 'Accounting',
        provider: 'Builtin',
        category: 'Finance',
        description: 'Financial management, invoicing, and expense tracking'
      },
      'builtin-ticketing': {
        id: 'builtin-ticketing',
        name: 'Ticketing',
        provider: 'Builtin',
        category: 'Support',
        description: 'Customer support ticket management and issue tracking'
      },
      'builtin-github': {
        id: 'builtin-github',
        name: 'GitHub',
        provider: 'Builtin',
        category: 'Development',
        description: 'Code repository management and pull request workflows'
      },
      'builtin-monitoring': {
        id: 'builtin-monitoring',
        name: 'Monitoring',
        provider: 'Builtin',
        category: 'Infrastructure',
        description: 'System health monitoring and performance metrics'
      },
      'builtin-deployment': {
        id: 'builtin-deployment',
        name: 'Deployment',
        provider: 'Builtin',
        category: 'Infrastructure',
        description: 'Application deployment and CI/CD pipeline management'
      },
      'builtin-hr': {
        id: 'builtin-hr',
        name: 'HR',
        provider: 'Builtin',
        category: 'Human Resources',
        description: 'Employee management, recruitment, and HR processes'
      },
      'builtin-social': {
        id: 'builtin-social',
        name: 'Social Media',
        provider: 'Builtin',
        category: 'Marketing',
        description: 'Social media management and content scheduling'
      },
      'builtin-analytics': {
        id: 'builtin-analytics',
        name: 'Analytics',
        provider: 'Builtin',
        category: 'Business Intelligence',
        description: 'Data analytics, reporting, and business intelligence'
      },
      'builtin-procurement': {
        id: 'builtin-procurement',
        name: 'Procurement',
        provider: 'Builtin',
        category: 'Operations',
        description: 'Purchase order management and vendor coordination'
      },
      'builtin-research': {
        id: 'builtin-research',
        name: 'Research',
        provider: 'Builtin',
        category: 'Business Intelligence',
        description: 'Market research and competitive intelligence'
      },
      'builtin-legal': {
        id: 'builtin-legal',
        name: 'Legal',
        provider: 'Builtin',
        category: 'Compliance',
        description: 'Legal document management and compliance tracking'
      }
    }
  },
  behavior: {
    emailGuidelines: `Email Guidelines:
- Use reply_to_email and forward_email tools (require message-id)
- Prefer a single consolidated reply that includes the final results.
- Only send an acknowledgment separately if results will be delayed or long-running.
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
