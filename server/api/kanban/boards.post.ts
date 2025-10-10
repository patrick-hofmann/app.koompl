import { createBoard } from '../../features/kanban'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id

  if (!teamId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected'
    })
  }

  const body = await readBody<{ name: string; description?: string; columns?: string[] }>(event)

  if (!body.name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Board name is required'
    })
  }

  const board = await createBoard(
    { teamId, userId: session.user?.id },
    {
      name: body.name,
      description: body.description,
      initialColumns: body.columns
    }
  )
  return { board }
})
