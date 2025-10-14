import type {
  DatasafeAttachmentContext,
  DatasafeFileNode,
  DatasafeFolderNode,
  DatasafeRule
} from '../../types/datasafe'
import { createError } from 'h3'

import {
  ensureTeamDatasafe,
  getTree as getTreeStorage,
  listFolder as listFolderStorage,
  readFile,
  storeFile,
  createFolder as createFolderStorage,
  recommendPlacement as recommendPlacementStorage,
  storeAttachment as storeAttachmentStorage,
  moveFileNode,
  getRules as getRulesStorage,
  saveRules as saveRulesStorage
} from './storage'

export interface DatasafeContext {
  teamId: string
  userId?: string
  agentId?: string
}

export async function listFolder(
  context: DatasafeContext,
  folderPath?: string
): Promise<DatasafeFolderNode> {
  await ensureTeamDatasafe(context.teamId)
  return await listFolderStorage(context.teamId, folderPath)
}

export async function downloadFile(
  context: DatasafeContext,
  filePath: string
): Promise<{ base64: string; node: DatasafeFileNode }> {
  await ensureTeamDatasafe(context.teamId)
  const record = await readFile(context.teamId, filePath)
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: `File not found: ${filePath}` })
  }
  return { base64: record.file.data, node: record.node }
}

export async function uploadFile(
  context: DatasafeContext,
  params: {
    path: string
    base64: string
    mimeType: string
    size: number
    overwrite?: boolean
    metadata?: Record<string, unknown>
    source?: 'ui-upload' | 'email-attachment' | 'mcp' | 'api'
  }
): Promise<DatasafeFileNode> {
  await ensureTeamDatasafe(context.teamId)
  return await storeFile(context.teamId, params.path, {
    base64: params.base64,
    mimeType: params.mimeType,
    size: params.size,
    source: params.source || 'api',
    metadata: params.metadata,
    overwrite: params.overwrite
  })
}

export async function createFolder(
  context: DatasafeContext,
  path: string
): Promise<DatasafeFolderNode> {
  await ensureTeamDatasafe(context.teamId)
  return await createFolderStorage(context.teamId, path)
}

export async function recommendPlacement(
  context: DatasafeContext,
  attachment: DatasafeAttachmentContext
) {
  await ensureTeamDatasafe(context.teamId)
  return await recommendPlacementStorage(context.teamId, attachment)
}

export async function storeAttachment(
  context: DatasafeContext,
  attachment: DatasafeAttachmentContext
) {
  await ensureTeamDatasafe(context.teamId)
  return await storeAttachmentStorage(context.teamId, attachment)
}

export async function listRules(context: DatasafeContext): Promise<DatasafeRule[]> {
  await ensureTeamDatasafe(context.teamId)
  return await getRulesStorage(context.teamId)
}

export async function updateRules(
  context: DatasafeContext,
  rules: DatasafeRule[]
): Promise<DatasafeRule[]> {
  await ensureTeamDatasafe(context.teamId)
  await saveRulesStorage(context.teamId, rules)
  return await getRulesStorage(context.teamId)
}

export interface DatasafeStats {
  generatedAt: string
  totalFiles: number
  totalFolders: number
  totalSize: number
  latestFile?: any
  recentFiles: any[]
  topFolders: any[]
  empty: boolean
}

export async function getStats(context: DatasafeContext, limit?: number): Promise<DatasafeStats> {
  // Delegate to MCP ops stats calculation to keep logic in one place
  const { getDatasafeStats } = await import('../../api/mcp/builtin-datasafe/operations')
  return await getDatasafeStats(
    { teamId: context.teamId, userId: context.userId, agentId: context.agentId } as any,
    limit
  )
}

export async function moveFile(
  context: DatasafeContext,
  sourcePath: string,
  targetFolder: string
): Promise<DatasafeFileNode> {
  await ensureTeamDatasafe(context.teamId)
  return await moveFileNode(context.teamId, sourcePath, targetFolder)
}

export async function getTree(
  context: DatasafeContext,
  path?: string
): Promise<DatasafeFolderNode> {
  await ensureTeamDatasafe(context.teamId)
  if (!path) {
    return await getTreeStorage(context.teamId)
  }
  return await listFolderStorage(context.teamId, path)
}

/**
 * Copy an email attachment to datasafe
 * This allows agents to move attachments from email storage to datasafe without passing data through AI
 */
export async function copyEmailAttachmentToDatasafe(
  context: DatasafeContext,
  params: {
    messageId: string
    filename: string
    targetPath: string
    overwrite?: boolean
  }
): Promise<DatasafeFileNode> {
  await ensureTeamDatasafe(context.teamId)

  // Get the attachment from email storage
  const { getAttachment } = await import('../mail/attachment-storage')
  const attachment = await getAttachment(params.messageId, params.filename)

  if (!attachment) {
    throw createError({
      statusCode: 404,
      statusMessage: `Email attachment not found: ${params.messageId}/${params.filename}`
    })
  }

  console.log(
    `[Datasafe] Copying email attachment to datasafe: ${params.filename} -> ${params.targetPath}`
  )

  // Store to datasafe
  return await storeFile(context.teamId, params.targetPath, {
    base64: attachment.data,
    mimeType: attachment.mimeType,
    size: attachment.size,
    source: 'email-attachment',
    metadata: {
      originalMessageId: params.messageId,
      originalFilename: params.filename
    },
    overwrite: params.overwrite
  })
}
