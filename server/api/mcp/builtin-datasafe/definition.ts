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

// Helper functions for file metadata formatting
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatFileAge(dateString: string): string {
  const now = new Date()
  const fileDate = new Date(dateString)
  const diffMs = now.getTime() - fileDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
  return 'just now'
}

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('text/')) return 'text'
  if (mimeType === 'application/pdf') return 'document'
  if (
    mimeType.startsWith('application/msword') ||
    mimeType.startsWith('application/vnd.openxmlformats-officedocument')
  )
    return 'document'
  if (mimeType.startsWith('application/')) return 'application'
  return 'other'
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
      description: 'List contents (folders/files) of a datasafe folder path with detailed metadata',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Optional folder path (default root)'
          },
          includeMetadata: {
            type: 'boolean',
            description: 'Include detailed file metadata (size, mimeType, dates) - default true'
          }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinDatasafeMCP] Tool called: list_folder', {
          args: { path: (args as { path?: string }).path }
        })
        const { path, includeMetadata = true } = args as {
          path?: string
          includeMetadata?: boolean
        }
        const folder = await listDatasafeFolder(context, path)

        // Enhance file metadata for better agent understanding
        const enhancedFolder = {
          ...folder,
          children: folder.children.map((child) => {
            if (child.type === 'file' && includeMetadata) {
              return {
                ...child,
                // Add human-readable size and date info
                sizeFormatted: formatFileSize(child.size),
                ageFormatted: formatFileAge(child.createdAt),
                updatedAgeFormatted: formatFileAge(child.updatedAt),
                // Add file type category for easier filtering
                fileCategory: getFileCategory(child.mimeType),
                // Add whether it's an image for quick identification
                isImage: child.mimeType.startsWith('image/'),
                isDocument: [
                  'application/pdf',
                  'text/',
                  'application/msword',
                  'application/vnd.openxmlformats-officedocument'
                ].some((prefix) => child.mimeType.startsWith(prefix))
              }
            }
            return child
          })
        }

        console.log('[BuiltinDatasafeMCP] Tool result: list_folder', {
          path: path || '/',
          itemCount: folder.children.length,
          files: folder.children.filter((c) => c.type === 'file').length,
          folders: folder.children.filter((c) => c.type === 'folder').length
        })

        return {
          success: true,
          data: enhancedFolder,
          summary: `Found ${folder.children.length} items in ${path || '/'} (${folder.children.filter((c) => c.type === 'file').length} files, ${folder.children.filter((c) => c.type === 'folder').length} folders)`
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
        console.log('[BuiltinDatasafeMCP] Tool called: download_file', {
          args: { path: (args as { path?: string }).path }
        })
        const { path } = args as { path?: string }
        if (!path) {
          return { success: false, error: 'path is required' }
        }
        const file = await downloadDatasafeFile(context, path)
        console.log('[BuiltinDatasafeMCP] Tool result: download_file', {
          path,
          size: file.size,
          mimeType: file.mimeType
        })
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
        console.log('[BuiltinDatasafeMCP] Tool called: upload_file', {
          args: {
            path: (args as { path?: string }).path,
            size: (args as { size?: number }).size,
            mimeType: (args as { mimeType?: string }).mimeType
          }
        })
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
        console.log('[BuiltinDatasafeMCP] Tool result: upload_file', {
          path,
          size: resolvedSize,
          mimeType
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
        console.log('[BuiltinDatasafeMCP] Tool called: create_folder', {
          args: { path: (args as { path?: string }).path }
        })
        const { path } = args as { path?: string }
        if (!path) {
          return { success: false, error: 'path is required' }
        }
        const folder = await createDatasafeFolder(context, path)
        console.log('[BuiltinDatasafeMCP] Tool result: create_folder', {
          path,
          id: folder.id
        })
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
        console.log('[BuiltinDatasafeMCP] Tool called: recommend_placement', {
          args: {
            filename: (args as { filename?: string }).filename,
            mimeType: (args as { mimeType?: string }).mimeType,
            size: (args as { size?: number }).size
          }
        })
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
        console.log('[BuiltinDatasafeMCP] Tool result: recommend_placement', {
          recommended: !!recommendation,
          path: recommendation?.path
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
        console.log('[BuiltinDatasafeMCP] Tool called: store_attachment', {
          args: {
            filename: (args as { filename?: string }).filename,
            size: (args as { size?: number }).size,
            mimeType: (args as { mimeType?: string }).mimeType
          }
        })
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
        console.log('[BuiltinDatasafeMCP] Tool result: store_attachment', {
          path: stored.path,
          size: stored.size,
          mimeType: stored.mimeType
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
        console.log('[BuiltinDatasafeMCP] Tool called: list_rules')
        const rules = await listDatasafeRules(context)
        console.log('[BuiltinDatasafeMCP] Tool result: list_rules', {
          count: rules.length
        })
        return {
          success: true,
          data: rules,
          summary: `Found ${rules.length} rules`
        }
      }
    },
    {
      name: 'copy_email_attachment_to_datasafe',
      description:
        'Copy an email attachment from email storage to datasafe. Use this to access email attachments without passing binary data through AI context. First copy the attachment, then use regular datasafe tools to work with it.',
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
            description: 'Target path in datasafe (e.g., "Documents/filename.pdf")'
          },
          overwrite: {
            type: 'boolean',
            description: 'Whether to overwrite if file exists (default: false)'
          }
        },
        required: ['message_id', 'filename', 'target_path'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinDatasafeMCP] Tool called: copy_email_attachment_to_datasafe', {
          args: {
            message_id: (args as { message_id?: string }).message_id,
            filename: (args as { filename?: string }).filename,
            target_path: (args as { target_path?: string }).target_path
          }
        })
        const { message_id, filename, target_path, overwrite } = args as {
          message_id?: string
          filename?: string
          target_path?: string
          overwrite?: boolean
        }

        if (!message_id || !filename || !target_path) {
          return {
            success: false,
            error: 'message_id, filename, and target_path are required'
          }
        }

        try {
          const { copyEmailAttachmentToDatasafe } = await import('../../../features/datasafe')
          const node = await copyEmailAttachmentToDatasafe(context, {
            messageId: message_id,
            filename,
            targetPath: target_path,
            overwrite: overwrite || false
          })
          console.log('[BuiltinDatasafeMCP] Tool result: copy_email_attachment_to_datasafe', {
            path: node.path,
            size: node.size,
            mimeType: node.mimeType
          })
          return {
            success: true,
            data: {
              path: node.path,
              size: node.size,
              mimeType: node.mimeType,
              createdAt: node.createdAt
            },
            summary: `Copied email attachment '${filename}' from message ${message_id} to datasafe at ${node.path}`
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
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
          }
        },
        required: ['path'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinDatasafeMCP] Tool called: get_file_info', {
          args: { path: (args as { path: string }).path }
        })
        const { path } = args as { path: string }

        try {
          // Get the folder containing the file
          const pathParts = path.split('/')
          const filename = pathParts.pop()
          const folderPath = pathParts.join('/') || undefined

          const folder = await listDatasafeFolder(context, folderPath)
          const file = folder.children.find(
            (child) => child.type === 'file' && child.name === filename
          )

          if (!file) {
            return {
              success: false,
              error: `File not found: ${path}`
            }
          }

          const enhancedFile = {
            ...file,
            sizeFormatted: formatFileSize(file.size),
            ageFormatted: formatFileAge(file.createdAt),
            updatedAgeFormatted: formatFileAge(file.updatedAt),
            fileCategory: getFileCategory(file.mimeType),
            isImage: file.mimeType.startsWith('image/'),
            isDocument: [
              'application/pdf',
              'text/',
              'application/msword',
              'application/vnd.openxmlformats-officedocument'
            ].some((prefix) => file.mimeType.startsWith(prefix))
          }

          console.log('[BuiltinDatasafeMCP] Tool result: get_file_info', {
            path,
            size: file.size,
            mimeType: file.mimeType,
            category: enhancedFile.fileCategory
          })

          return {
            success: true,
            data: enhancedFile,
            summary: `File: ${file.name} (${enhancedFile.sizeFormatted}, ${enhancedFile.fileCategory}, ${enhancedFile.ageFormatted})`
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
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
          }
        },
        required: ['query'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinDatasafeMCP] Tool called: search_files', {
          args: { query: (args as { query: string }).query }
        })
        const {
          query,
          fileType,
          maxResults = 20,
          sortBy = 'date'
        } = args as {
          query: string
          fileType?: string
          maxResults?: number
          sortBy?: 'name' | 'size' | 'date' | 'type'
        }

        try {
          // Get all files by traversing the tree
          const { flattenFiles } = await import('./helpers')
          const tree = await listDatasafeFolder(context)
          const allFiles = flattenFiles(tree)

          // Filter files based on query and type
          const filteredFiles = allFiles.filter((file) => {
            const matchesQuery =
              file.name.toLowerCase().includes(query.toLowerCase()) ||
              file.path.toLowerCase().includes(query.toLowerCase()) ||
              file.mimeType.toLowerCase().includes(query.toLowerCase())

            if (!matchesQuery) return false

            if (fileType) {
              if (fileType === 'image') return file.mimeType.startsWith('image/')
              if (fileType === 'document')
                return [
                  'application/pdf',
                  'text/',
                  'application/msword',
                  'application/vnd.openxmlformats-officedocument'
                ].some((prefix) => file.mimeType.startsWith(prefix))
              if (fileType === 'video') return file.mimeType.startsWith('video/')
              if (fileType === 'audio') return file.mimeType.startsWith('audio/')
              if (fileType === 'text') return file.mimeType.startsWith('text/')
              return file.mimeType === fileType
            }

            return true
          })

          // Sort results
          filteredFiles.sort((a, b) => {
            switch (sortBy) {
              case 'name':
                return a.name.localeCompare(b.name)
              case 'size':
                return b.size - a.size
              case 'date':
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              case 'type':
                return a.mimeType.localeCompare(b.mimeType)
              default:
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            }
          })

          // Limit results and enhance metadata
          const results = filteredFiles.slice(0, maxResults).map((file) => ({
            ...file,
            sizeFormatted: formatFileSize(file.size),
            ageFormatted: formatFileAge(file.createdAt),
            updatedAgeFormatted: formatFileAge(file.updatedAt),
            fileCategory: getFileCategory(file.mimeType),
            isImage: file.mimeType.startsWith('image/'),
            isDocument: [
              'application/pdf',
              'text/',
              'application/msword',
              'application/vnd.openxmlformats-officedocument'
            ].some((prefix) => file.mimeType.startsWith(prefix))
          }))

          console.log('[BuiltinDatasafeMCP] Tool result: search_files', {
            query,
            found: results.length,
            total: filteredFiles.length
          })

          return {
            success: true,
            data: {
              query,
              results,
              totalFound: filteredFiles.length,
              returned: results.length
            },
            summary: `Found ${results.length} files matching "${query}"${fileType ? ` (type: ${fileType})` : ''}`
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
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
          }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinDatasafeMCP] Tool called: get_recent_files', {
          args: { limit: (args as { limit?: number }).limit }
        })
        const {
          limit = 10,
          fileType,
          sortBy = 'updated'
        } = args as {
          limit?: number
          fileType?: string
          sortBy?: 'created' | 'updated'
        }

        try {
          // Get all files by traversing the tree
          const { flattenFiles } = await import('./helpers')
          const tree = await listDatasafeFolder(context)
          const allFiles = flattenFiles(tree)

          // Filter by file type if specified
          let filteredFiles = allFiles
          if (fileType) {
            filteredFiles = allFiles.filter((file) => {
              if (fileType === 'image') return file.mimeType.startsWith('image/')
              if (fileType === 'document')
                return [
                  'application/pdf',
                  'text/',
                  'application/msword',
                  'application/vnd.openxmlformats-officedocument'
                ].some((prefix) => file.mimeType.startsWith(prefix))
              if (fileType === 'video') return file.mimeType.startsWith('video/')
              if (fileType === 'audio') return file.mimeType.startsWith('audio/')
              if (fileType === 'text') return file.mimeType.startsWith('text/')
              return file.mimeType === fileType
            })
          }

          // Sort by date
          filteredFiles.sort((a, b) => {
            const dateA = sortBy === 'created' ? new Date(a.createdAt) : new Date(a.updatedAt)
            const dateB = sortBy === 'created' ? new Date(b.createdAt) : new Date(b.updatedAt)
            return dateB.getTime() - dateA.getTime()
          })

          // Limit results and enhance metadata
          const results = filteredFiles.slice(0, limit).map((file) => ({
            ...file,
            sizeFormatted: formatFileSize(file.size),
            ageFormatted: formatFileAge(file.createdAt),
            updatedAgeFormatted: formatFileAge(file.updatedAt),
            fileCategory: getFileCategory(file.mimeType),
            isImage: file.mimeType.startsWith('image/'),
            isDocument: [
              'application/pdf',
              'text/',
              'application/msword',
              'application/vnd.openxmlformats-officedocument'
            ].some((prefix) => file.mimeType.startsWith(prefix))
          }))

          console.log('[BuiltinDatasafeMCP] Tool result: get_recent_files', {
            limit,
            found: results.length,
            sortBy
          })

          return {
            success: true,
            data: {
              results,
              sortBy,
              totalFiles: allFiles.length,
              filteredFiles: filteredFiles.length
            },
            summary: `Found ${results.length} most recent files${fileType ? ` (type: ${fileType})` : ''} sorted by ${sortBy}`
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
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
        console.log('[BuiltinDatasafeMCP] Tool called: get_stats', {
          args: { limit: (args as { limit?: number }).limit }
        })
        const { limit } = args as { limit?: number }
        const stats = await getDatasafeStats(context, limit)
        console.log('[BuiltinDatasafeMCP] Tool result: get_stats', {
          empty: stats.empty,
          totalFiles: stats.totalFiles,
          totalFolders: stats.totalFolders
        })
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
