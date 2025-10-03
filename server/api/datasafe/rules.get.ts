import { getRules, ensureTeamDatasafe } from '../../utils/datasafeStorage'

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
  const rules = await getRules(teamId)

  return {
    ok: true,
    rules
  }
})
