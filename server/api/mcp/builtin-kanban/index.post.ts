/**
 * Builtin Kanban MCP Server Endpoint
 *
 * This endpoint provides MCP protocol access to the builtin Kanban functionality
 * running within the Nuxt server. It accepts MCP JSON-RPC requests and returns
 * appropriate responses.
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
} from '../../../mcp/builtin/kanban'
import { createBoard, addColumn } from '../../../utils/kanbanStorage'

export default defineEventHandler(async (event) => {
  try {
    // CORS headers for browser-based Inspector
    setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
    setResponseHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
    setResponseHeader(event, 'Access-Control-Allow-Headers', '*')
    // Get session for authentication
    let session
    let teamId
    let userId

    // Check for explicit team/user IDs in headers (for HTTP MCP clients)
    const headers = getRequestHeaders(event)
    const headerTeamId = headers['x-team-id']
    const headerUserId = headers['x-user-id']

    try {
      session = await requireUserSession(event)
      teamId = session.team?.id
      userId = session.user?.id
    } catch (authError) {
      // In development mode, allow testing without authentication
      if (process.env.NODE_ENV === 'development') {
        console.log('[MCP] Development mode: Using credentials from headers or test defaults')
        teamId = headerTeamId || 'test-team-dev-123'
        userId = headerUserId || 'test-user-dev-456'
        session = {
          user: { id: userId, name: 'Test User', email: 'test@example.com' },
          team: { id: teamId, name: 'Test Team' }
        }
      } else {
        throw authError
      }
    }

    // Prefer header values if provided (for HTTP MCP clients)
    if (headerTeamId) teamId = headerTeamId
    if (headerUserId) userId = headerUserId

    if (!teamId || !userId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Authentication required'
      })
    }

    // Parse MCP request
    const body = await readBody(event)

    if (process.env.NODE_ENV === 'development') {
      console.log('[MCP] Incoming request:', {
        headers: getRequestHeaders(event),
        body
      })
    }

    // If no/invalid body: return JSON-RPC error with 200 status (Inspector expects 2xx)
    if (!body || typeof body !== 'object') {
      return {
        jsonrpc: '2.0',
        id: '0',
        error: {
          code: -32600, // Invalid Request
          message: 'Invalid MCP request format'
        }
      }
    }

    const { jsonrpc, id, method, params } = body

    // Validate JSON-RPC format; respond with JSON-RPC error but keep HTTP 200
    if (jsonrpc !== '2.0' || method == null) {
      return {
        jsonrpc: '2.0',
        id: typeof id === 'string' || typeof id === 'number' ? id : '0',
        error: {
          code: -32600,
          message: 'Invalid JSON-RPC format'
        }
      }
    }

    // Base context from session/dev-bypass
    const baseContext: KanbanMcpContext = {
      teamId,
      userId,
      agentId: (session as any)?.user?.id
    }

    // Handle MCP methods
    let result

    switch (method) {
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
                },
                teamId: { type: 'string' },
                userId: { type: 'string' }
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
                },
                teamId: { type: 'string' },
                userId: { type: 'string' }
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
                },
                teamId: { type: 'string' },
                userId: { type: 'string' }
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
                },
                teamId: { type: 'string' },
                userId: { type: 'string' }
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
                },
                teamId: { type: 'string' },
                userId: { type: 'string' }
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
                },
                teamId: { type: 'string' },
                userId: { type: 'string' }
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
                },
                teamId: { type: 'string' },
                userId: { type: 'string' }
              },
              required: ['assignee'],
              additionalProperties: false
            }
          }
        ]

        result = { tools }
        break
      }

      case 'tools/call': {
        const { name, arguments: args } = params || {}

        if (!name || !args) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Missing tool name or arguments'
          })
        }

        let toolResult

        // Resolve context allowing optional override per call
        const callContext: KanbanMcpContext = (() => {
          const argTeamId = args?.teamId
          const argUserId = args?.userId
          const resolved = { ...baseContext }
          if (argTeamId || argUserId) {
            const allowOverride =
              process.env.NODE_ENV === 'development' ||
              getRequestHeader(event, 'x-mcp-allow-team-override') === '1'
            if (allowOverride) {
              if (argTeamId) resolved.teamId = String(argTeamId)
              if (argUserId) resolved.userId = String(argUserId)
            }
          }
          return resolved
        })()

        switch (name) {
          case 'list_boards': {
            const boards = await listBoards(callContext)
            toolResult = {
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
            break
          }

          case 'get_board': {
            const board = await getBoardByIdOrName(callContext, args.boardIdOrName)
            toolResult = {
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
            break
          }

          case 'list_cards': {
            const cardsResult = await listCards(
              callContext,
              args.boardIdOrName,
              args.columnIdOrName
            )
            toolResult = {
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
            break
          }

          case 'create_card': {
            let createResult = await createCard(
              callContext,
              args.boardIdOrName,
              args.columnIdOrName,
              {
                title: args.title,
                description: args.description,
                assignee: args.assignee,
                priority: args.priority,
                tags: args.tags,
                ticket: args.ticket
              }
            )

            // In development: if board/column missing, create them and retry
            if (!createResult && process.env.NODE_ENV === 'development') {
              try {
                // Ensure board exists
                const existingBoards = await listBoards(callContext)
                let board = existingBoards.find(
                  (b) =>
                    b.id === args.boardIdOrName ||
                    b.name.toLowerCase() === String(args.boardIdOrName).toLowerCase()
                )
                if (!board) {
                  board = await createBoard(
                    callContext.teamId,
                    String(args.boardIdOrName) || 'Test Board'
                  )
                }
                // Ensure column exists
                const column = board.columns.find(
                  (c) =>
                    c.id === args.columnIdOrName ||
                    c.title?.toLowerCase() === String(args.columnIdOrName || '').toLowerCase()
                )
                if (!column) {
                  const added = await addColumn(
                    callContext.teamId,
                    board.id,
                    String(args.columnIdOrName) || 'To Do'
                  )
                  if (added) {
                    // refresh board
                    const refreshed = await getBoardByIdOrName(callContext, board.id)
                    if (refreshed) board = refreshed
                  }
                }
                // Retry create
                createResult = await createCard(
                  callContext,
                  board.id,
                  String(args.columnIdOrName || 'To Do'),
                  {
                    title: args.title,
                    description: args.description,
                    assignee: args.assignee,
                    priority: args.priority,
                    tags: args.tags,
                    ticket: args.ticket
                  }
                )
              } catch {
                // fallthrough; will return failure below
              }
            }
            toolResult = {
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
            break
          }

          case 'modify_card': {
            const modifyResult = await modifyCard(callContext, args.boardIdOrName, args.cardId, {
              title: args.title,
              description: args.description,
              assignee: args.assignee,
              priority: args.priority,
              tags: args.tags,
              ticket: args.ticket
            })
            toolResult = {
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
            break
          }

          case 'move_card': {
            const moveResult = await moveCardToColumn(
              callContext,
              args.boardIdOrName,
              args.cardId,
              args.toColumnIdOrName,
              args.position
            )
            toolResult = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: !!moveResult,
                      data: moveResult,
                      summary: moveResult?.success
                        ? 'Card moved successfully'
                        : 'Failed to move card'
                    },
                    null,
                    2
                  )
                }
              ]
            }
            break
          }

          case 'remove_card': {
            const removeResult = await removeCard(callContext, args.boardIdOrName, args.cardId)
            toolResult = {
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
            break
          }

          case 'search_cards': {
            const searchResult = await searchCards(callContext, args.query, args.boardIdOrName)
            toolResult = {
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
            break
          }

          case 'get_cards_by_assignee': {
            const assigneeResult = await getCardsByAssignee(
              callContext,
              args.assignee,
              args.boardIdOrName
            )
            toolResult = {
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
            break
          }

          default:
            throw createError({
              statusCode: 400,
              statusMessage: `Unknown tool: ${name}`
            })
        }

        result = toolResult
        break
      }

      default:
        throw createError({
          statusCode: 400,
          statusMessage: `Unknown method: ${method}`
        })
    }

    // Return JSON-RPC response
    return {
      jsonrpc: '2.0',
      id,
      result
    }
  } catch (error) {
    console.error('Builtin Kanban MCP error:', error)

    // Parse body for error response
    let requestId: string | number = '0'
    try {
      const body = await readBody(event)
      if (typeof body?.id === 'string' || typeof body?.id === 'number') {
        requestId = body.id
      }
    } catch {
      // Ignore body parsing errors in error handler
    }

    // Return JSON-RPC error response
    return {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: error.statusCode || -32603,
        message: error.statusMessage || error.message || 'Internal error'
      }
    }
  }
})
