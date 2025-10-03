/**
 * Built-in MCP server utilities for Datasafe file storage
 */

import { createError } from 'h3'
import type { McpContextResult } from '../types/mcp-clients'
import {
  ensureTeamDatasafe,
  getTree,
  listFolder,
  readFile,
  storeFile,
  createFolder,
  recommendPlacement,
  storeAttachment
} from './datasafeStorage'
import type {
  DatasafeAttachmentContext,
  DatasafeFileNode,
  DatasafeFolderNode,
  DatasafeRule
} from '../types/datasafe'

export interface DatasafeMcpContext {
  teamId: string
  userId: string
  agentId?: string
}

interface FlattenedFile {
  path: string
  size: number
  updatedAt: string
  source: string
}

interface FolderAggregate {
  path: string
  name: string
  fileCount: number
  totalSize: number
  latestUpdatedAt?: string
}

function flattenFiles(folder: DatasafeFolderNode, acc: FlattenedFile[] = []): FlattenedFile[] {
  for (const child of folder.children) {
    if (child.type === 'file') {
      acc.push({
        path: child.path,
        size: child.size,
        updatedAt: child.updatedAt,
        source: child.source
      })
    } else {
      flattenFiles(child, acc)
    }
  }
  return acc
}

function aggregateFolderStats(folder: DatasafeFolderNode, acc: FolderAggregate[]): FolderAggregate {
  let fileCount = 0
  let totalSize = 0
  let latestUpdatedAt: string | undefined

  for (const child of folder.children) {
    if (child.type === 'file') {
      fileCount += 1
      totalSize += child.size
      if (
        !latestUpdatedAt ||
        new Date(child.updatedAt).getTime() > new Date(latestUpdatedAt).getTime()
      ) {
        latestUpdatedAt = child.updatedAt
      }
    } else {
      const childAggregate = aggregateFolderStats(child, acc)
      fileCount += childAggregate.fileCount
      totalSize += childAggregate.totalSize
      if (
        childAggregate.latestUpdatedAt &&
        (!latestUpdatedAt ||
          new Date(childAggregate.latestUpdatedAt).getTime() > new Date(latestUpdatedAt).getTime())
      ) {
        latestUpdatedAt = childAggregate.latestUpdatedAt
      }
    }
  }

  const aggregate: FolderAggregate = {
    path: folder.path || '/',
    name: folder.name,
    fileCount,
    totalSize,
    latestUpdatedAt
  }

  acc.push(aggregate)
  return aggregate
}

function countFolders(folder: DatasafeFolderNode): number {
  let count = 1 // include current folder
  for (const child of folder.children) {
    if (child.type === 'folder') {
      count += countFolders(child)
    }
  }
  return count
}

function summarizeFolders(folder: DatasafeFolderNode): string[] {
  return folder.children
    .filter((child) => child.type === 'folder')
    .map((child) => {
      const files = flattenFiles(child)
      const fileCount = files.length
      const latest = files
        .slice()
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
      const latestText = latest
        ? `latest ${latest.path.split('/').pop()} (${latest.updatedAt})`
        : 'no files'
      return `${child.name}: ${fileCount} files (${latestText})`
    })
}

export async function fetchDatasafeContext(
  context: DatasafeMcpContext,
  limit: number = 5
): Promise<McpContextResult | null> {
  await ensureTeamDatasafe(context.teamId)
  const tree = await getTree(context.teamId)
  const files = flattenFiles(tree)

  if (!files.length) {
    return {
      serverId: 'builtin-datasafe',
      serverName: 'Team Datasafe',
      provider: 'builtin-datasafe',
      category: 'storage',
      summary: 'Datasafe is empty. Upload documents to populate the vault.',
      details: []
    }
  }

  const recent = files
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit)

  const summaryLines = recent.map((file) => {
    const sizeKb = Math.max(1, Math.round(file.size / 1024))
    return `• ${file.path} (${sizeKb} KB, source: ${file.source}, updated ${file.updatedAt})`
  })
  const folderLines = summarizeFolders(tree).slice(0, limit)

  const summary = [`Recent files:`, ...summaryLines]
  if (folderLines.length) {
    summary.push('', 'Folders:', ...folderLines.map((line) => `• ${line}`))
  }

  return {
    serverId: 'builtin-datasafe',
    serverName: 'Team Datasafe',
    provider: 'builtin-datasafe',
    category: 'storage',
    summary: summary.join('\n'),
    details: { recent, folders: folderLines }
  }
}

export async function listDatasafeFolder(
  context: DatasafeMcpContext,
  folderPath?: string
): Promise<DatasafeFolderNode> {
  await ensureTeamDatasafe(context.teamId)
  return await listFolder(context.teamId, folderPath)
}

export async function downloadDatasafeFile(
  context: DatasafeMcpContext,
  filePath: string
): Promise<{ base64: string; node: DatasafeFileNode }> {
  await ensureTeamDatasafe(context.teamId)
  const record = await readFile(context.teamId, filePath)
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: `File not found: ${filePath}` })
  }
  return { base64: record.file.data, node: record.node }
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
  await ensureTeamDatasafe(context.teamId)
  return await storeFile(context.teamId, params.path, {
    base64: params.base64,
    mimeType: params.mimeType,
    size: params.size,
    source: 'mcp',
    metadata: params.metadata,
    overwrite: params.overwrite
  })
}

export async function createDatasafeFolder(
  context: DatasafeMcpContext,
  path: string
): Promise<DatasafeFolderNode> {
  await ensureTeamDatasafe(context.teamId)
  return await createFolder(context.teamId, path)
}

export async function recommendDatasafePlacement(
  context: DatasafeMcpContext,
  attachment: DatasafeAttachmentContext
) {
  await ensureTeamDatasafe(context.teamId)
  return await recommendPlacement(context.teamId, attachment)
}

export async function storeDatasafeAttachment(
  context: DatasafeMcpContext,
  attachment: DatasafeAttachmentContext
) {
  await ensureTeamDatasafe(context.teamId)
  return await storeAttachment(context.teamId, attachment)
}

export async function listDatasafeRules(context: DatasafeMcpContext): Promise<DatasafeRule[]> {
  await ensureTeamDatasafe(context.teamId)
  const { getRules } = await import('./datasafeStorage')
  return await getRules(context.teamId)
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
  await ensureTeamDatasafe(context.teamId)
  const tree = await getTree(context.teamId)
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
