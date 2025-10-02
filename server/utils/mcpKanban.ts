/**
 * Built-in MCP Server for Kanban Board Access
 * This provides agents with the ability to interact with team Kanban boards
 */

import type { McpContextResult } from '../types/mcp-clients'
import { getTeamBoards, getBoard, addCard, updateCard, moveCard, deleteCard } from './kanbanStorage'
import type { KanbanBoard, KanbanCard } from '../types/kanban'

export interface KanbanMcpContext {
  teamId: string
  userId: string
  agentId?: string
}

/**
 * Get summary of all boards for context
 */
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

  // Summarize boards with card counts
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
    details: boards.slice(0, limit)
  }
}

/**
 * List all boards with full details
 */
export async function listBoards(context: KanbanMcpContext): Promise<KanbanBoard[]> {
  return await getTeamBoards(context.teamId)
}

/**
 * Get a specific board by ID or name
 */
export async function getBoardByIdOrName(
  context: KanbanMcpContext,
  identifier: string
): Promise<KanbanBoard | null> {
  if (!identifier) {
    return null
  }
  const boards = await getTeamBoards(context.teamId)

  // Try to find by ID first
  let board = boards.find((b) => b.id === identifier)

  // If not found, try by name (case-insensitive)
  if (!board) {
    const nameToFind = String(identifier).toLowerCase()
    board = boards.find((b) => b.name?.toLowerCase() === nameToFind)
  }

  return board || null
}

/**
 * List all cards from a specific board, optionally filtered by column
 */
export async function listCards(
  context: KanbanMcpContext,
  boardIdOrName: string,
  columnIdOrName?: string
): Promise<{
  board: KanbanBoard
  cards: Array<KanbanCard & { columnId: string; columnName: string }>
} | null> {
  const board = await getBoardByIdOrName(context, boardIdOrName)
  if (!board) return null

  let columns = board.columns

  // Filter by column if specified
  if (columnIdOrName) {
    const column = columns.find(
      (col) => col.id === columnIdOrName || col.title.toLowerCase() === columnIdOrName.toLowerCase()
    )
    if (column) {
      columns = [column]
    }
  }

  const cards = columns.flatMap((col) =>
    col.cards.map((card) => ({
      ...card,
      columnId: col.id,
      columnName: col.title
    }))
  )

  return { board, cards }
}

/**
 * Create a new card on a board
 */
export async function createCard(
  context: KanbanMcpContext,
  boardIdOrName: string,
  columnIdOrName: string,
  cardData: {
    title: string
    description?: string
    assignee?: string
    priority?: 'Low' | 'Medium' | 'High'
    tags?: string[]
    ticket?: string
  }
): Promise<{ board: KanbanBoard; card: KanbanCard } | null> {
  const board = await getBoardByIdOrName(context, boardIdOrName)
  if (!board) return null

  // Find the column
  const column = board.columns.find(
    (col) => col.id === columnIdOrName || col.title.toLowerCase() === columnIdOrName.toLowerCase()
  )
  if (!column) return null

  const card = await addCard(context.teamId, board.id, column.id, {
    ...cardData,
    createdBy: context.userId
  })

  if (!card) return null

  // Get updated board
  const updatedBoard = await getBoard(context.teamId, board.id)
  return updatedBoard ? { board: updatedBoard, card } : null
}

/**
 * Update an existing card
 */
export async function modifyCard(
  context: KanbanMcpContext,
  boardIdOrName: string,
  cardId: string,
  updates: {
    columnIdOrName?: string
    title?: string
    description?: string
    assignee?: string
    priority?: 'Low' | 'Medium' | 'High'
    tags?: string[]
    ticket?: string
  }
): Promise<{ board: KanbanBoard; card: KanbanCard } | null> {
  const board = await getBoardByIdOrName(context, boardIdOrName)
  if (!board) return null

  // Find the card's current column
  let currentColumn = null
  for (const col of board.columns) {
    if (col.cards.find((c) => c.id === cardId)) {
      currentColumn = col
      break
    }
  }
  if (!currentColumn) return null

  // Update the card
  const card = await updateCard(context.teamId, board.id, currentColumn.id, cardId, {
    title: updates.title,
    description: updates.description,
    assignee: updates.assignee,
    priority: updates.priority,
    tags: updates.tags,
    ticket: updates.ticket
  })

  if (!card) return null

  // Get updated board
  const updatedBoard = await getBoard(context.teamId, board.id)
  return updatedBoard ? { board: updatedBoard, card } : null
}

/**
 * Move a card to a different column
 */
export async function moveCardToColumn(
  context: KanbanMcpContext,
  boardIdOrName: string,
  cardId: string,
  toColumnIdOrName: string,
  position?: number
): Promise<{ board: KanbanBoard; success: boolean } | null> {
  const board = await getBoardByIdOrName(context, boardIdOrName)
  if (!board) return null

  // Find the card's current column
  let fromColumn = null
  for (const col of board.columns) {
    if (col.cards.find((c) => c.id === cardId)) {
      fromColumn = col
      break
    }
  }
  if (!fromColumn) return null

  // Find the target column
  const toColumn = board.columns.find(
    (col) =>
      col.id === toColumnIdOrName || col.title.toLowerCase() === toColumnIdOrName.toLowerCase()
  )
  if (!toColumn) return null

  const success = await moveCard(
    context.teamId,
    board.id,
    cardId,
    fromColumn.id,
    toColumn.id,
    position
  )

  // Get updated board
  const updatedBoard = await getBoard(context.teamId, board.id)
  return updatedBoard ? { board: updatedBoard, success } : null
}

/**
 * Remove a card from a board
 */
export async function removeCard(
  context: KanbanMcpContext,
  boardIdOrName: string,
  cardId: string
): Promise<{ board: KanbanBoard; success: boolean } | null> {
  const board = await getBoardByIdOrName(context, boardIdOrName)
  if (!board) return null

  // Find the card's column
  let column = null
  for (const col of board.columns) {
    if (col.cards.find((c) => c.id === cardId)) {
      column = col
      break
    }
  }
  if (!column) return null

  const success = await deleteCard(context.teamId, board.id, column.id, cardId)

  // Get updated board
  const updatedBoard = await getBoard(context.teamId, board.id)
  return updatedBoard ? { board: updatedBoard, success } : null
}

/**
 * Search for cards by title, description, or assignee
 */
export async function searchCards(
  context: KanbanMcpContext,
  query: string,
  boardIdOrName?: string
): Promise<
  Array<KanbanCard & { boardId: string; boardName: string; columnId: string; columnName: string }>
> {
  const boards = boardIdOrName
    ? [await getBoardByIdOrName(context, boardIdOrName)].filter((b): b is KanbanBoard => b !== null)
    : await getTeamBoards(context.teamId)

  const results: Array<
    KanbanCard & { boardId: string; boardName: string; columnId: string; columnName: string }
  > = []
  const queryLower = query.toLowerCase()

  for (const board of boards) {
    for (const column of board.columns) {
      for (const card of column.cards) {
        const matchesTitle = card.title.toLowerCase().includes(queryLower)
        const matchesDescription = card.description?.toLowerCase().includes(queryLower)
        const matchesAssignee = card.assignee?.toLowerCase().includes(queryLower)
        const matchesTicket = card.ticket?.toLowerCase().includes(queryLower)

        if (matchesTitle || matchesDescription || matchesAssignee || matchesTicket) {
          results.push({
            ...card,
            boardId: board.id,
            boardName: board.name,
            columnId: column.id,
            columnName: column.title
          })
        }
      }
    }
  }

  return results
}

/**
 * Get cards assigned to a specific user
 */
export async function getCardsByAssignee(
  context: KanbanMcpContext,
  assignee: string,
  boardIdOrName?: string
): Promise<
  Array<KanbanCard & { boardId: string; boardName: string; columnId: string; columnName: string }>
> {
  const boards = boardIdOrName
    ? [await getBoardByIdOrName(context, boardIdOrName)].filter((b): b is KanbanBoard => b !== null)
    : await getTeamBoards(context.teamId)

  const results: Array<
    KanbanCard & { boardId: string; boardName: string; columnId: string; columnName: string }
  > = []
  const assigneeLower = assignee.toLowerCase()

  for (const board of boards) {
    for (const column of board.columns) {
      for (const card of column.cards) {
        if (card.assignee?.toLowerCase() === assigneeLower) {
          results.push({
            ...card,
            boardId: board.id,
            boardName: board.name,
            columnId: column.id,
            columnName: column.title
          })
        }
      }
    }
  }

  return results
}
