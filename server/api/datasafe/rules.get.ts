import { listRules } from '../../features/datasafe'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id

  if (!teamId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected'
    })
  }

  const context = { teamId, userId: session.user?.id }
  const rules = await listRules(context)

  return {
    ok: true,
    rules
  }
})
