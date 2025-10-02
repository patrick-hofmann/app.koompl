import { updateCard } from '../../../../../utils/kanbanStorage'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id

  if (!teamId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected'
    })
  }

  const boardId = getRouterParam(event, 'id')
  const cardId = getRouterParam(event, 'cardId')

  if (!boardId || !cardId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Board ID and Card ID are required'
    })
  }

  const body = await readBody<{
    columnId: string
    title?: string
    description?: string
    assignee?: string
    priority?: 'Low' | 'Medium' | 'High'
    tags?: string[]
    ticket?: string
  }>(event)

  if (!body.columnId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Column ID is required'
    })
  }

  const card = await updateCard(teamId, boardId, body.columnId, cardId, body)

  if (!card) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Board, column, or card not found'
    })
  }

  return { card }
})
