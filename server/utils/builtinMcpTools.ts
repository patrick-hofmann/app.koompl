/**
 * Built-in MCP Tools Executor
 *
 * Provides direct tool execution for builtin MCP servers without HTTP overhead.
 * This is production-ready and works on edge servers.
 */

import {
  listBoards,
  getBoardByIdOrName,
  listCards,
  createCard,
  modifyCard,
  moveCardToColumn,
  removeCard,
  searchCards,
  getCardsByAssignee,
  type KanbanMcpContext
} from './mcpKanban'
import {
  listAgentDirectory,
  getAgentDirectoryEntry,
  findAgentsByCapability,
  listDirectoryCapabilities
} from './mcpAgents'

export interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, any>
    required?: string[]
    additionalProperties?: boolean
  }
}

export interface McpToolResult {
  content: Array<{
    type: string
    text: string
  }>
  isError?: boolean
}

/**
 * Get all available Kanban tools
 */
export function getKanbanTools(): McpTool[] {
  return [
    {
      name: 'list_boards',
      description: 'List all available Kanban boards for the team',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false
      }
    },
    {
      name: 'get_board',
      description: 'Get details of a specific board by ID or name',
      inputSchema: {
        type: 'object',
        properties: {
          boardIdOrName: {
            type: 'string',
            description: 'Board ID or name to retrieve'
          }
        },
        required: ['boardIdOrName'],
        additionalProperties: false
      }
    },
    {
      name: 'list_cards',
      description: 'List all cards from a specific board, optionally filtered by column',
      inputSchema: {
        type: 'object',
        properties: {
          boardIdOrName: {
            type: 'string',
            description: 'Board ID or name to list cards from'
          },
          columnIdOrName: {
            type: 'string',
            description: 'Optional column ID or name to filter cards'
          }
        },
        required: ['boardIdOrName'],
        additionalProperties: false
      }
    },
    {
      name: 'create_card',
      description: 'Create a new card on a board',
      inputSchema: {
        type: 'object',
        properties: {
          boardIdOrName: { type: 'string', description: 'Board ID or name' },
          columnIdOrName: { type: 'string', description: 'Column ID or name' },
          title: { type: 'string', description: 'Card title' },
          description: { type: 'string', description: 'Card description' },
          assignee: { type: 'string', description: 'Assignee name or ID' },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Card priority'
          }
        },
        required: ['boardIdOrName', 'columnIdOrName', 'title'],
        additionalProperties: false
      }
    },
    {
      name: 'modify_card',
      description: 'Modify an existing card',
      inputSchema: {
        type: 'object',
        properties: {
          cardId: { type: 'string', description: 'ID of the card to modify' },
          title: { type: 'string', description: 'New card title' },
          description: { type: 'string', description: 'New card description' },
          assignee: { type: 'string', description: 'New assignee' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'New priority' }
        },
        required: ['cardId'],
        additionalProperties: false
      }
    },
    {
      name: 'move_card',
      description: 'Move a card to a different column',
      inputSchema: {
        type: 'object',
        properties: {
          cardId: { type: 'string', description: 'ID of the card to move' },
          targetColumnIdOrName: { type: 'string', description: 'Target column ID or name' }
        },
        required: ['cardId', 'targetColumnIdOrName'],
        additionalProperties: false
      }
    },
    {
      name: 'remove_card',
      description: 'Remove a card from the board',
      inputSchema: {
        type: 'object',
        properties: {
          boardIdOrName: { type: 'string', description: 'Board ID or name' },
          cardId: { type: 'string', description: 'ID of the card to remove' }
        },
        required: ['boardIdOrName', 'cardId'],
        additionalProperties: false
      }
    },
    {
      name: 'search_cards',
      description: 'Search for cards by query string',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          boardIdOrName: {
            type: 'string',
            description: 'Optional board ID or name to search within'
          }
        },
        required: ['query'],
        additionalProperties: false
      }
    },
    {
      name: 'get_cards_by_assignee',
      description: 'Get all cards assigned to a specific person',
      inputSchema: {
        type: 'object',
        properties: {
          assignee: { type: 'string', description: 'Assignee name or ID' },
          boardIdOrName: { type: 'string', description: 'Optional board ID or name to filter by' }
        },
        required: ['assignee'],
        additionalProperties: false
      }
    }
  ]
}

/**
 * Get all available Calendar tools
 */
export function getCalendarTools(): McpTool[] {
  return [
    {
      name: 'list_events',
      description: 'List calendar events, optionally filtered by date range and/or user',
      inputSchema: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date in ISO 8601 format' },
          endDate: { type: 'string', description: 'End date in ISO 8601 format' },
          userId: { type: 'string', description: 'Filter events by user ID' }
        },
        required: [],
        additionalProperties: false
      }
    },
    {
      name: 'get_event',
      description: 'Get details of a specific calendar event by ID',
      inputSchema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'Event ID to retrieve' }
        },
        required: ['eventId'],
        additionalProperties: false
      }
    },
    {
      name: 'create_event',
      description: 'Create a new calendar event',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title' },
          description: { type: 'string', description: 'Event description' },
          startDate: { type: 'string', description: 'Start date and time in ISO 8601 format' },
          endDate: { type: 'string', description: 'End date and time in ISO 8601 format' },
          allDay: { type: 'boolean', description: 'Whether this is an all-day event' },
          location: { type: 'string', description: 'Event location' },
          color: { type: 'string', description: 'Event color (hex code)' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Event tags' }
        },
        required: ['title', 'startDate', 'endDate'],
        additionalProperties: false
      }
    },
    {
      name: 'modify_event',
      description: 'Update an existing calendar event (only the event owner can modify)',
      inputSchema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'ID of the event to modify' },
          title: { type: 'string', description: 'New event title' },
          description: { type: 'string', description: 'New event description' },
          startDate: { type: 'string', description: 'New start date and time' },
          endDate: { type: 'string', description: 'New end date and time' },
          allDay: { type: 'boolean', description: 'Whether this is an all-day event' },
          location: { type: 'string', description: 'New event location' },
          color: { type: 'string', description: 'New event color' }
        },
        required: ['eventId'],
        additionalProperties: false
      }
    },
    {
      name: 'remove_event',
      description: 'Delete a calendar event (only the event owner can delete)',
      inputSchema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'ID of the event to remove' }
        },
        required: ['eventId'],
        additionalProperties: false
      }
    },
    {
      name: 'search_events',
      description: 'Search for events by title, description, location, or tags',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          userId: { type: 'string', description: 'Optional user ID to limit search' }
        },
        required: ['query'],
        additionalProperties: false
      }
    },
    {
      name: 'get_events_by_user',
      description: 'Get all events for a specific user, optionally filtered by date range',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID to get events for' },
          startDate: { type: 'string', description: 'Start date in ISO 8601 format' },
          endDate: { type: 'string', description: 'End date in ISO 8601 format' }
        },
        required: ['userId'],
        additionalProperties: false
      }
    }
  ]
}

/**
 * Execute a Kanban tool directly (no HTTP)
 */
export async function executeKanbanTool(
  context: KanbanMcpContext,
  toolName: string,
  args: Record<string, any>
): Promise<McpToolResult> {
  try {
    let result: any

    switch (toolName) {
      case 'list_boards':
        result = await listBoards(context)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  data: result,
                  summary: `Found ${result.length} board(s)`
                },
                null,
                2
              )
            }
          ]
        }

      case 'get_board':
        result = await getBoardByIdOrName(context, args.boardIdOrName)
        if (!result) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Board '${args.boardIdOrName}' not found`
                  },
                  null,
                  2
                )
              }
            ],
            isError: true
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  data: result,
                  summary: `Board: ${result.name}`
                },
                null,
                2
              )
            }
          ]
        }

      case 'list_cards':
        result = await listCards(context, args.boardIdOrName, args.columnIdOrName)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  data: result,
                  summary: `Found ${result?.cards?.length || 0} card(s)`
                },
                null,
                2
              )
            }
          ]
        }

      case 'create_card':
        result = await createCard(context, args.boardIdOrName, args.columnIdOrName, {
          title: args.title,
          description: args.description,
          assignee: args.assignee,
          priority: args.priority
        })
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: !!result,
                  data: result,
                  summary: result ? `Created card: ${result.card.title}` : 'Failed to create card'
                },
                null,
                2
              )
            }
          ]
        }

      case 'modify_card':
        result = await modifyCard(context, args.cardId, {
          title: args.title,
          description: args.description,
          assignee: args.assignee,
          priority: args.priority
        })
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: !!result,
                  data: result,
                  summary: result ? 'Card modified successfully' : 'Failed to modify card'
                },
                null,
                2
              )
            }
          ]
        }

      case 'move_card':
        result = await moveCardToColumn(context, args.cardId, args.targetColumnIdOrName)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: !!result,
                  data: result,
                  summary: result ? 'Card moved successfully' : 'Failed to move card'
                },
                null,
                2
              )
            }
          ]
        }

      case 'remove_card':
        result = await removeCard(context, args.boardIdOrName, args.cardId)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: !!result,
                  data: result,
                  summary: result ? 'Card removed successfully' : 'Failed to remove card'
                },
                null,
                2
              )
            }
          ]
        }

      case 'search_cards':
        result = await searchCards(context, args.query, args.boardIdOrName)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  data: result,
                  summary: `Found ${result.length} card(s) matching '${args.query}'`
                },
                null,
                2
              )
            }
          ]
        }

      case 'get_cards_by_assignee':
        result = await getCardsByAssignee(context, args.assignee, args.boardIdOrName)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  data: result,
                  summary: `Found ${result.length} card(s) assigned to ${args.assignee}`
                },
                null,
                2
              )
            }
          ]
        }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: `Unknown tool: ${toolName}`
                },
                null,
                2
              )
            }
          ],
          isError: true
        }
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            },
            null,
            2
          )
        }
      ],
      isError: true
    }
  }
}

export function getAgentsDirectoryTools(): McpTool[] {
  return [
    {
      name: 'list_agents',
      description:
        'List active agents with their roles, capabilities, and delegation preferences. Optional team filter.',
      inputSchema: {
        type: 'object',
        properties: {
          teamId: { type: 'string', description: 'Optional team identifier' }
        },
        additionalProperties: false
      }
    },
    {
      name: 'get_agent',
      description: 'Get detailed information about a specific agent by id, username, or email.',
      inputSchema: {
        type: 'object',
        properties: {
          agentIdOrEmail: {
            type: 'string',
            description: 'Agent id, username, or email address'
          },
          teamId: { type: 'string', description: 'Optional team identifier' }
        },
        required: ['agentIdOrEmail'],
        additionalProperties: false
      }
    },
    {
      name: 'find_agents_by_capability',
      description:
        'Find agents that match a capability keyword (e.g. "calendar", "kanban", "delegation").',
      inputSchema: {
        type: 'object',
        properties: {
          capability: { type: 'string', description: 'Capability keyword (partial match allowed)' },
          teamId: { type: 'string', description: 'Optional team identifier' }
        },
        required: ['capability'],
        additionalProperties: false
      }
    },
    {
      name: 'list_capabilities',
      description: 'List available capability keys that agents in this workspace expose.',
      inputSchema: {
        type: 'object',
        properties: {
          teamId: { type: 'string', description: 'Optional team identifier' }
        },
        additionalProperties: false
      }
    }
  ]
}

export async function executeAgentsDirectoryTool(
  context: { teamId?: string },
  functionName: string,
  args: Record<string, any> = {}
): Promise<McpToolResult> {
  const effectiveTeamId =
    typeof args.teamId === 'string' && args.teamId.trim().length > 0
      ? args.teamId.trim()
      : context.teamId

  const buildResult = (payload: unknown): McpToolResult => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }
    ]
  })

  try {
    switch (functionName) {
      case 'list_agents': {
        const agents = await listAgentDirectory(effectiveTeamId)
        return buildResult({
          success: true,
          total: agents.length,
          data: agents,
          summary: agents.length
            ? `Found ${agents.length} agent${agents.length === 1 ? '' : 's'}`
            : 'No agents found'
        })
      }

      case 'get_agent': {
        const identifier = String(args.agentIdOrEmail || '').trim()
        if (!identifier) {
          throw new Error('agentIdOrEmail is required')
        }
        const agent = await getAgentDirectoryEntry(identifier, effectiveTeamId)
        return buildResult({
          success: !!agent,
          data: agent,
          summary: agent ? `Resolved agent ${agent.name} (${agent.role})` : 'Agent not found'
        })
      }

      case 'find_agents_by_capability': {
        const capability = String(args.capability || '').trim()
        if (!capability) {
          throw new Error('capability is required')
        }
        const agents = await findAgentsByCapability(capability, effectiveTeamId)
        return buildResult({
          success: true,
          total: agents.length,
          data: agents,
          summary: agents.length
            ? `Found ${agents.length} agent${agents.length === 1 ? '' : 's'} for capability "${capability}"`
            : `No agents cover capability "${capability}"`
        })
      }

      case 'list_capabilities': {
        const capabilities = await listDirectoryCapabilities(effectiveTeamId)
        return buildResult({
          success: true,
          total: capabilities.length,
          data: capabilities,
          summary: capabilities.length
            ? `Available capabilities: ${capabilities.join(', ')}`
            : 'No capabilities discovered'
        })
      }

      default:
        throw new Error(`Unknown agents directory tool: ${functionName}`)
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            },
            null,
            2
          )
        }
      ]
    }
  }
}
