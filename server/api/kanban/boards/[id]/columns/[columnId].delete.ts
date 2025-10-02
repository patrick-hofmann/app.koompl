import { deleteColumn } from '../../../../../utils/kanbanStorage'

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
  const columnId = getRouterParam(event, 'columnId')

  if (!boardId || !columnId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Board ID and Column ID are required'
    })
  }

  const success = await deleteColumn(teamId, boardId, columnId)

  if (!success) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Board or column not found'
    })
  }

  return { success: true }
})
