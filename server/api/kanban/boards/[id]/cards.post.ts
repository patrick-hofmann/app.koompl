import { addCard } from '../../../../utils/kanbanStorage'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id
  const userId = session.user.id

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
    columnId: string
    title: string
    description?: string
    assignee?: string
    priority?: 'Low' | 'Medium' | 'High'
    tags?: string[]
    ticket?: string
  }>(event)

  if (!body.columnId || !body.title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Column ID and card title are required'
    })
  }

  const card = await addCard(teamId, boardId, body.columnId, {
    title: body.title,
    description: body.description,
    assignee: body.assignee,
    priority: body.priority,
    tags: body.tags,
    ticket: body.ticket,
    createdBy: userId
  })

  if (!card) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Board or column not found'
    })
  }

  return { card }
})
