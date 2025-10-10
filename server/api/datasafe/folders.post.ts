import { createFolder } from '../../features/datasafe'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id

  if (!teamId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected'
    })
  }

  const body = await readBody<{ path?: string }>(event)
  const path = typeof body?.path === 'string' ? body.path : ''
  if (!path) {
    throw createError({ statusCode: 400, statusMessage: 'Folder path required' })
  }

  const context = { teamId, userId: session.user?.id }
  const folder = await createFolder(context, path)

  return {
    ok: true,
    folder
  }
})
