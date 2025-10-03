import { moveFileNode, ensureTeamDatasafe } from '../../utils/datasafeStorage'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id

  if (!teamId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected'
    })
  }

  const body = await readBody<{ sourcePath?: string; targetFolder?: string }>(event)
  const sourcePath = typeof body?.sourcePath === 'string' ? body.sourcePath : ''
  const targetFolder = typeof body?.targetFolder === 'string' ? body.targetFolder : ''

  if (!sourcePath) {
    throw createError({ statusCode: 400, statusMessage: 'Source path required' })
  }

  await ensureTeamDatasafe(teamId)
  const node = await moveFileNode(teamId, sourcePath, targetFolder)

  return {
    ok: true,
    node
  }
})
