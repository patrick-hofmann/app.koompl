import { addColumn } from '../../../../utils/kanbanStorage'

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

  const body = await readBody<{ title: string; position?: number }>(event)

  if (!body.title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Column title is required'
    })
  }

  const column = await addColumn(teamId, boardId, body.title, body.position)

  if (!column) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Board not found'
    })
  }

  return { column }
})
