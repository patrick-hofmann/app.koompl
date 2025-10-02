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
