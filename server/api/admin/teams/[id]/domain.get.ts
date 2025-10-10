import { getTeam, isSuperAdmin } from '../../../../features/team'

export default defineEventHandler(async (event) => {
  // Check if user is super admin
  const session = await getUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const isSuper = await isSuperAdmin(session.user.id)
  if (!isSuper) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: Super admin access required' })
  }

  const teamId = getRouterParam(event, 'id')
  if (!teamId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing team ID' })
  }

  const team = await getTeam(teamId)
  if (!team) {
    throw createError({ statusCode: 404, statusMessage: 'Team not found' })
  }

  return {
    teamId: team.id,
    teamName: team.name,
    domain: team.domain || null
  }
})
