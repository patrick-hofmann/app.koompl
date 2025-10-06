import { getAgentsDirectoryTools, executeAgentsDirectoryTool } from '../../../mcp/tools/builtin'

export default defineEventHandler(async (event) => {
  try {
    // CORS for Inspector / browser clients
    setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
    setResponseHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
    setResponseHeader(event, 'Access-Control-Allow-Headers', '*')

    const headers = getRequestHeaders(event)
    const headerTeamId = headers['x-team-id']

    let session
    let teamId: string | undefined

    try {
      session = await requireUserSession(event)
      teamId = session.team?.id
    } catch (authError) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[MCP Agents] Development mode - using fallback credentials')
        teamId = headerTeamId || 'test-team-dev-123'
        session = {
          user: { id: 'test-user', name: 'Test User', email: 'test@example.com' },
          team: { id: teamId, name: 'Test Team' }
        }
      } else {
        throw authError
      }
    }

    if (headerTeamId) {
      teamId = headerTeamId
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

    const { jsonrpc, id, method, params } = body as {
      jsonrpc?: string
      id?: string | number | null
      method?: string
      params?: any
    }

    if (jsonrpc !== '2.0' || !method) {
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

    switch (method) {
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

      case 'tools/call': {
        const { name, arguments: args } = params || {}

        if (!name || typeof args !== 'object') {
          throw createError({ statusCode: 400, statusMessage: 'Missing tool name or arguments' })
        }

        const allowOverride =
          process.env.NODE_ENV === 'development' ||
          getRequestHeader(event, 'x-mcp-allow-team-override') === '1'

        const safeArgs = { ...args }
        if (!allowOverride && 'teamId' in safeArgs) {
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
            message: `Unknown method: ${method}`
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
