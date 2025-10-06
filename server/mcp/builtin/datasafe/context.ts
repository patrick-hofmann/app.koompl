import type { McpContextResult } from '../../../types/mcp-clients'
import type { DatasafeFolderNode } from '../../../types/datasafe'
import { ensureTeamDatasafe, getTree } from '../../../utils/datasafeStorage'
import { flattenFiles } from './helpers'

export interface DatasafeMcpContext {
  teamId: string
  userId: string
  agentId?: string
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
