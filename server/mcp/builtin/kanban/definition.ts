import type { BuiltinMcpDefinition } from '../shared'
import type { KanbanMcpContext } from './context'
import {
  createCard,
  getBoardByIdOrName,
  getCardsByAssignee,
  listBoards,
  listCards,
  moveCardToColumn,
  removeCard,
  searchCards,
  modifyCard
} from './operations'

export const kanbanDefinition: BuiltinMcpDefinition<KanbanMcpContext> = {
  id: 'builtin-kanban',
  serverName: 'builtin-kanban-server',
  logPrefix: '[BuiltinKanbanMCP]',
  context: {
    spec: {
      teamIdEnv: 'KANBAN_TEAM_ID',
      userIdEnv: 'KANBAN_USER_ID',
      agentIdEnv: 'KANBAN_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.KANBAN_TEAM_ID as string,
      userId: env.KANBAN_USER_ID as string,
      agentId: env.KANBAN_AGENT_ID || undefined
    })
  },
  tools: [
    {
      name: 'list_boards',
      description: 'List all available Kanban boards for the team',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async ({ context }) => {
        const boards = await listBoards(context)
        return {
          success: true,
          data: boards,
          summary: `Found ${boards.length} boards`
        }
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
      },
      execute: async ({ context, args }) => {
        const { boardIdOrName } = args as { boardIdOrName?: string }
        if (!boardIdOrName) {
          return {
            success: false,
            error: 'boardIdOrName is required'
          }
        }
        const board = await getBoardByIdOrName(context, boardIdOrName)
        return {
          success: !!board,
          data: board,
          summary: board ? `Retrieved board: ${board.name}` : 'Board not found'
        }
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
      },
      execute: async ({ context, args }) => {
        const { boardIdOrName, columnIdOrName } = args as {
          boardIdOrName?: string
          columnIdOrName?: string
        }
        if (!boardIdOrName) {
          return {
            success: false,
            error: 'boardIdOrName is required'
          }
        }
        const cardsResult = await listCards(context, boardIdOrName, columnIdOrName)
        return {
          success: !!cardsResult,
          data: cardsResult,
          summary: cardsResult ? `Found ${cardsResult.cards.length} cards` : 'Board not found'
        }
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
            description: 'Optional ticket reference'
          }
        },
        required: ['boardIdOrName', 'columnIdOrName', 'title'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const {
          boardIdOrName,
          columnIdOrName,
          title,
          description,
          assignee,
          priority,
          tags,
          ticket
        } = args as {
          boardIdOrName?: string
          columnIdOrName?: string
          title?: string
          description?: string
          assignee?: string
          priority?: 'Low' | 'Medium' | 'High'
          tags?: string[]
          ticket?: string
        }
        if (!boardIdOrName || !columnIdOrName || !title) {
          return {
            success: false,
            error: 'boardIdOrName, columnIdOrName and title are required'
          }
        }
        const createResult = await createCard(context, boardIdOrName, columnIdOrName, {
          title,
          description,
          assignee,
          priority,
          tags,
          ticket
        })
        return {
          success: !!createResult,
          data: createResult,
          summary: createResult
            ? `Created card: ${createResult.card.title}`
            : 'Failed to create card'
        }
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
            description: 'New description of the card'
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
      },
      execute: async ({ context, args }) => {
        const { boardIdOrName, cardId, title, description, assignee, priority, tags, ticket } =
          args as {
            boardIdOrName?: string
            cardId?: string
            title?: string
            description?: string
            assignee?: string
            priority?: 'Low' | 'Medium' | 'High'
            tags?: string[]
            ticket?: string
          }
        if (!boardIdOrName || !cardId) {
          return {
            success: false,
            error: 'boardIdOrName and cardId are required'
          }
        }
        const modifyResult = await modifyCard(context, boardIdOrName, cardId, {
          title,
          description,
          assignee,
          priority,
          tags,
          ticket
        })
        return {
          success: !!modifyResult,
          data: modifyResult,
          summary: modifyResult
            ? `Modified card: ${modifyResult.card.title}`
            : 'Failed to modify card'
        }
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
          targetColumnIdOrName: {
            type: 'string',
            description: 'Target column ID or name'
          }
        },
        required: ['boardIdOrName', 'cardId', 'targetColumnIdOrName'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const { boardIdOrName, cardId, targetColumnIdOrName } = args as {
          boardIdOrName?: string
          cardId?: string
          targetColumnIdOrName?: string
        }
        if (!boardIdOrName || !cardId || !targetColumnIdOrName) {
          return {
            success: false,
            error: 'boardIdOrName, cardId and targetColumnIdOrName are required'
          }
        }
        const moveResult = await moveCardToColumn(
          context,
          boardIdOrName,
          cardId,
          targetColumnIdOrName
        )
        return {
          success: !!moveResult,
          data: moveResult,
          summary: moveResult ? `Moved card: ${moveResult.card.title}` : 'Failed to move card'
        }
      }
    },
    {
      name: 'remove_card',
      description: 'Remove a card from the board',
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
      },
      execute: async ({ context, args }) => {
        const { boardIdOrName, cardId } = args as { boardIdOrName?: string; cardId?: string }
        if (!boardIdOrName || !cardId) {
          return {
            success: false,
            error: 'boardIdOrName and cardId are required'
          }
        }
        const removed = await removeCard(context, boardIdOrName, cardId)
        return {
          success: removed,
          summary: removed ? 'Card removed successfully' : 'Failed to remove card'
        }
      }
    },
    {
      name: 'search_cards',
      description: 'Search for cards by query string',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          boardIdOrName: {
            type: 'string',
            description: 'Optional board ID or name to search within'
          }
        },
        required: ['query'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const { query, boardIdOrName } = args as { query?: string; boardIdOrName?: string }
        if (!query) {
          return {
            success: false,
            error: 'query is required'
          }
        }
        const results = await searchCards(context, query, boardIdOrName)
        return {
          success: true,
          data: results,
          summary: results.length ? `Found ${results.length} matching cards` : 'No matches found'
        }
      }
    },
    {
      name: 'get_cards_by_assignee',
      description: 'Get all cards assigned to a specific person',
      inputSchema: {
        type: 'object',
        properties: {
          assignee: {
            type: 'string',
            description: 'Assignee name or ID'
          },
          boardIdOrName: {
            type: 'string',
            description: 'Optional board ID or name to filter by'
          }
        },
        required: ['assignee'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const { assignee, boardIdOrName } = args as { assignee?: string; boardIdOrName?: string }
        if (!assignee) {
          return {
            success: false,
            error: 'assignee is required'
          }
        }
        const results = await getCardsByAssignee(context, assignee, boardIdOrName)
        return {
          success: true,
          data: results,
          summary: results.length
            ? `Found ${results.length} cards for ${assignee}`
            : `No cards assigned to ${assignee}`
        }
      }
    }
  ]
}
