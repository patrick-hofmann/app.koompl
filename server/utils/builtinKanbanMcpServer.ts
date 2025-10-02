#!/usr/bin/env node

/**
 * Built-in Kanban MCP Server
 * This runs as a proper MCP server that the MCP client can connect to
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js'
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

// Get context from environment variables (passed by the MCP client)
const getKanbanContext = (): KanbanMcpContext => {
  console.log('[BuiltinKanbanMCP] Getting context from environment variables')
  const teamId = process.env.KANBAN_TEAM_ID
  const userId = process.env.KANBAN_USER_ID
  const agentId = process.env.KANBAN_AGENT_ID

  console.log('[BuiltinKanbanMCP] Environment variables:', {
    hasTeamId: !!teamId,
    hasUserId: !!userId,
    hasAgentId: !!agentId
  })

  if (!teamId || !userId) {
    throw new Error('Missing required environment variables: KANBAN_TEAM_ID, KANBAN_USER_ID')
  }

  return {
    teamId,
    userId,
    agentId
  }
}

async function main() {
  console.log('[BuiltinKanbanMCP] Starting built-in Kanban MCP server...')

  const server = new Server(
    {
      name: 'builtin-kanban-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  )

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: 'list_boards',
        description: 'List all available Kanban boards for the team',
        inputSchema: {
          type: 'object',
          properties: {},
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
            boardIdOrName: {
              type: 'string',
              description: 'Board ID or name to create the card on'
            },
            columnIdOrName: {
              type: 'string',
              description: 'Column ID or name to create the card in'
            },
            title: {
              type: 'string',
              description: 'Title of the card'
            },
            description: {
              type: 'string',
              description: 'Optional description of the card'
            },
            assignee: {
              type: 'string',
              description: 'Optional assignee for the card'
            },
            priority: {
              type: 'string',
              enum: ['Low', 'Medium', 'High'],
              description: 'Optional priority level'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags for the card'
            },
            ticket: {
              type: 'string',
              description: 'Optional ticket reference (e.g., MC-2037)'
            }
          },
          required: ['boardIdOrName', 'columnIdOrName', 'title'],
          additionalProperties: false
        }
      },
      {
        name: 'modify_card',
        description: 'Update an existing card',
        inputSchema: {
          type: 'object',
          properties: {
            boardIdOrName: {
              type: 'string',
              description: 'Board ID or name containing the card'
            },
            cardId: {
              type: 'string',
              description: 'ID of the card to modify'
            },
            title: {
              type: 'string',
              description: 'New title for the card'
            },
            description: {
              type: 'string',
              description: 'New description for the card'
            },
            assignee: {
              type: 'string',
              description: 'New assignee for the card'
            },
            priority: {
              type: 'string',
              enum: ['Low', 'Medium', 'High'],
              description: 'New priority level'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'New tags for the card'
            },
            ticket: {
              type: 'string',
              description: 'New ticket reference'
            }
          },
          required: ['boardIdOrName', 'cardId'],
          additionalProperties: false
        }
      },
      {
        name: 'move_card',
        description: 'Move a card to a different column',
        inputSchema: {
          type: 'object',
          properties: {
            boardIdOrName: {
              type: 'string',
              description: 'Board ID or name containing the card'
            },
            cardId: {
              type: 'string',
              description: 'ID of the card to move'
            },
            toColumnIdOrName: {
              type: 'string',
              description: 'Target column ID or name'
            },
            position: {
              type: 'number',
              description: 'Optional position within the target column'
            }
          },
          required: ['boardIdOrName', 'cardId', 'toColumnIdOrName'],
          additionalProperties: false
        }
      },
      {
        name: 'remove_card',
        description: 'Delete a card from a board',
        inputSchema: {
          type: 'object',
          properties: {
            boardIdOrName: {
              type: 'string',
              description: 'Board ID or name containing the card'
            },
            cardId: {
              type: 'string',
              description: 'ID of the card to remove'
            }
          },
          required: ['boardIdOrName', 'cardId'],
          additionalProperties: false
        }
      },
      {
        name: 'search_cards',
        description: 'Search for cards by title, description, assignee, or ticket',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            boardIdOrName: {
              type: 'string',
              description: 'Optional board ID or name to limit search'
            }
          },
          required: ['query'],
          additionalProperties: false
        }
      },
      {
        name: 'get_cards_by_assignee',
        description: 'Get all cards assigned to a specific user',
        inputSchema: {
          type: 'object',
          properties: {
            assignee: {
              type: 'string',
              description: 'Assignee to filter by'
            },
            boardIdOrName: {
              type: 'string',
              description: 'Optional board ID or name to limit search'
            }
          },
          required: ['assignee'],
          additionalProperties: false
        }
      }
    ]

    return { tools }
  })

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    console.log(`[BuiltinKanbanMCP] Tool call: ${name} with args:`, args)

    const context = getKanbanContext()

    try {
      switch (name) {
        case 'list_boards': {
          const boards = await listBoards(context)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    data: boards,
                    summary: `Found ${boards.length} boards`
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'get_board': {
          const board = await getBoardByIdOrName(context, args.boardIdOrName)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: !!board,
                    data: board,
                    summary: board ? `Retrieved board: ${board.name}` : 'Board not found'
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'list_cards': {
          const cardsResult = await listCards(context, args.boardIdOrName, args.columnIdOrName)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: !!cardsResult,
                    data: cardsResult,
                    summary: cardsResult
                      ? `Found ${cardsResult.cards.length} cards`
                      : 'Board not found'
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'create_card': {
          const createResult = await createCard(context, args.boardIdOrName, args.columnIdOrName, {
            title: args.title,
            description: args.description,
            assignee: args.assignee,
            priority: args.priority,
            tags: args.tags,
            ticket: args.ticket
          })
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: !!createResult,
                    data: createResult,
                    summary: createResult
                      ? `Created card: ${createResult.card.title}`
                      : 'Failed to create card'
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'modify_card': {
          const modifyResult = await modifyCard(context, args.boardIdOrName, args.cardId, {
            title: args.title,
            description: args.description,
            assignee: args.assignee,
            priority: args.priority,
            tags: args.tags,
            ticket: args.ticket
          })
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: !!modifyResult,
                    data: modifyResult,
                    summary: modifyResult
                      ? `Modified card: ${modifyResult.card.title}`
                      : 'Failed to modify card'
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'move_card': {
          const moveResult = await moveCardToColumn(
            context,
            args.boardIdOrName,
            args.cardId,
            args.toColumnIdOrName,
            args.position
          )
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: !!moveResult,
                    data: moveResult,
                    summary: moveResult?.success ? 'Card moved successfully' : 'Failed to move card'
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'remove_card': {
          const removeResult = await removeCard(context, args.boardIdOrName, args.cardId)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: !!removeResult,
                    data: removeResult,
                    summary: removeResult?.success
                      ? 'Card removed successfully'
                      : 'Failed to remove card'
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'search_cards': {
          const searchResult = await searchCards(context, args.query, args.boardIdOrName)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    data: searchResult,
                    summary: `Found ${searchResult.length} matching cards`
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'get_cards_by_assignee': {
          const assigneeResult = await getCardsByAssignee(
            context,
            args.assignee,
            args.boardIdOrName
          )
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    data: assigneeResult,
                    summary: `Found ${assigneeResult.length} cards assigned to ${args.assignee}`
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        default:
          throw new Error(`Unknown tool: ${name}`)
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
  })

  // Start the server
  console.log('[BuiltinKanbanMCP] Connecting to stdio transport...')
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.log('[BuiltinKanbanMCP] Server connected and ready to receive requests')
}

// Run the server
main().catch((error) => {
  console.error('Kanban MCP Server error:', error)
  process.exit(1)
})
