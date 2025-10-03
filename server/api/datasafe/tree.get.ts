import { getTree, listFolder, ensureTeamDatasafe } from '../../utils/datasafeStorage'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id

  if (!teamId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected'
    })
  }

  await ensureTeamDatasafe(teamId)

  const query = getQuery(event)
  const path = typeof query.path === 'string' ? query.path : undefined
  const node = path ? await listFolder(teamId, path) : await getTree(teamId)

  return {
    ok: true,
    path: path || '',
    node
  }
})
