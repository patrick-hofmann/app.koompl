import { moveFile } from '../../features/datasafe'

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

  const context = { teamId, userId: session.user?.id }
  const node = await moveFile(context, sourcePath, targetFolder)

  return {
    ok: true,
    node
  }
})
