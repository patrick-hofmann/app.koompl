export interface KanbanCard {
  id: string
  title: string
  description?: string
  assignee?: string
  priority?: 'Low' | 'Medium' | 'High'
  tags?: string[]
  ticket?: string
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface KanbanColumn {
  id: string
  title: string
  cards: KanbanCard[]
  order: number
}

export interface KanbanBoard {
  id: string
  teamId: string
  name: string
  description?: string
  columns: KanbanColumn[]
  createdAt: string
  updatedAt: string
}

export interface KanbanBoardList {
  [boardId: string]: KanbanBoard
}
