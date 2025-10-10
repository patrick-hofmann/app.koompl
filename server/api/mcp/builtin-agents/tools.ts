import {
  listAgentDirectory,
  getAgentDirectoryEntry,
  findAgentsByCapability
} from '../../../features/agent/directory'

interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

export function getAgentsDirectoryTools(): ToolDefinition[] {
  return [
    {
      name: 'agents_list',
      description:
        'List all agents in the directory with their capabilities and contact information',
      inputSchema: {
        type: 'object',
        properties: {
          teamId: {
            type: 'string',
            description: 'Optional team ID to filter agents'
          }
        }
      }
    },
    {
      name: 'agents_get',
      description: 'Get details about a specific agent by ID or email',
      inputSchema: {
        type: 'object',
        properties: {
          identifier: {
            type: 'string',
            description: 'Agent ID or email to look up'
          },
          teamId: {
            type: 'string',
            description: 'Optional team ID to filter'
          }
        },
        required: ['identifier']
      }
    },
    {
      name: 'agents_find_by_capability',
      description: 'Find agents that have a specific capability',
      inputSchema: {
        type: 'object',
        properties: {
          capability: {
            type: 'string',
            description:
              'Capability to search for (e.g., "calendar_management", "kanban_management")'
          },
          teamId: {
            type: 'string',
            description: 'Optional team ID to filter agents'
          }
        },
        required: ['capability']
      }
    }
  ]
}

export async function executeAgentsDirectoryTool(
  context: { teamId?: string },
  toolName: string,
  args: Record<string, any>
) {
  switch (toolName) {
    case 'agents_list': {
      const agents = await listAgentDirectory(args.teamId || context.teamId)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                agents: agents.map((agent) => ({
                  id: agent.id,
                  name: agent.name,
                  email: agent.fullEmail,
                  role: agent.role,
                  capabilities: agent.capabilities,
                  summary: agent.summary,
                  canDelegate: agent.canDelegate
                }))
              },
              null,
              2
            )
          }
        ]
      }
    }

    case 'agents_get': {
      const agent = await getAgentDirectoryEntry(args.identifier, args.teamId || context.teamId)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                agent: agent
                  ? {
                      id: agent.id,
                      name: agent.name,
                      email: agent.fullEmail,
                      role: agent.role,
                      capabilities: agent.capabilities,
                      summary: agent.summary,
                      description: agent.description,
                      canDelegate: agent.canDelegate,
                      allowedAgents: agent.allowedAgents,
                      mcpServers: agent.mcpServers
                    }
                  : null
              },
              null,
              2
            )
          }
        ]
      }
    }

    case 'agents_find_by_capability': {
      const agents = await findAgentsByCapability(args.capability, args.teamId || context.teamId)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                capability: args.capability,
                agents: agents.map((agent) => ({
                  id: agent.id,
                  name: agent.name,
                  email: agent.fullEmail,
                  role: agent.role,
                  summary: agent.summary
                }))
              },
              null,
              2
            )
          }
        ]
      }
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}
