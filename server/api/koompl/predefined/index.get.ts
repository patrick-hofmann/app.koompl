import { listPredefinedKoompls } from '../../../features/koompl/predefined'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session.team?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Not authenticated'
    })
  }

  const koompls = await listPredefinedKoompls({
    teamId: session.team.id,
    userId: session.user?.id
  })

  return {
    ok: true,
    koompls
  }
})
