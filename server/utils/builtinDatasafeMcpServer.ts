#!/usr/bin/env node

/**
 * Built-in Datasafe MCP Server
 * Provides MCP access to the team datasafe file vault
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Buffer } from 'node:buffer'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js'
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
} from './mcpDatasafe'
import { ensureTeamDatasafe } from './datasafeStorage'

function getDatasafeContext(): DatasafeMcpContext {
  const teamId = process.env.DATASAFE_TEAM_ID
  const userId = process.env.DATASAFE_USER_ID
  const agentId = process.env.DATASAFE_AGENT_ID

  if (!teamId || !userId) {
    throw new Error('Missing DATASAFE_TEAM_ID or DATASAFE_USER_ID environment variables')
  }

  return {
    teamId,
    userId,
    agentId
  }
}

function resolveSize(base64: string, providedSize?: number): number {
  if (typeof providedSize === 'number' && !Number.isNaN(providedSize) && providedSize > 0) {
    return providedSize
  }
  try {
    return Buffer.from(base64, 'base64').length
  } catch {
    return 0
  }
}

async function main() {
  const server = new Server(
    {
      name: 'builtin-datasafe-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: 'list_folder',
        description: 'List contents (folders/files) of a datasafe folder path',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Optional folder path (default root)'
            }
          },
          additionalProperties: false
        }
      },
      {
        name: 'download_file',
        description: 'Download a file from the datasafe as base64',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Full file path inside datasafe'
            }
          },
          required: ['path'],
          additionalProperties: false
        }
      },
      {
        name: 'upload_file',
        description: 'Upload or overwrite a file in the datasafe using base64 content',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Target file path (including filename)'
            },
            base64: {
              type: 'string',
              description: 'Base64 encoded file data'
            },
            mimeType: {
              type: 'string',
              description: 'MIME type of the file'
            },
            size: {
              type: 'number',
              description: 'Original file size in bytes'
            },
            overwrite: {
              type: 'boolean',
              description: 'Whether to overwrite existing files (default false)'
            }
          },
          required: ['path', 'base64', 'mimeType'],
          additionalProperties: false
        }
      },
      {
        name: 'create_folder',
        description: 'Ensure a folder (and parents) exist in the datasafe',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Folder path to create'
            }
          },
          required: ['path'],
          additionalProperties: false
        }
      },
      {
        name: 'recommend_placement',
        description:
          'Get recommended folder placement based on datasafe rules for an attachment or document',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            mimeType: { type: 'string' },
            size: { type: 'number' },
            subject: { type: 'string' },
            from: { type: 'string' },
            tags: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['filename', 'mimeType'],
          additionalProperties: false
        }
      },
      {
        name: 'store_attachment',
        description: 'Store a base64 attachment using datasafe rules (returns stored file path)',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            base64: { type: 'string' },
            mimeType: { type: 'string' },
            size: { type: 'number' },
            subject: { type: 'string' },
            from: { type: 'string' },
            overwrite: { type: 'boolean' }
          },
          required: ['filename', 'base64', 'mimeType'],
          additionalProperties: false
        }
      },
      {
        name: 'list_rules',
        description: 'List Datasafe automation rules for the current team',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: 'get_stats',
        description: 'Summarize Datasafe usage including total files, size, and recent updates',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Optional limit for recent items and folder summaries'
            }
          },
          additionalProperties: false
        }
      }
    ]

    return {
      tools
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params?.name
    if (!name) {
      throw new Error('Tool name missing')
    }

    const context = getDatasafeContext()
    await ensureTeamDatasafe(context.teamId)

    switch (name) {
      case 'list_folder': {
        const path =
          typeof request.params?.arguments?.path === 'string'
            ? request.params.arguments.path
            : undefined
        const folder = await listDatasafeFolder(context, path)
        return {
          content: [
            {
              type: 'application/json',
              data: {
                ok: true,
                folder
              }
            }
          ]
        }
      }
      case 'download_file': {
        const path = String(request.params?.arguments?.path || '')
        if (!path) throw new Error('File path is required')
        const { base64, node } = await downloadDatasafeFile(context, path)
        return {
          content: [
            {
              type: 'application/json',
              data: {
                ok: true,
                file: {
                  base64,
                  node
                }
              }
            }
          ]
        }
      }
      case 'upload_file': {
        const args = request.params?.arguments || {}
        const path = String(args.path || '')
        const base64 = String(args.base64 || '')
        const mimeType = String(args.mimeType || 'application/octet-stream')
        if (!path || !base64) throw new Error('Path and base64 data are required')
        const size = resolveSize(base64, typeof args.size === 'number' ? args.size : undefined)
        const overwrite = Boolean(args.overwrite)
        const node = await uploadDatasafeFile(context, {
          path,
          base64,
          mimeType,
          size,
          overwrite,
          metadata: {
            uploadedVia: 'mcp'
          }
        })
        return {
          content: [
            {
              type: 'application/json',
              data: { ok: true, node }
            }
          ]
        }
      }
      case 'create_folder': {
        const path = String(request.params?.arguments?.path || '')
        if (!path) throw new Error('Folder path is required')
        const folder = await createDatasafeFolder(context, path)
        return {
          content: [
            {
              type: 'application/json',
              data: { ok: true, folder }
            }
          ]
        }
      }
      case 'recommend_placement': {
        const args = request.params?.arguments || {}
        const filename = String(args.filename || '')
        const mimeType = String(args.mimeType || 'application/octet-stream')
        if (!filename) throw new Error('Filename required for recommendation')
        const size = typeof args.size === 'number' ? args.size : 0
        const recommendation = await recommendDatasafePlacement(context, {
          filename,
          mimeType,
          size,
          data: '',
          encoding: 'base64',
          source: 'mcp',
          emailMeta: {
            subject: typeof args.subject === 'string' ? args.subject : undefined,
            from: typeof args.from === 'string' ? args.from : undefined
          },
          tags: Array.isArray(args.tags) ? args.tags : undefined
        })
        return {
          content: [
            {
              type: 'application/json',
              data: { ok: true, recommendation }
            }
          ]
        }
      }
      case 'store_attachment': {
        const args = request.params?.arguments || {}
        const filename = String(args.filename || '')
        const base64 = String(args.base64 || '')
        const mimeType = String(args.mimeType || 'application/octet-stream')
        if (!filename || !base64) throw new Error('Filename and base64 data are required')
        const size = resolveSize(base64, typeof args.size === 'number' ? args.size : undefined)
        const node = await storeDatasafeAttachment(
          context,
          {
            filename,
            data: base64,
            encoding: 'base64',
            mimeType,
            size,
            source: 'mcp',
            emailMeta: {
              subject: typeof args.subject === 'string' ? args.subject : undefined,
              from: typeof args.from === 'string' ? args.from : undefined
            }
          },
          { overwrite: Boolean(args.overwrite) }
        )
        return {
          content: [
            {
              type: 'application/json',
              data: { ok: true, node }
            }
          ]
        }
      }
      case 'list_rules': {
        const rules = await listDatasafeRules(context)
        return {
          content: [
            {
              type: 'application/json',
              data: { ok: true, rules }
            }
          ]
        }
      }
      case 'get_stats': {
        const args = request.params?.arguments || {}
        const limit = typeof args.limit === 'number' ? args.limit : undefined
        const stats = await getDatasafeStats(context, limit)
        return {
          content: [
            {
              type: 'application/json',
              data: { ok: true, stats }
            }
          ]
        }
      }
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.log('[BuiltinDatasafeMCP] Datasafe MCP server ready')
}

main().catch((error) => {
  console.error('[BuiltinDatasafeMCP] Fatal error', error)
  process.exit(1)
})
