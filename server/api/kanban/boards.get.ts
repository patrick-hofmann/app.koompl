import { listBoards } from '../../features/kanban'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id

  if (!teamId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected'
    })
  }

  const boards = await listBoards({ teamId, userId: session.user?.id })
  return { boards }
})
