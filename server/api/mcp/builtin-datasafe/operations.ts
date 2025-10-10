import * as datasafe from '../../../features/datasafe'
import type {
  DatasafeAttachmentContext,
  DatasafeFileNode,
  DatasafeFolderNode,
  DatasafeRule
} from '../../../types/datasafe'
import {
  aggregateFolderStats,
  countFolders,
  flattenFiles,
  type FolderAggregate,
  type FlattenedFile
} from './helpers'
import type { DatasafeMcpContext } from './context'

export async function listDatasafeFolder(
  context: DatasafeMcpContext,
  folderPath?: string
): Promise<DatasafeFolderNode> {
  return await datasafe.listFolder(context, folderPath)
}

export async function downloadDatasafeFile(
  context: DatasafeMcpContext,
  filePath: string
): Promise<{ base64: string; node: DatasafeFileNode }> {
  return await datasafe.downloadFile(context, filePath)
}

export async function uploadDatasafeFile(
  context: DatasafeMcpContext,
  params: {
    path: string
    base64: string
    mimeType: string
    size: number
    overwrite?: boolean
    metadata?: Record<string, unknown>
  }
): Promise<DatasafeFileNode> {
  return await datasafe.uploadFile(context, {
    ...params,
    source: 'mcp'
  })
}

export async function createDatasafeFolder(
  context: DatasafeMcpContext,
  path: string
): Promise<DatasafeFolderNode> {
  return await datasafe.createFolder(context, path)
}

export async function recommendDatasafePlacement(
  context: DatasafeMcpContext,
  attachment: DatasafeAttachmentContext
) {
  return await datasafe.recommendPlacement(context, attachment)
}

export async function storeDatasafeAttachment(
  context: DatasafeMcpContext,
  attachment: DatasafeAttachmentContext
) {
  return await datasafe.storeAttachment(context, attachment)
}

export async function listDatasafeRules(context: DatasafeMcpContext): Promise<DatasafeRule[]> {
  return await datasafe.listRules(context)
}

export interface DatasafeStats {
  generatedAt: string
  totalFiles: number
  totalFolders: number
  totalSize: number
  latestFile?: FlattenedFile & { sizeKb: number }
  recentFiles: Array<FlattenedFile & { sizeKb: number }>
  topFolders: Array<FolderAggregate & { sizeKb: number }>
  empty: boolean
}

export async function getDatasafeStats(
  context: DatasafeMcpContext,
  limit: number = 5
): Promise<DatasafeStats> {
  const tree = await datasafe.getTree(context)
  const files = flattenFiles(tree)
  const resolvedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 5
  const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0)
  const folderAggregates: FolderAggregate[] = []
  aggregateFolderStats(tree, folderAggregates)

  const foldersWithoutRoot = folderAggregates.filter((folder) => folder.path !== '/')
  const sortedFolders = foldersWithoutRoot
    .slice()
    .sort((a, b) => b.fileCount - a.fileCount || b.totalSize - a.totalSize)
    .slice(0, resolvedLimit)
    .map((folder) => ({
      ...folder,
      sizeKb: folder.totalSize === 0 ? 0 : Math.max(1, Math.round(folder.totalSize / 1024))
    }))

  const recentFiles = files
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, resolvedLimit)
    .map((file) => ({
      ...file,
      sizeKb: Math.max(1, Math.round(file.size / 1024))
    }))

  const latestFile = recentFiles[0]

  return {
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    totalFolders: Math.max(0, countFolders(tree) - 1),
    totalSize,
    latestFile,
    recentFiles,
    topFolders: sortedFolders,
    empty: files.length === 0
  }
}
