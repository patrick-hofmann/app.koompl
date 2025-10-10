import {
  defineEventHandler,
  getRequestHeader,
  readBody,
  setResponseHeader,
  setResponseStatus,
  createError
} from 'h3'
import type { H3Event } from 'h3'

import { calendarDefinition } from './definition'
import type { CalendarMcpContext } from './context'
import type { BuiltinToolResponse } from '../shared'

interface JsonRpcRequest {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: {
    name?: string
    arguments?: Record<string, unknown>
  }
}

function resolveJsonRpcId(id: unknown): string | number {
  if (typeof id === 'string' || typeof id === 'number') {
    return id
  }
  return '0'
}

function formatToolResponse(response: BuiltinToolResponse): string {
  return JSON.stringify(
    {
      success: response.success,
      summary: response.summary,
      data: response.data,
      error: response.error
    },
    null,
    2
  )
}

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
      message: 'Builtin Calendar MCP endpoint. Send JSON-RPC 2.0 requests via POST.'
    }
  }

  if (method !== 'POST') {
    setResponseStatus(event, 405)
    return {
      error: true,
      message: `Unsupported method ${method}`
    }
  }

  // Authenticate the request (supports dev mode with bearer token or localhost)
  const { authenticateMcpRequest } = await import('../shared/auth')
  const { teamId, userId, isDevelopmentMode } = await authenticateMcpRequest(event)

  console.log('[BuiltinCalendarMCP] Authenticated:', {
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
      console.log('[BuiltinCalendarMCP] Authenticated via session:', { teamId, userId })
    } else {
      // No valid session - fall through to header auth
      console.log('[BuiltinCalendarMCP] No valid session, using header auth')
    }
  }

  if (!session) {
    // No session (webhook call) - trust headers (they're set by our own code)
    console.log('[BuiltinCalendarMCP] Authenticated via headers (webhook):', {
      teamId,
      userId,
      hasCookies
    })
    session = {
      user: { id: userId, name: 'Agent User', email: 'agent@system' },
      team: { id: teamId, name: 'Team' }
    }
  }

  const body = (await readBody<JsonRpcRequest>(event)) || {}
  const requestId = resolveJsonRpcId(body.id)

  if (body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: -32600,
        message: 'Invalid JSON-RPC format'
      }
    }
  }

  const baseContext: CalendarMcpContext = {
    teamId,
    userId,
    agentId: session?.user?.id
  }

  try {
    let result: unknown

    switch (body.method) {
      case 'initialize': {
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'builtin-calendar-server',
            version: '1.0.0'
          }
        }
        break
      }

      case 'tools/list': {
        result = {
          tools: calendarDefinition.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        }
        break
      }

      case 'notifications/initialized': {
        // MCP protocol notification - acknowledge and continue
        result = { success: true }
        break
      }

      case 'tools/call': {
        const toolName = body.params?.name
        const args = body.params?.arguments || {}

        if (!toolName) {
          throw createError({ statusCode: 400, statusMessage: 'Tool name is required' })
        }

        const tool = calendarDefinition.tools.find((item) => item.name === toolName)
        if (!tool) {
          throw createError({ statusCode: 400, statusMessage: `Unknown tool: ${toolName}` })
        }

        const allowOverride =
          process.env.NODE_ENV === 'development' ||
          getRequestHeader(event, 'x-mcp-allow-team-override') === '1'

        const resolvedContext: CalendarMcpContext = {
          ...baseContext,
          teamId:
            allowOverride && typeof args.teamId === 'string'
              ? (args.teamId as string)
              : baseContext.teamId,
          userId:
            allowOverride && typeof args.userId === 'string'
              ? (args.userId as string)
              : baseContext.userId
        }

        const response = await tool.execute({ context: resolvedContext, args })
        result = {
          content: [
            {
              type: 'text',
              text: formatToolResponse(response)
            }
          ],
          isError: !response.success
        }
        break
      }

      default:
        throw createError({ statusCode: 400, statusMessage: `Unknown method: ${body.method}` })
    }

    return {
      jsonrpc: '2.0',
      id: requestId,
      result
    }
  } catch (error) {
    console.error('[BuiltinCalendarMCP] Error handling request:', error)
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
