import type { McpContextResult } from '../../../types/mcp-clients'
import type { KanbanBoard } from '../../../types/kanban'
import { getTeamBoards } from '../../../features/kanban/storage'

export interface KanbanMcpContext {
  teamId: string
  userId: string
  agentId?: string
}

export async function fetchKanbanContext(
  context: KanbanMcpContext,
  limit: number = 5
): Promise<McpContextResult | null> {
  const boards = await getTeamBoards(context.teamId)

  if (!boards.length) {
    return {
      serverId: 'builtin-kanban',
      serverName: 'Kanban Board',
      provider: 'builtin',
      category: 'productivity',
      summary: 'No Kanban boards found for this team.',
      details: []
    }
  }

  const boardSummaries = boards.slice(0, limit).map((board) => {
    const totalCards = board.columns.reduce((sum, col) => sum + col.cards.length, 0)
    const columnInfo = board.columns.map((col) => `${col.title} (${col.cards.length})`).join(', ')
    return `• ${board.name}: ${totalCards} cards across ${board.columns.length} columns [${columnInfo}]`
  })

  return {
    serverId: 'builtin-kanban',
    serverName: 'Kanban Board',
    provider: 'builtin',
    category: 'productivity',
    summary: `Kanban Boards:\n${boardSummaries.join('\n')}`,
    details: boards.slice(0, limit) as KanbanBoard[]
  }
}
