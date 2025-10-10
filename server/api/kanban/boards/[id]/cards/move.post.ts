import { moveCard } from '../../../../../features/kanban'

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
  if (!boardId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Board ID is required'
    })
  }

  const body = await readBody<{
    cardId: string
    fromColumnId: string
    toColumnId: string
    position?: number
  }>(event)

  if (!body.cardId || !body.fromColumnId || !body.toColumnId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Card ID, from column ID, and to column ID are required'
    })
  }

  const context = { teamId, userId: session.user?.id }
  const success = await moveCard(
    context,
    boardId,
    body.cardId,
    body.fromColumnId,
    body.toColumnId,
    body.position
  )

  if (!success) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Board, columns, or card not found'
    })
  }

  return { success: true }
})
