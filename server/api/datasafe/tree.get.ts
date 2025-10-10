import { getTree } from '../../features/datasafe'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id

  if (!teamId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected'
    })
  }

  const query = getQuery(event)
  const path = typeof query.path === 'string' ? query.path : undefined

  const context = { teamId, userId: session.user?.id }
  const node = await getTree(context, path)

  return {
    ok: true,
    path: path || '',
    node
  }
})
