/**
 * Builtin Datasafe MCP Server Endpoint
 *
 * Accepts MCP JSON-RPC 2.0 requests over HTTP and surfaces Datasafe tools.
 */

import { Buffer } from 'node:buffer'
import { defineEventHandler, readBody, setResponseHeader, setResponseStatus, createError } from 'h3'
import type { H3Event } from 'h3'

import {
  listDatasafeFolder,
  downloadDatasafeFile,
  uploadDatasafeFile,
  createDatasafeFolder,
  recommendDatasafePlacement,
  storeDatasafeAttachment,
  listDatasafeRules,
  getDatasafeStats,
  type DatasafeMcpContext
} from './operations'

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

function formatJson(content: unknown): string {
  return JSON.stringify(content, null, 2)
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
      message: 'Builtin Datasafe MCP endpoint. Send JSON-RPC 2.0 requests via POST.'
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

  console.log('[BuiltinDatasafeMCP] Authenticated:', {
    teamId,
    userId,
    devMode: isDevelopmentMode
  })

  // Create a minimal session object
  const session = {
    user: { id: userId, name: 'MCP User', email: 'mcp@system' },
    team: { id: teamId, name: 'Team' }
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

  const baseContext: DatasafeMcpContext = {
    teamId,
    userId,
    agentId: session?.user?.id
  }

  try {
    let result: unknown

    switch (body.method) {
      case 'initialize': {
        console.log('[BuiltinDatasafeMCP] Method: initialize')
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'builtin-datasafe-server',
            version: '1.0.0'
          }
        }
        break
      }

      case 'tools/list': {
        console.log('[BuiltinDatasafeMCP] Method: tools/list')
        result = {
          tools: [
            {
              name: 'list_folder',
              description: 'List folders and files for a given Datasafe path',
              inputSchema: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: 'Optional folder path (defaults to root)'
                  },
                  teamId: { type: 'string' },
                  userId: { type: 'string' }
                },
                additionalProperties: false
              }
            },
            {
              name: 'download_file',
              description: 'Download a Datasafe file as base64 encoded content',
              inputSchema: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: 'Path to the file within the Datasafe'
                  },
                  teamId: { type: 'string' },
                  userId: { type: 'string' }
                },
                required: ['path'],
                additionalProperties: false
              }
            },
            {
              name: 'upload_file',
              description: 'Upload or overwrite a file inside the Datasafe',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'Destination path including filename' },
                  base64: { type: 'string', description: 'Base64 encoded file content' },
                  mimeType: { type: 'string', description: 'File MIME type' },
                  size: { type: 'number', description: 'Original file size in bytes' },
                  overwrite: { type: 'boolean', description: 'Allow overwriting an existing file' },
                  teamId: { type: 'string' },
                  userId: { type: 'string' }
                },
                required: ['path', 'base64', 'mimeType'],
                additionalProperties: false
              }
            },
            {
              name: 'create_folder',
              description: 'Ensure a folder hierarchy exists within the Datasafe',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'Folder path to create' },
                  teamId: { type: 'string' },
                  userId: { type: 'string' }
                },
                required: ['path'],
                additionalProperties: false
              }
            },
            {
              name: 'recommend_placement',
              description: 'Recommend folder placement based on Datasafe automation rules',
              inputSchema: {
                type: 'object',
                properties: {
                  filename: { type: 'string' },
                  mimeType: { type: 'string' },
                  size: { type: 'number' },
                  subject: { type: 'string' },
                  from: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                  teamId: { type: 'string' },
                  userId: { type: 'string' }
                },
                required: ['filename', 'mimeType'],
                additionalProperties: false
              }
            },
            {
              name: 'store_attachment',
              description:
                'Store a base64 attachment using Datasafe rules and return the stored file path',
              inputSchema: {
                type: 'object',
                properties: {
                  filename: { type: 'string' },
                  base64: { type: 'string' },
                  mimeType: { type: 'string' },
                  size: { type: 'number' },
                  subject: { type: 'string' },
                  from: { type: 'string' },
                  overwrite: { type: 'boolean' },
                  teamId: { type: 'string' },
                  userId: { type: 'string' }
                },
                required: ['filename', 'base64', 'mimeType'],
                additionalProperties: false
              }
            },
            {
              name: 'list_rules',
              description: 'List Datasafe automation rules configured for the team',
              inputSchema: {
                type: 'object',
                properties: {
                  teamId: { type: 'string' },
                  userId: { type: 'string' }
                },
                additionalProperties: false
              }
            },
            {
              name: 'get_stats',
              description: 'Summarize Datasafe usage (file counts, total size, recent updates)',
              inputSchema: {
                type: 'object',
                properties: {
                  limit: { type: 'number', description: 'Optional limit for recent files/folders' },
                  teamId: { type: 'string' },
                  userId: { type: 'string' }
                },
                additionalProperties: false
              }
            }
          ]
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

        console.log(`[BuiltinDatasafeMCP] Tool called: ${toolName}`, {
          args: Object.keys(args).reduce(
            (acc, key) => {
              // Truncate base64 data for logging
              if (key === 'base64' && typeof args[key] === 'string') {
                acc[key] = `<base64 data: ${args[key].length} chars>`
              } else {
                acc[key] = args[key]
              }
              return acc
            },
            {} as Record<string, unknown>
          )
        })

        const allowOverride =
          process.env.NODE_ENV === 'development' ||
          getRequestHeader(event, 'x-mcp-allow-team-override') === '1'
        const resolvedContext: DatasafeMcpContext = {
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

        let toolResult: unknown

        switch (toolName) {
          case 'list_folder': {
            try {
              const path =
                typeof args.path === 'string' && args.path.trim().length > 0
                  ? (args.path as string)
                  : undefined
              const folder = await listDatasafeFolder(resolvedContext, path)
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: true,
                      summary: `Found ${folder.children.length} items in ${path || '/'} `,
                      data: folder
                    })
                  }
                ],
                isError: false
              }
            } catch (err) {
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: false,
                      error: err.statusMessage || err.message || 'Failed to list folder',
                      path: args.path
                    })
                  }
                ],
                isError: true
              }
            }
            break
          }

          case 'download_file': {
            try {
              if (typeof args.path !== 'string' || !args.path) {
                throw new Error('File path is required')
              }
              const { base64, node } = await downloadDatasafeFile(resolvedContext, args.path)
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({ ok: true, data: { base64, node } })
                  }
                ],
                isError: false
              }
            } catch (err) {
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: false,
                      error: err.statusMessage || err.message || 'Failed to download file',
                      path: args.path
                    })
                  }
                ],
                isError: true
              }
            }
            break
          }

          case 'upload_file': {
            try {
              const path = typeof args.path === 'string' ? (args.path as string) : ''
              const base64 = typeof args.base64 === 'string' ? (args.base64 as string) : ''
              const mimeType =
                typeof args.mimeType === 'string'
                  ? (args.mimeType as string)
                  : 'application/octet-stream'
              if (!path || !base64) {
                throw new Error('Path and base64 payload are required')
              }
              const size =
                typeof args.size === 'number'
                  ? (args.size as number)
                  : Buffer.from(base64, 'base64').length
              const overwrite = Boolean(args.overwrite)
              const node = await uploadDatasafeFile(resolvedContext, {
                path,
                base64,
                mimeType,
                size,
                overwrite,
                metadata: { uploadedVia: 'mcp-http' }
              })
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({ ok: true, data: node })
                  }
                ],
                isError: false
              }
            } catch (err) {
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: false,
                      error: err.statusMessage || err.message || 'Failed to upload file',
                      path: args.path
                    })
                  }
                ],
                isError: true
              }
            }
            break
          }

          case 'create_folder': {
            try {
              if (typeof args.path !== 'string' || !args.path) {
                throw new Error('Folder path is required')
              }
              const folder = await createDatasafeFolder(resolvedContext, args.path)
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({ ok: true, data: folder })
                  }
                ],
                isError: false
              }
            } catch (err) {
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: false,
                      error: err.statusMessage || err.message || 'Failed to create folder',
                      path: args.path
                    })
                  }
                ],
                isError: true
              }
            }
            break
          }

          case 'recommend_placement': {
            try {
              if (typeof args.filename !== 'string' || !args.filename) {
                throw new Error('Filename is required')
              }
              const recommendation = await recommendDatasafePlacement(resolvedContext, {
                filename: args.filename as string,
                mimeType:
                  typeof args.mimeType === 'string'
                    ? (args.mimeType as string)
                    : 'application/octet-stream',
                size: typeof args.size === 'number' ? (args.size as number) : 0,
                encoding: 'base64',
                data: '',
                source: 'mcp',
                emailMeta: {
                  subject: typeof args.subject === 'string' ? (args.subject as string) : undefined,
                  from: typeof args.from === 'string' ? (args.from as string) : undefined
                },
                tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined
              })
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({ ok: true, data: recommendation })
                  }
                ],
                isError: false
              }
            } catch (err) {
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: false,
                      error: err.statusMessage || err.message || 'Failed to recommend placement',
                      filename: args.filename
                    })
                  }
                ],
                isError: true
              }
            }
            break
          }

          case 'store_attachment': {
            try {
              if (typeof args.filename !== 'string' || !args.filename) {
                throw new Error('Filename is required')
              }
              if (typeof args.base64 !== 'string' || !args.base64) {
                throw new Error('Base64 payload is required')
              }
              const node = await storeDatasafeAttachment(
                resolvedContext,
                {
                  filename: args.filename as string,
                  mimeType:
                    typeof args.mimeType === 'string'
                      ? (args.mimeType as string)
                      : 'application/octet-stream',
                  size:
                    typeof args.size === 'number'
                      ? (args.size as number)
                      : Buffer.from(args.base64 as string, 'base64').length,
                  data: args.base64 as string,
                  encoding: 'base64',
                  source: 'mcp',
                  emailMeta: {
                    subject:
                      typeof args.subject === 'string' ? (args.subject as string) : undefined,
                    from: typeof args.from === 'string' ? (args.from as string) : undefined
                  }
                },
                { overwrite: Boolean(args.overwrite) }
              )
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({ ok: true, data: node })
                  }
                ],
                isError: false
              }
            } catch (err) {
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: false,
                      error: err.statusMessage || err.message || 'Failed to store attachment',
                      filename: args.filename
                    })
                  }
                ],
                isError: true
              }
            }
            break
          }

          case 'list_rules': {
            try {
              const rules = await listDatasafeRules(resolvedContext)
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({ ok: true, count: rules.length, data: rules })
                  }
                ],
                isError: false
              }
            } catch (err) {
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: false,
                      error: err.statusMessage || err.message || 'Failed to list rules'
                    })
                  }
                ],
                isError: true
              }
            }
            break
          }

          case 'get_stats': {
            try {
              const limit = typeof args.limit === 'number' ? (args.limit as number) : undefined
              const stats = await getDatasafeStats(resolvedContext, limit)
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({ ok: true, data: stats })
                  }
                ],
                isError: false
              }
            } catch (err) {
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: false,
                      error: err.statusMessage || err.message || 'Failed to get stats'
                    })
                  }
                ],
                isError: true
              }
            }
            break
          }

          default:
            throw createError({ statusCode: 400, statusMessage: `Unknown tool: ${toolName}` })
        }

        result = toolResult
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
    console.error('[BuiltinDatasafeMCP] Error handling request:', error)
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
