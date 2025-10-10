import { deleteBoard } from '../../../features/kanban'

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

  const context = { teamId, userId: session.user?.id }
  const success = await deleteBoard(context, boardId)
  if (!success) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Board not found'
    })
  }

  return { success: true }
})
