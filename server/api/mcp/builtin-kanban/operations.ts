import * as kanban from '../../../features/kanban'
import type { KanbanBoard, KanbanCard } from '../../../types/kanban'
import type { KanbanMcpContext } from './context'

export async function listBoards(context: KanbanMcpContext): Promise<KanbanBoard[]> {
  return await kanban.listBoards(context)
}

export async function getBoardByIdOrName(
  context: KanbanMcpContext,
  identifier: string
): Promise<KanbanBoard | null> {
  if (!identifier) {
    return null
  }
  const boards = await kanban.listBoards(context)

  let board = boards.find((b) => b.id === identifier)

  if (!board) {
    const nameToFind = String(identifier).toLowerCase()
    board = boards.find((b) => b.name?.toLowerCase() === nameToFind)
  }

  return board || null
}

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

  const column = board.columns.find(
    (col) => col.id === columnIdOrName || col.title.toLowerCase() === columnIdOrName.toLowerCase()
  )
  if (!column) return null

  const card = await kanban.createCard(context, board.id, column.id, {
    ...cardData,
    createdBy: context.userId
  })

  if (!card) return null

  const updatedBoard = await kanban.getBoard(context, board.id)
  return updatedBoard ? { board: updatedBoard, card } : null
}

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

  let currentColumn = null
  for (const col of board.columns) {
    if (col.cards.find((c) => c.id === cardId)) {
      currentColumn = col
      break
    }
  }
  if (!currentColumn) return null

  const card = await kanban.updateCard(context, board.id, currentColumn.id, cardId, {
    title: updates.title,
    description: updates.description,
    assignee: updates.assignee,
    priority: updates.priority,
    tags: updates.tags,
    ticket: updates.ticket
  })

  if (!card) return null

  const updatedBoard = await kanban.getBoard(context, board.id)
  return updatedBoard ? { board: updatedBoard, card } : null
}

export async function moveCardToColumn(
  context: KanbanMcpContext,
  boardIdOrName: string,
  cardId: string,
  targetColumnIdOrName: string
): Promise<{ board: KanbanBoard; card: KanbanCard } | null> {
  const board = await getBoardByIdOrName(context, boardIdOrName)
  if (!board) return null

  const targetColumn = board.columns.find(
    (col) =>
      col.id === targetColumnIdOrName ||
      col.title.toLowerCase() === targetColumnIdOrName.toLowerCase()
  )
  if (!targetColumn) return null

  // Find current column
  let fromColumn = null
  for (const col of board.columns) {
    if (col.cards.find((c) => c.id === cardId)) {
      fromColumn = col
      break
    }
  }
  if (!fromColumn) return null

  const result = await kanban.moveCard(context, board.id, cardId, fromColumn.id, targetColumn.id)
  if (!result) return null

  const updatedBoard = await kanban.getBoard(context, board.id)
  const updatedCard = updatedBoard?.columns
    .flatMap((col) => col.cards)
    .find((card) => card.id === cardId)

  return updatedBoard && updatedCard ? { board: updatedBoard, card: updatedCard } : null
}

export async function removeCard(
  context: KanbanMcpContext,
  boardIdOrName: string,
  cardId: string
): Promise<boolean> {
  const board = await getBoardByIdOrName(context, boardIdOrName)
  if (!board) return false

  // Find the column containing the card
  let columnId = null
  for (const col of board.columns) {
    if (col.cards.find((c) => c.id === cardId)) {
      columnId = col.id
      break
    }
  }
  if (!columnId) return false

  return await kanban.deleteCard(context, board.id, columnId, cardId)
}

export async function searchCards(
  context: KanbanMcpContext,
  query: string,
  boardIdOrName?: string
): Promise<
  Array<KanbanCard & { boardId: string; boardName: string; columnId: string; columnName: string }>
> {
  const boards = await kanban.listBoards(context)

  const relevantBoards = boardIdOrName
    ? boards.filter(
        (board) =>
          board.id === boardIdOrName || board.name?.toLowerCase() === boardIdOrName.toLowerCase()
      )
    : boards

  const term = query.trim().toLowerCase()
  if (!term) return []

  const matches: Array<
    KanbanCard & { boardId: string; boardName: string; columnId: string; columnName: string }
  > = []

  for (const board of relevantBoards) {
    for (const column of board.columns) {
      for (const card of column.cards) {
        const haystack = [
          card.title,
          card.description,
          card.assignee,
          card.priority,
          ...(card.tags || [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (haystack.includes(term)) {
          matches.push({
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

  return matches
}

export async function getCardsByAssignee(
  context: KanbanMcpContext,
  assignee: string,
  boardIdOrName?: string
): Promise<
  Array<KanbanCard & { boardId: string; boardName: string; columnId: string; columnName: string }>
> {
  const boards = await kanban.listBoards(context)

  const relevantBoards = boardIdOrName
    ? boards.filter(
        (board) =>
          board.id === boardIdOrName || board.name?.toLowerCase() === boardIdOrName.toLowerCase()
      )
    : boards

  const normalizedAssignee = assignee.trim().toLowerCase()
  if (!normalizedAssignee) return []

  const matches: Array<
    KanbanCard & { boardId: string; boardName: string; columnId: string; columnName: string }
  > = []

  for (const board of relevantBoards) {
    for (const column of board.columns) {
      for (const card of column.cards) {
        const cardAssignee = card.assignee?.toLowerCase()
        if (cardAssignee && cardAssignee.includes(normalizedAssignee)) {
          matches.push({
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

  return matches
}
