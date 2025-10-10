import type { KanbanBoard, KanbanColumn, KanbanCard } from '../../types/kanban'
import {
  getTeamBoards,
  getBoard as getBoardStorage,
  createBoard as createBoardStorage,
  updateBoard as updateBoardStorage,
  deleteBoard as deleteBoardStorage,
  addCard as addCardStorage,
  updateCard as updateCardStorage,
  moveCard as moveCardStorage,
  deleteCard as deleteCardStorage,
  addColumn as addColumnStorage,
  deleteColumn as deleteColumnStorage
} from './storage'

export interface KanbanContext {
  teamId: string
  userId?: string
  agentId?: string
}

/**
 * Get all Kanban boards for a team
 */
export async function listBoards(context: KanbanContext): Promise<KanbanBoard[]> {
  return await getTeamBoards(context.teamId)
}

/**
 * Get a specific Kanban board by ID
 */
export async function getBoard(
  context: KanbanContext,
  boardId: string
): Promise<KanbanBoard | null> {
  const board = await getBoardStorage(context.teamId, boardId)
  return board
}

/**
 * Create a new Kanban board
 */
export async function createBoard(
  context: KanbanContext,
  params: {
    name: string
    description?: string
    initialColumns?: string[]
  }
): Promise<KanbanBoard> {
  return await createBoardStorage(
    context.teamId,
    params.name,
    params.description,
    params.initialColumns
  )
}

/**
 * Update an existing Kanban board
 */
export async function updateBoard(
  context: KanbanContext,
  boardId: string,
  updates: Partial<Pick<KanbanBoard, 'name' | 'description' | 'columns'>>
): Promise<KanbanBoard | null> {
  return await updateBoardStorage(context.teamId, boardId, updates)
}

/**
 * Delete a Kanban board
 */
export async function deleteBoard(context: KanbanContext, boardId: string): Promise<boolean> {
  return await deleteBoardStorage(context.teamId, boardId)
}

/**
 * Add a card to a column
 */
export async function createCard(
  context: KanbanContext,
  boardId: string,
  columnId: string,
  card: Omit<KanbanCard, 'id' | 'createdAt' | 'updatedAt'>
): Promise<KanbanCard | null> {
  return await addCardStorage(context.teamId, boardId, columnId, card)
}

/**
 * Update a card
 */
export async function updateCard(
  context: KanbanContext,
  boardId: string,
  columnId: string,
  cardId: string,
  updates: Partial<Omit<KanbanCard, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>
): Promise<KanbanCard | null> {
  return await updateCardStorage(context.teamId, boardId, columnId, cardId, updates)
}

/**
 * Move a card between columns
 */
export async function moveCard(
  context: KanbanContext,
  boardId: string,
  cardId: string,
  fromColumnId: string,
  toColumnId: string,
  position?: number
): Promise<boolean> {
  return await moveCardStorage(context.teamId, boardId, cardId, fromColumnId, toColumnId, position)
}

/**
 * Delete a card
 */
export async function deleteCard(
  context: KanbanContext,
  boardId: string,
  columnId: string,
  cardId: string
): Promise<boolean> {
  return await deleteCardStorage(context.teamId, boardId, columnId, cardId)
}

/**
 * Add a column to a board
 */
export async function createColumn(
  context: KanbanContext,
  boardId: string,
  title: string,
  position?: number
): Promise<KanbanColumn | null> {
  return await addColumnStorage(context.teamId, boardId, title, position)
}

/**
 * Delete a column (and all its cards)
 */
export async function deleteColumn(
  context: KanbanContext,
  boardId: string,
  columnId: string
): Promise<boolean> {
  return await deleteColumnStorage(context.teamId, boardId, columnId)
}

/**
 * Get board statistics
 */
export async function getBoardStats(
  context: KanbanContext,
  boardId: string
): Promise<{
  totalCards: number
  cardsByColumn: Record<string, number>
  totalColumns: number
} | null> {
  const board = await getBoardStorage(context.teamId, boardId)
  if (!board) return null

  const totalCards = board.columns.reduce((sum, col) => sum + col.cards.length, 0)
  const cardsByColumn: Record<string, number> = {}
  for (const col of board.columns) {
    cardsByColumn[col.id] = col.cards.length
  }

  return {
    totalCards,
    cardsByColumn,
    totalColumns: board.columns.length
  }
}

/**
 * Search cards across all boards
 */
export async function searchCards(
  context: KanbanContext,
  query: string
): Promise<Array<{ board: KanbanBoard; column: KanbanColumn; card: KanbanCard }>> {
  const boards = await getTeamBoards(context.teamId)
  const results: Array<{ board: KanbanBoard; column: KanbanColumn; card: KanbanCard }> = []
  const lowerQuery = query.toLowerCase()

  for (const board of boards) {
    for (const column of board.columns) {
      for (const card of column.cards) {
        if (
          card.title.toLowerCase().includes(lowerQuery) ||
          card.description?.toLowerCase().includes(lowerQuery)
        ) {
          results.push({ board, column, card })
        }
      }
    }
  }

  return results
}
