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

  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [BuiltinDatasafeMCP] Authenticated:`, {
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
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] [BuiltinDatasafeMCP] Method: initialize`)
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
        const startTime = Date.now()
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] [BuiltinDatasafeMCP] Method: tools/list`)
        result = {
          tools: [
            {
              name: 'list_folder',
              description:
                'List folders and files for a given Datasafe path with detailed metadata',
              inputSchema: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: 'Optional folder path (defaults to root)'
                  },
                  includeMetadata: {
                    type: 'boolean',
                    description:
                      'Include detailed file metadata (size, mimeType, dates) - default true'
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
              name: 'copy_email_attachment_to_datasafe',
              description:
                'Copy an email attachment from email storage to datasafe. Use this to access email attachments without passing binary data through AI. First copy the attachment to datasafe, then use regular datasafe tools to work with it.',
              inputSchema: {
                type: 'object',
                properties: {
                  message_id: {
                    type: 'string',
                    description: 'Message ID of the email containing the attachment'
                  },
                  filename: {
                    type: 'string',
                    description: 'Filename of the attachment to copy'
                  },
                  target_path: {
                    type: 'string',
                    description:
                      'Target path in datasafe (e.g., "Documents/filename.pdf" or "test1/filename.png")'
                  },
                  overwrite: {
                    type: 'boolean',
                    description: 'Whether to overwrite if file exists (default: false)'
                  },
                  teamId: { type: 'string' },
                  userId: { type: 'string' }
                },
                required: ['message_id', 'filename', 'target_path'],
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
              name: 'get_file_info',
              description: 'Get detailed information about a specific file without downloading it',
              inputSchema: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: 'Full path to the file'
                  },
                  teamId: { type: 'string' },
                  userId: { type: 'string' }
                },
                required: ['path'],
                additionalProperties: false
              }
            },
            {
              name: 'search_files',
              description: 'Search for files by name, type, or other criteria without downloading',
              inputSchema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query (filename, extension, or keyword)'
                  },
                  fileType: {
                    type: 'string',
                    description:
                      'Filter by file type: image, document, video, audio, text, or specific mime type'
                  },
                  maxResults: {
                    type: 'number',
                    description: 'Maximum number of results to return (default 20)'
                  },
                  sortBy: {
                    type: 'string',
                    enum: ['name', 'size', 'date', 'type'],
                    description: 'Sort results by name, size, date, or type (default: date)'
                  },
                  teamId: { type: 'string' },
                  userId: { type: 'string' }
                },
                required: ['query'],
                additionalProperties: false
              }
            },
            {
              name: 'get_recent_files',
              description: 'Get the most recently added or modified files without downloading',
              inputSchema: {
                type: 'object',
                properties: {
                  limit: {
                    type: 'number',
                    description: 'Number of recent files to return (default 10)'
                  },
                  fileType: {
                    type: 'string',
                    description:
                      'Filter by file type: image, document, video, audio, text, or specific mime type'
                  },
                  sortBy: {
                    type: 'string',
                    enum: ['created', 'updated'],
                    description: 'Sort by creation date or last updated date (default: updated)'
                  },
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
        const duration = Date.now() - startTime
        const endTimestamp = new Date().toISOString()
        console.log(
          `[${endTimestamp}] [BuiltinDatasafeMCP] ⏱️  tools/list completed in ${duration}ms (${result.tools.length} tools)`
        )
        break
      }

      case 'notifications/initialized': {
        // MCP protocol notification - acknowledge and continue
        result = { success: true }
        break
      }

      case 'tools/call': {
        const toolStartTime = Date.now()
        const toolName = body.params?.name
        const args = body.params?.arguments || {}

        if (!toolName) {
          throw createError({ statusCode: 400, statusMessage: 'Tool name is required' })
        }

        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] [BuiltinDatasafeMCP] Tool called: ${toolName}`, {
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

          case 'copy_email_attachment_to_datasafe': {
            const startTime = Date.now()
            try {
              if (typeof args.message_id !== 'string' || !args.message_id) {
                throw new Error('message_id is required')
              }
              if (typeof args.filename !== 'string' || !args.filename) {
                throw new Error('filename is required')
              }
              if (typeof args.target_path !== 'string' || !args.target_path) {
                throw new Error('target_path is required')
              }

              console.log(
                `[BuiltinDatasafeMCP] Copying email attachment: ${args.filename} from message ${args.message_id} to ${args.target_path}`
              )

              const { copyEmailAttachmentToDatasafe } = await import('../../../features/datasafe')
              const node = await copyEmailAttachmentToDatasafe(resolvedContext, {
                messageId: args.message_id as string,
                filename: args.filename as string,
                targetPath: args.target_path as string,
                overwrite: Boolean(args.overwrite)
              })

              const duration = Date.now() - startTime
              console.log(
                `[BuiltinDatasafeMCP] ⏱️  Copied attachment in ${duration}ms: ${node.path} (${node.size} bytes)`
              )

              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: true,
                      data: {
                        path: node.path,
                        size: node.size,
                        mimeType: node.mimeType,
                        createdAt: node.createdAt
                      },
                      summary: `Successfully copied '${args.filename}' to ${node.path}`
                    })
                  }
                ],
                isError: false
              }
            } catch (err) {
              const duration = Date.now() - startTime
              console.error(
                `[BuiltinDatasafeMCP] ⏱️  Failed to copy attachment in ${duration}ms:`,
                err
              )
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: false,
                      error: err.statusMessage || err.message || 'Failed to copy email attachment',
                      messageId: args.message_id,
                      filename: args.filename
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

        const toolDuration = Date.now() - toolStartTime
        console.log(`[BuiltinDatasafeMCP] ⏱️  Tool '${toolName}' completed in ${toolDuration}ms`)

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
