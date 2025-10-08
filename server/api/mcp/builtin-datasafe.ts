/**
 * Builtin Datasafe MCP Server Endpoint
 *
 * Accepts MCP JSON-RPC 2.0 requests over HTTP and surfaces Datasafe tools.
 */

import { Buffer } from 'node:buffer'
import {
  defineEventHandler,
  getRequestHeaders,
  getRequestHeader,
  readBody,
  setResponseHeader,
  setResponseStatus,
  createError
} from 'h3'
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
} from '../../mcp/builtin/datasafe'

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
      console.error('[BuiltinDatasafeMCP] Authentication failed:', authError)
      throw authError
    }
  } else {
    // Development mode: skip session validation, use header values
    console.log('[BuiltinDatasafeMCP] Development mode - using teamId from header:', teamId)
    session = {
      user: { id: userId, name: 'Test User', email: 'test@example.com' },
      team: { id: teamId, name: 'Test Team' }
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

  const baseContext: DatasafeMcpContext = {
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
            name: 'builtin-datasafe-server',
            version: '1.0.0'
          }
        }
        break
      }

      case 'tools/list': {
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
              ]
            }
            break
          }

          case 'download_file': {
            if (typeof args.path !== 'string' || !args.path) {
              throw createError({ statusCode: 400, statusMessage: 'File path is required' })
            }
            const { base64, node } = await downloadDatasafeFile(resolvedContext, args.path)
            toolResult = {
              content: [
                {
                  type: 'text',
                  text: formatJson({ ok: true, data: { base64, node } })
                }
              ]
            }
            break
          }

          case 'upload_file': {
            const path = typeof args.path === 'string' ? (args.path as string) : ''
            const base64 = typeof args.base64 === 'string' ? (args.base64 as string) : ''
            const mimeType =
              typeof args.mimeType === 'string'
                ? (args.mimeType as string)
                : 'application/octet-stream'
            if (!path || !base64) {
              throw createError({
                statusCode: 400,
                statusMessage: 'Path and base64 payload are required'
              })
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
              ]
            }
            break
          }

          case 'create_folder': {
            if (typeof args.path !== 'string' || !args.path) {
              throw createError({ statusCode: 400, statusMessage: 'Folder path is required' })
            }
            const folder = await createDatasafeFolder(resolvedContext, args.path)
            toolResult = {
              content: [
                {
                  type: 'text',
                  text: formatJson({ ok: true, data: folder })
                }
              ]
            }
            break
          }

          case 'recommend_placement': {
            if (typeof args.filename !== 'string' || !args.filename) {
              throw createError({ statusCode: 400, statusMessage: 'Filename is required' })
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
              ]
            }
            break
          }

          case 'store_attachment': {
            if (typeof args.filename !== 'string' || !args.filename) {
              throw createError({ statusCode: 400, statusMessage: 'Filename is required' })
            }
            if (typeof args.base64 !== 'string' || !args.base64) {
              throw createError({ statusCode: 400, statusMessage: 'Base64 payload is required' })
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
                  subject: typeof args.subject === 'string' ? (args.subject as string) : undefined,
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
              ]
            }
            break
          }

          case 'list_rules': {
            const rules = await listDatasafeRules(resolvedContext)
            toolResult = {
              content: [
                {
                  type: 'text',
                  text: formatJson({ ok: true, count: rules.length, data: rules })
                }
              ]
            }
            break
          }

          case 'get_stats': {
            const limit = typeof args.limit === 'number' ? (args.limit as number) : undefined
            const stats = await getDatasafeStats(resolvedContext, limit)
            toolResult = {
              content: [
                {
                  type: 'text',
                  text: formatJson({ ok: true, data: stats })
                }
              ]
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
