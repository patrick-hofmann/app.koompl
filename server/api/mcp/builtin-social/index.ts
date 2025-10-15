/**
 * Builtin Social MCP Server Endpoint
 */

import { defineEventHandler, readBody, setResponseHeader, setResponseStatus, createError } from 'h3'
import type { H3Event } from 'h3'

import { socialDefinition } from './definition'
import type { SocialMcpContext } from './context'
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
      message: 'Builtin Social MCP endpoint. Send JSON-RPC 2.0 requests via POST.'
    }
  }

  if (method !== 'POST') {
    setResponseStatus(event, 405)
    return {
      error: true,
      message: `Unsupported method ${method}`
    }
  }

  // Authenticate the request
  const { authenticateMcpRequest } = await import('../shared/auth')
  const { teamId, userId, isDevelopmentMode } = await authenticateMcpRequest(event)

  console.log('[BuiltinSocialMCP] Authenticated:', {
    teamId,
    userId,
    devMode: isDevelopmentMode
  })

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

  const baseContext: SocialMcpContext = {
    teamId,
    userId
  }

  try {
    let result: unknown

    switch (body.method) {
      case 'initialize': {
        result = {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'builtin-social-server', version: '1.0.0' }
        }
        break
      }

      case 'tools/list': {
        result = {
          tools: socialDefinition.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        }
        break
      }

      case 'tools/call': {
        const toolName = body.params?.name
        const args = body.params?.arguments || {}

        if (!toolName) {
          throw createError({ statusCode: 400, statusMessage: 'Tool name is required' })
        }

        const tool = socialDefinition.tools.find((t) => t.name === toolName)
        if (!tool) {
          throw createError({ statusCode: 400, statusMessage: `Unknown tool: ${toolName}` })
        }

        const toolResult = await tool.execute({ context: baseContext, args })
        result = {
          content: [{ type: 'text', text: formatToolResponse(toolResult) }],
          isError: !toolResult.success
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
    console.error('[BuiltinSocialMCP] Error handling request:', error)
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
