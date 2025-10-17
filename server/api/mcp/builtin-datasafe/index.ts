/**
 * Builtin Datasafe MCP Server Endpoint
 *
 * Accepts MCP JSON-RPC 2.0 requests over HTTP and surfaces Datasafe tools.
 */

import { Buffer } from 'node:buffer'
import {
  defineEventHandler,
  readBody,
  setResponseHeader,
  setResponseStatus,
  createError,
  getRequestHeader
} from 'h3'
import type { H3Event } from 'h3'

import {
  listDatasafeFolder,
  downloadDatasafeFile,
  uploadDatasafeFile,
  createDatasafeFolder,
  deleteDatasafeFolder,
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
              name: 'delete_folders',
              description:
                'Delete one or many folders from the Datasafe. Use with caution - this action cannot be undone.',
              inputSchema: {
                type: 'object',
                properties: {
                  paths: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of folder paths to delete'
                  },
                  teamId: { type: 'string' },
                  userId: { type: 'string' },
                  force: {
                    type: 'boolean',
                    description: 'Force deletion even if folders contain files (default: false)'
                  }
                },
                required: ['paths'],
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
              // Handle "folder not found" more gracefully - don't treat as error
              if (err.statusMessage?.includes('not found') || err.message?.includes('not found')) {
                toolResult = {
                  content: [
                    {
                      type: 'text',
                      text: formatJson({
                        ok: true,
                        summary: `Folder '${args.path}' does not exist or has been deleted`,
                        data: {
                          id: 'not-found',
                          name: args.path || 'Unknown',
                          path: args.path || '',
                          type: 'folder',
                          children: [],
                          note: 'Folder not found - may have been deleted'
                        }
                      })
                    }
                  ],
                  isError: false
                }
              } else {
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
            }
            break
          }

          case 'get_file_info': {
            try {
              if (typeof args.path !== 'string' || !args.path) {
                throw new Error('File path is required')
              }
              const path = args.path as string
              // Derive folder path and filename
              const parts = path.split('/')
              const filename = parts.pop() as string
              const folderPath = parts.join('/') || undefined
              const folder = await listDatasafeFolder(resolvedContext, folderPath)
              const file = folder.children.find(
                (child) => child.type === 'file' && child.name === filename
              )
              if (!file) {
                throw new Error(`File not found: ${path}`)
              }
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({ ok: true, data: file })
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
                      error: err.statusMessage || err.message || 'Failed to get file info',
                      path: args.path
                    })
                  }
                ],
                isError: true
              }
            }
            break
          }

          case 'search_files': {
            try {
              if (typeof args.query !== 'string' || !args.query) {
                throw new Error('Search query is required')
              }
              const { flattenFiles } = await import('./helpers')
              const query = (args.query as string).toLowerCase()
              const fileType =
                typeof args.fileType === 'string' ? (args.fileType as string) : undefined
              const maxResults =
                typeof args.maxResults === 'number' ? (args.maxResults as number) : 20
              const sortBy = (args.sortBy as string) || 'date'

              const tree = await listDatasafeFolder(resolvedContext)
              const allFiles = flattenFiles(tree)

              const filtered = allFiles.filter((file) => {
                const matchesQuery = file.path.toLowerCase().includes(query)
                if (!matchesQuery) return false
                if (!fileType) return true
                // fileType support is limited here due to minimal file object; rely on path extension
                if (fileType === 'image') return /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(file.path)
                if (fileType === 'document') return /\.(pdf|docx?|txt|rtf|odt)$/i.test(file.path)
                if (fileType === 'video') return /\.(mp4|mov|avi|mkv|webm)$/i.test(file.path)
                if (fileType === 'audio') return /\.(mp3|wav|m4a|aac|flac)$/i.test(file.path)
                if (fileType === 'text') return /\.(txt|md|csv|log)$/i.test(file.path)
                return file.path.toLowerCase().endsWith(`.${fileType.toLowerCase()}`)
              })

              filtered.sort((a, b) => {
                switch (sortBy) {
                  case 'name':
                    return a.path.localeCompare(b.path)
                  case 'size':
                    return b.size - a.size
                  case 'type':
                    return a.path.localeCompare(b.path)
                  case 'date':
                  default:
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                }
              })

              const results = filtered.slice(0, maxResults)
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: true,
                      data: {
                        query,
                        results,
                        totalFound: filtered.length,
                        returned: results.length
                      }
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
                      error: err.statusMessage || err.message || 'Failed to search files',
                      query: args.query
                    })
                  }
                ],
                isError: true
              }
            }
            break
          }

          case 'get_recent_files': {
            try {
              const limit = typeof args.limit === 'number' ? (args.limit as number) : 10
              const fileType =
                typeof args.fileType === 'string' ? (args.fileType as string) : undefined
              const sortBy = (args.sortBy as string) === 'created' ? 'created' : 'updated'
              const { flattenFiles } = await import('./helpers')
              const tree = await listDatasafeFolder(resolvedContext)
              const allFiles = flattenFiles(tree)

              console.log(
                `[BuiltinDatasafeMCP] get_recent_files: Found ${allFiles.length} total files`
              )

              let filtered = allFiles
              if (fileType) {
                filtered = allFiles.filter((file) => {
                  if (fileType === 'image') return /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(file.path)
                  if (fileType === 'document') return /\.(pdf|docx?|txt|rtf|odt)$/i.test(file.path)
                  if (fileType === 'video') return /\.(mp4|mov|avi|mkv|webm)$/i.test(file.path)
                  if (fileType === 'audio') return /\.(mp3|wav|m4a|aac|flac)$/i.test(file.path)
                  if (fileType === 'text') return /\.(txt|md|csv|log)$/i.test(file.path)
                  return file.path.toLowerCase().endsWith(`.${fileType.toLowerCase()}`)
                })
              }

              filtered.sort((a, b) => {
                const dateA = new Date(sortBy === 'created' ? a.updatedAt : a.updatedAt) // fallback to updatedAt
                const dateB = new Date(sortBy === 'created' ? b.updatedAt : b.updatedAt)
                return dateB.getTime() - dateA.getTime()
              })

              const results = filtered.slice(0, limit)
              console.log(
                `[BuiltinDatasafeMCP] get_recent_files: Returning ${results.length} results`
              )

              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: `Found ${results.length} recent files in datasafe. Total files: ${allFiles.length}`
                  }
                ],
                isError: false
              }

              console.log(`[BuiltinDatasafeMCP] get_recent_files: Tool result prepared:`, {
                hasContent: !!toolResult.content,
                contentLength: toolResult.content?.[0]?.text?.length || 0,
                isError: toolResult.isError
              })

              // Debug: Log the actual tool result structure
              console.log(`[BuiltinDatasafeMCP] get_recent_files: Full tool result structure:`, {
                toolResultType: typeof toolResult,
                toolResultKeys: Object.keys(toolResult || {}),
                contentType: typeof toolResult.content,
                contentLength: toolResult.content?.length,
                firstContentItem: toolResult.content?.[0]
                  ? {
                      type: toolResult.content[0].type,
                      textLength: toolResult.content[0].text?.length,
                      textPreview: toolResult.content[0].text?.substring(0, 200) + '...'
                    }
                  : null
              })
            } catch (err) {
              console.error(`[BuiltinDatasafeMCP] get_recent_files error:`, err)
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: false,
                      error: err.statusMessage || err.message || 'Failed to get recent files'
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

          case 'delete_folders': {
            try {
              if (!Array.isArray(args.paths) || args.paths.length === 0) {
                throw new Error('Paths array is required and must not be empty')
              }

              const results = []
              const errors = []
              const force = args.force === true

              for (const path of args.paths) {
                if (typeof path !== 'string' || !path) {
                  errors.push({ path, error: 'Invalid path provided' })
                  continue
                }

                try {
                  // Check if folder exists and has contents (unless force is true)
                  if (!force) {
                    try {
                      const folderContents = await listDatasafeFolder(resolvedContext, path)
                      if (
                        folderContents &&
                        folderContents.files &&
                        folderContents.files.length > 0
                      ) {
                        errors.push({
                          path,
                          error: 'Folder contains files. Use force=true to delete anyway.'
                        })
                        continue
                      }
                    } catch (listErr) {
                      // If folder doesn't exist, that's fine - it's already "deleted"
                      if (
                        listErr.statusMessage?.includes('not found') ||
                        listErr.message?.includes('not found')
                      ) {
                        results.push({
                          path,
                          deleted: true,
                          data: {
                            deleted: true,
                            path,
                            note: 'Folder was already deleted or does not exist'
                          }
                        })
                        continue
                      }
                      // Re-throw other errors
                      throw listErr
                    }
                  }

                  // Delete the folder
                  const deleted = await deleteDatasafeFolder(resolvedContext, path)
                  results.push({ path, deleted: true, data: deleted })
                } catch (err) {
                  // Handle "folder not found" as success (already deleted)
                  if (
                    err.statusMessage?.includes('not found') ||
                    err.message?.includes('not found')
                  ) {
                    results.push({
                      path,
                      deleted: true,
                      data: {
                        deleted: true,
                        path,
                        note: 'Folder was already deleted or does not exist'
                      }
                    })
                  } else {
                    errors.push({
                      path,
                      error: err.statusMessage || err.message || 'Failed to delete folder'
                    })
                  }
                }
              }

              const summary = {
                ok: errors.length === 0,
                deleted: results.length,
                failed: errors.length,
                results,
                errors: errors.length > 0 ? errors : undefined
              }

              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson(summary)
                  }
                ],
                isError: errors.length > 0
              }
            } catch (err) {
              toolResult = {
                content: [
                  {
                    type: 'text',
                    text: formatJson({
                      ok: false,
                      error: err.statusMessage || err.message || 'Failed to delete folders',
                      paths: args.paths
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
        console.log(`[BuiltinDatasafeMCP] Final tool result:`, {
          hasContent: !!toolResult.content,
          contentLength: toolResult.content?.[0]?.text?.length || 0,
          isError: toolResult.isError,
          resultType: typeof toolResult
        })

        // Debug: Log the complete tool result structure
        console.log(
          `[BuiltinDatasafeMCP] Complete tool result for '${toolName}':`,
          JSON.stringify(toolResult, null, 2)
        )

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
