import {
  defineEventHandler,
  getRequestHeaders,
  readBody,
  setResponseHeader,
  setResponseStatus,
  createError
} from 'h3'
import type { H3Event } from 'h3'

import { getAgentsDirectoryTools, executeAgentsDirectoryTool } from '../../mcp/tools/builtin'

function applyCors(event: H3Event) {
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
  setResponseHeader(event, 'Access-Control-Allow-Headers', '*')
}

export default defineEventHandler(async (event) => {
  applyCors(event)

  const method = event.node.req.method || 'GET'

  if (method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }

  if (method === 'GET') {
    return {
      ok: true,
      message: 'Builtin Agents MCP endpoint. Send JSON-RPC 2.0 requests via POST.'
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
    const headers = getRequestHeaders(event)
    const headerTeamId = headers['x-team-id']
    const headerUserId = headers['x-user-id']

    if (!headerTeamId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing x-team-id header'
      })
    }

    if (!headerUserId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing x-user-id header'
      })
    }

    const teamId = headerTeamId
    const userId = headerUserId
    let session

    // In production, verify the teamId and userId against the session
    if (process.env.NODE_ENV !== 'development') {
      try {
        session = await requireUserSession(event)

        // Verify that the header teamId matches the session teamId
        if (session.team?.id !== teamId) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Team ID mismatch between session and header'
          })
        }

        // Verify that the header userId matches the session userId
        if (session.user?.id !== userId) {
          throw createError({
            statusCode: 403,
            statusMessage: 'User ID mismatch between session and header'
          })
        }
      } catch (authError) {
        console.error('[MCP Agents] Authentication failed:', authError)
        throw authError
      }
    } else {
      // Development mode: skip session validation, use header values
      console.log('[MCP Agents] Development mode - using teamId from header:', teamId)
      session = {
        user: { id: userId, name: 'Test User', email: 'test@example.com' },
        team: { id: teamId, name: 'Test Team' }
      }
    }

    const body = await readBody(event)

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

    const {
      jsonrpc,
      id,
      method: rpcMethod,
      params
    } = body as {
      jsonrpc?: string
      id?: string | number | null
      method?: string
      params?: any
    }

    if (jsonrpc !== '2.0' || !rpcMethod) {
      return {
        jsonrpc: '2.0',
        id: typeof id === 'string' || typeof id === 'number' ? id : '0',
        error: {
          code: -32600,
          message: 'Invalid JSON-RPC format'
        }
      }
    }

    const responseId = typeof id === 'string' || typeof id === 'number' ? id : '0'

    switch (rpcMethod) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id: responseId,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'builtin-agents-server',
              version: '1.0.0'
            }
          }
        }
      }

      case 'tools/list': {
        const tools = getAgentsDirectoryTools().map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))

        return {
          jsonrpc: '2.0',
          id: responseId,
          result: {
            tools
          }
        }
      }

      case 'notifications/initialized': {
        // MCP protocol notification - acknowledge and continue
        return {
          jsonrpc: '2.0',
          id: responseId,
          result: { success: true }
        }
      }

      case 'tools/call': {
        const { name, arguments: args } = params || {}

        if (!name || typeof args !== 'object') {
          throw createError({ statusCode: 400, statusMessage: 'Missing tool name or arguments' })
        }

        // Never allow teamId override from arguments - always use header teamId
        const safeArgs = { ...args }
        if ('teamId' in safeArgs) {
          console.log('[MCP Agents] Removing teamId from arguments, using header teamId:', teamId)
          delete safeArgs.teamId
        }

        const result = await executeAgentsDirectoryTool({ teamId }, name, safeArgs)

        return {
          jsonrpc: '2.0',
          id: responseId,
          result
        }
      }

      default:
        return {
          jsonrpc: '2.0',
          id: responseId,
          error: {
            code: -32601,
            message: `Unknown method: ${rpcMethod}`
          }
        }
    }
  } catch (error) {
    console.error('[MCP Agents] Error handling request:', error)
    return {
      jsonrpc: '2.0',
      id: '0',
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }
})
