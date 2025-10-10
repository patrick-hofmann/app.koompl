/**
 * Builtin Kanban MCP Server Endpoint
 * Handles GET (status), OPTIONS (CORS preflight) and POST (JSON-RPC 2.0).
 */

import {
  defineEventHandler,
  getRequestHeader,
  getRequestHeaders,
  readBody,
  setResponseHeader,
  setResponseStatus,
  createError
} from 'h3'
import type { H3Event } from 'h3'
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
} from './operations'

function applyCors(event: H3Event) {
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
  setResponseHeader(event, 'Access-Control-Allow-Headers', '*')
}

export default defineEventHandler(async (event) => {
  console.log('builtin-kanban endpoint called')
  console.log('Request method:', event.node.req.method)
  console.log('Request headers:', getRequestHeaders(event))
  applyCors(event)

  const method = event.node.req.method || 'GET'

  if (method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }

  if (method === 'GET') {
    return {
      ok: true,
      message: 'Builtin Kanban MCP endpoint. Send JSON-RPC 2.0 requests via POST.'
    }
  }

  if (method !== 'POST') {
    setResponseStatus(event, 405)
    return {
      error: true,
      message: `Unsupported method ${method}`
    }
  }

  try {
    // Authenticate the request (supports dev mode with bearer token or localhost)
    const { authenticateMcpRequest } = await import('../shared/auth')
    const { teamId, userId, isDevelopmentMode } = await authenticateMcpRequest(event)

    console.log('[BuiltinKanbanMCP] Authenticated:', {
      teamId,
      userId,
      devMode: isDevelopmentMode
    })
    let session

    // Check if this is a webhook call (no cookies) or browser call (has cookies)
    const hasCookies = !!getRequestHeader(event, 'cookie')

    if (hasCookies) {
      // Browser call with cookies - validate session
      try {
        session = await getUserSession(event)
      } catch {
        session = null
      }

      if (session) {
        // Session exists - validate headers match session (browser-based call)
        if (session.team?.id !== teamId) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Team ID mismatch between session and header'
          })
        }

        if (session.user?.id !== userId) {
          throw createError({
            statusCode: 403,
            statusMessage: 'User ID mismatch between session and header'
          })
        }
        console.log('[BuiltinKanbanMCP] Authenticated via session:', { teamId, userId })
      } else {
        // No valid session - fall through to header auth
        console.log('[BuiltinKanbanMCP] No valid session, using header auth')
      }
    }

    if (!session) {
      // No session (webhook call) - trust headers (they're set by our own code)
      console.log('[BuiltinKanbanMCP] Authenticated via headers (webhook):', {
        teamId,
        userId,
        hasCookies
      })
      session = {
        user: { id: userId, name: 'Agent User', email: 'agent@system' },
        team: { id: teamId, name: 'Team' }
      }
    }

    const body = await readBody(event)

    if (process.env.NODE_ENV === 'development') {
      console.log('[MCP] Incoming request:', {
        headers: getRequestHeaders(event),
        body
      })
    }

    if (!body || typeof body !== 'object') {
      return {
        jsonrpc: '2.0',
        id: '0',
        error: {
          code: -32600,
          message: 'Invalid MCP request format'
        }
      }
    }

    const { jsonrpc, id, method: rpcMethod, params } = body

    if (jsonrpc !== '2.0' || rpcMethod == null) {
      return {
        jsonrpc: '2.0',
        id: typeof id === 'string' || typeof id === 'number' ? id : '0',
        error: {
          code: -32600,
          message: 'Invalid JSON-RPC format'
        }
      }
    }

    const baseContext: KanbanMcpContext = {
      teamId,
      userId,
      agentId: (session as any)?.user?.id
    }

    let result

    switch (rpcMethod) {
      case 'initialize': {
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'builtin-kanban-server',
            version: '1.0.0'
          }
        }
        break
      }

      case 'tools/list': {
        const tools = [
          {
            name: 'list_boards',
            description: 'List all available Kanban boards for the team',
            inputSchema: {
              type: 'object',
              properties: {
                teamId: { type: 'string', description: 'Optional team id override' },
                userId: { type: 'string', description: 'Optional user id override' }
              },
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
                },
                teamId: { type: 'string' },
                userId: { type: 'string' }
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
                priority: {
                  type: 'string',
                  enum: ['low', 'medium', 'high'],
                  description: 'New priority'
                }
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
                boardIdOrName: {
                  type: 'string',
                  description: 'Optional board ID or name to filter by'
                }
              },
              required: ['assignee'],
              additionalProperties: false
            }
          }
        ]
        result = { tools }
        break
      }

      case 'notifications/initialized': {
        // MCP protocol notification - acknowledge and continue
        result = { success: true }
        break
      }

      case 'tools/call': {
        const toolName = params?.name
        const args = params?.arguments || {}

        if (!toolName) {
          throw createError({ statusCode: 400, statusMessage: 'Tool name is required' })
        }

        const overrideAllowed =
          process.env.NODE_ENV === 'development' ||
          getRequestHeader(event, 'x-mcp-allow-team-override') === '1'

        const resolvedContext: KanbanMcpContext = {
          ...baseContext,
          teamId:
            overrideAllowed && typeof args.teamId === 'string'
              ? (args.teamId as string)
              : baseContext.teamId,
          userId:
            overrideAllowed && typeof args.userId === 'string'
              ? (args.userId as string)
              : baseContext.userId
        }

        const response = await handleKanbanTool(toolName, resolvedContext, args)
        result = response
        break
      }

      default:
        throw createError({ statusCode: 400, statusMessage: `Unknown method: ${rpcMethod}` })
    }

    return {
      jsonrpc: '2.0',
      id: typeof id === 'string' || typeof id === 'number' ? id : '0',
      result
    }
  } catch (error) {
    console.error('[BuiltinKanbanMCP] Error:', error)
    return {
      jsonrpc: '2.0',
      id: '0',
      error: {
        code: error.statusCode || -32603,
        message: error.statusMessage || error.message || 'Internal error'
      }
    }
  }
})

async function handleKanbanTool(
  name: string,
  context: KanbanMcpContext,
  args: Record<string, any>
) {
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
                summary: cardsResult ? `Found ${cardsResult.cards.length} cards` : 'Board not found'
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
        args.targetColumnIdOrName
      )
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: !!moveResult,
                data: moveResult,
                summary: moveResult ? 'Moved card successfully' : 'Failed to move card'
              },
              null,
              2
            )
          }
        ]
      }
    }

    case 'remove_card': {
      const removed = await removeCard(context, args.boardIdOrName, args.cardId)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: removed,
                summary: removed ? 'Card removed successfully' : 'Failed to remove card'
              },
              null,
              2
            )
          }
        ]
      }
    }

    case 'search_cards': {
      const results = await searchCards(context, args.query, args.boardIdOrName)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                data: results,
                summary: results.length
                  ? `Found ${results.length} matching cards`
                  : 'No matches found'
              },
              null,
              2
            )
          }
        ]
      }
    }

    case 'get_cards_by_assignee': {
      const results = await getCardsByAssignee(context, args.assignee, args.boardIdOrName)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                data: results,
                summary: results.length
                  ? `Found ${results.length} cards for ${args.assignee}`
                  : `No cards assigned to ${args.assignee}`
              },
              null,
              2
            )
          }
        ]
      }
    }

    default:
      throw createError({ statusCode: 400, statusMessage: `Unknown tool: ${name}` })
  }
}
