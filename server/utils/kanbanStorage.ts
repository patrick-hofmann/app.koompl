import type { KanbanBoard, KanbanBoardList, KanbanColumn, KanbanCard } from '../types/kanban'

const storage = useStorage('identity')

/**
 * Get all boards for a team
 */
export async function getTeamBoards(teamId: string): Promise<KanbanBoard[]> {
  const key = `kanban:team:${teamId}`
  const boards = (await storage.getItem<KanbanBoardList>(key)) || {}
  return Object.values(boards)
}

/**
 * Get a specific board by ID
 */
export async function getBoard(teamId: string, boardId: string): Promise<KanbanBoard | null> {
  const key = `kanban:team:${teamId}`
  const boards = (await storage.getItem<KanbanBoardList>(key)) || {}
  return boards[boardId] || null
}

/**
 * Create a new board
 */
export async function createBoard(
  teamId: string,
  name: string,
  description?: string,
  initialColumns?: string[]
): Promise<KanbanBoard> {
  const key = `kanban:team:${teamId}`
  const boards = (await storage.getItem<KanbanBoardList>(key)) || {}

  const boardId = `board-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const now = new Date().toISOString()

  // Default columns if not provided
  const defaultColumns = initialColumns || ['To Do', 'In Progress', 'Done']

  const newBoard: KanbanBoard = {
    id: boardId,
    teamId,
    name,
    description,
    columns: defaultColumns.map((title, index) => ({
      id: `col-${Date.now()}-${index}`,
      title,
      cards: [],
      order: index
    })),
    createdAt: now,
    updatedAt: now
  }

  boards[boardId] = newBoard
  await storage.setItem(key, boards)

  return newBoard
}

/**
 * Update a board
 */
export async function updateBoard(
  teamId: string,
  boardId: string,
  updates: Partial<Pick<KanbanBoard, 'name' | 'description' | 'columns'>>
): Promise<KanbanBoard | null> {
  const key = `kanban:team:${teamId}`
  const boards = (await storage.getItem<KanbanBoardList>(key)) || {}

  if (!boards[boardId]) {
    return null
  }

  boards[boardId] = {
    ...boards[boardId],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  await storage.setItem(key, boards)
  return boards[boardId]
}

/**
 * Delete a board
 */
export async function deleteBoard(teamId: string, boardId: string): Promise<boolean> {
  const key = `kanban:team:${teamId}`
  const boards = (await storage.getItem<KanbanBoardList>(key)) || {}

  if (!boards[boardId]) {
    return false
  }

  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete boards[boardId]
  await storage.setItem(key, boards)
  return true
}

/**
 * Add a card to a column
 */
export async function addCard(
  teamId: string,
  boardId: string,
  columnId: string,
  card: Omit<KanbanCard, 'id' | 'createdAt' | 'updatedAt'>
): Promise<KanbanCard | null> {
  const board = await getBoard(teamId, boardId)
  if (!board) return null

  const column = board.columns.find((col) => col.id === columnId)
  if (!column) return null

  const now = new Date().toISOString()
  const newCard: KanbanCard = {
    ...card,
    id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: now,
    updatedAt: now
  }

  column.cards.push(newCard)
  await updateBoard(teamId, boardId, { columns: board.columns })

  return newCard
}

/**
 * Update a card
 */
export async function updateCard(
  teamId: string,
  boardId: string,
  columnId: string,
  cardId: string,
  updates: Partial<Omit<KanbanCard, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>
): Promise<KanbanCard | null> {
  const board = await getBoard(teamId, boardId)
  if (!board) return null

  const column = board.columns.find((col) => col.id === columnId)
  if (!column) return null

  const cardIndex = column.cards.findIndex((c) => c.id === cardId)
  if (cardIndex === -1) return null

  column.cards[cardIndex] = {
    ...column.cards[cardIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  await updateBoard(teamId, boardId, { columns: board.columns })
  return column.cards[cardIndex]
}

/**
 * Move a card between columns
 */
export async function moveCard(
  teamId: string,
  boardId: string,
  cardId: string,
  fromColumnId: string,
  toColumnId: string,
  position?: number
): Promise<boolean> {
  const board = await getBoard(teamId, boardId)
  if (!board) return false

  const fromColumn = board.columns.find((col) => col.id === fromColumnId)
  const toColumn = board.columns.find((col) => col.id === toColumnId)

  if (!fromColumn || !toColumn) return false

  const cardIndex = fromColumn.cards.findIndex((c) => c.id === cardId)
  if (cardIndex === -1) return false

  const [card] = fromColumn.cards.splice(cardIndex, 1)
  card.updatedAt = new Date().toISOString()

  if (position !== undefined && position >= 0) {
    toColumn.cards.splice(position, 0, card)
  } else {
    toColumn.cards.push(card)
  }

  await updateBoard(teamId, boardId, { columns: board.columns })
  return true
}

/**
 * Delete a card
 */
export async function deleteCard(
  teamId: string,
  boardId: string,
  columnId: string,
  cardId: string
): Promise<boolean> {
  const board = await getBoard(teamId, boardId)
  if (!board) return false

  const column = board.columns.find((col) => col.id === columnId)
  if (!column) return false

  const cardIndex = column.cards.findIndex((c) => c.id === cardId)
  if (cardIndex === -1) return false

  column.cards.splice(cardIndex, 1)
  await updateBoard(teamId, boardId, { columns: board.columns })
  return true
}

/**
 * Add a column to a board
 */
export async function addColumn(
  teamId: string,
  boardId: string,
  title: string,
  position?: number
): Promise<KanbanColumn | null> {
  const board = await getBoard(teamId, boardId)
  if (!board) return null

  const newColumn: KanbanColumn = {
    id: `col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    cards: [],
    order: position !== undefined ? position : board.columns.length
  }

  if (position !== undefined && position >= 0) {
    board.columns.splice(position, 0, newColumn)
    // Update order for all columns
    board.columns.forEach((col, idx) => {
      col.order = idx
    })
  } else {
    board.columns.push(newColumn)
  }

  await updateBoard(teamId, boardId, { columns: board.columns })
  return newColumn
}

/**
 * Delete a column (and all its cards)
 */
export async function deleteColumn(
  teamId: string,
  boardId: string,
  columnId: string
): Promise<boolean> {
  const board = await getBoard(teamId, boardId)
  if (!board) return false

  const columnIndex = board.columns.findIndex((col) => col.id === columnId)
  if (columnIndex === -1) return false

  board.columns.splice(columnIndex, 1)
  // Update order for remaining columns
  board.columns.forEach((col, idx) => {
    col.order = idx
  })

  await updateBoard(teamId, boardId, { columns: board.columns })
  return true
}
