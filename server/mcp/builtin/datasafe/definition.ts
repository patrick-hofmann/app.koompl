import { Buffer } from 'node:buffer'
import type { BuiltinMcpDefinition } from '../shared'
import type { DatasafeMcpContext } from './context'
import {
  createDatasafeFolder,
  downloadDatasafeFile,
  getDatasafeStats,
  listDatasafeFolder,
  listDatasafeRules,
  recommendDatasafePlacement,
  storeDatasafeAttachment,
  uploadDatasafeFile
} from './operations'

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

export const datasafeDefinition: BuiltinMcpDefinition<DatasafeMcpContext> = {
  id: 'builtin-datasafe',
  serverName: 'builtin-datasafe-server',
  logPrefix: '[BuiltinDatasafeMCP]',
  context: {
    spec: {
      teamIdEnv: 'DATASAFE_TEAM_ID',
      userIdEnv: 'DATASAFE_USER_ID',
      agentIdEnv: 'DATASAFE_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.DATASAFE_TEAM_ID as string,
      userId: env.DATASAFE_USER_ID as string,
      agentId: env.DATASAFE_AGENT_ID || undefined
    })
  },
  tools: [
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
      },
      execute: async ({ context, args }) => {
        const { path } = args as { path?: string }
        const folder = await listDatasafeFolder(context, path)
        return {
          success: true,
          data: folder,
          summary: `Found ${folder.children.length} items in ${path || '/'}`
        }
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
      },
      execute: async ({ context, args }) => {
        const { path } = args as { path?: string }
        if (!path) {
          return { success: false, error: 'path is required' }
        }
        const file = await downloadDatasafeFile(context, path)
        return {
          success: true,
          data: file,
          summary: `Downloaded file ${path}`
        }
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
      },
      execute: async ({ context, args }) => {
        const { path, base64, mimeType, size, overwrite } = args as {
          path?: string
          base64?: string
          mimeType?: string
          size?: number
          overwrite?: boolean
        }
        if (!path || !base64 || !mimeType) {
          return {
            success: false,
            error: 'path, base64 and mimeType are required'
          }
        }
        const resolvedSize = resolveSize(base64, size)
        const node = await uploadDatasafeFile(context, {
          path,
          base64,
          mimeType,
          size: resolvedSize,
          overwrite
        })
        return {
          success: true,
          data: node,
          summary: `Uploaded file to ${path}`
        }
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
      },
      execute: async ({ context, args }) => {
        const { path } = args as { path?: string }
        if (!path) {
          return { success: false, error: 'path is required' }
        }
        const folder = await createDatasafeFolder(context, path)
        return {
          success: true,
          data: folder,
          summary: `Created folder ${path}`
        }
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
      },
      execute: async ({ context, args }) => {
        const { filename, mimeType, size, subject, from, tags } = args as {
          filename?: string
          mimeType?: string
          size?: number
          subject?: string
          from?: string
          tags?: string[]
        }
        if (!filename || !mimeType) {
          return { success: false, error: 'filename and mimeType are required' }
        }
        const recommendation = await recommendDatasafePlacement(context, {
          filename,
          mimeType,
          size,
          subject,
          from,
          tags
        })
        return {
          success: true,
          data: recommendation,
          summary: recommendation
            ? `Recommended path ${recommendation.path}`
            : 'No recommendation available'
        }
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
      },
      execute: async ({ context, args }) => {
        const { filename, base64, mimeType, size, subject, from, overwrite } = args as {
          filename?: string
          base64?: string
          mimeType?: string
          size?: number
          subject?: string
          from?: string
          overwrite?: boolean
        }
        if (!filename || !base64 || !mimeType) {
          return {
            success: false,
            error: 'filename, base64 and mimeType are required'
          }
        }
        const stored = await storeDatasafeAttachment(context, {
          filename,
          base64,
          mimeType,
          size: resolveSize(base64, size),
          subject,
          from,
          overwrite
        })
        return {
          success: true,
          data: stored,
          summary: `Stored attachment as ${stored.path}`
        }
      }
    },
    {
      name: 'list_rules',
      description: 'List Datasafe automation rules for the current team',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async ({ context }) => {
        const rules = await listDatasafeRules(context)
        return {
          success: true,
          data: rules,
          summary: `Found ${rules.length} rules`
        }
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
            description: 'Limit number of items in summaries'
          }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const { limit } = args as { limit?: number }
        const stats = await getDatasafeStats(context, limit)
        return {
          success: true,
          data: stats,
          summary: stats.empty
            ? 'Datasafe vault is empty'
            : `Datasafe contains ${stats.totalFiles} files across ${stats.totalFolders} folders`
        }
      }
    }
  ]
}
