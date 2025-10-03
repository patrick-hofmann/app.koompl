import { getIdentity } from '../../../../utils/identityStorage'

export default defineEventHandler(async (event) => {
  // Check if user is super admin
  const session = await getUserSession(event)
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const identity = await getIdentity()
  if (!identity.superAdminIds.includes(session.user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: Super admin access required' })
  }

  const teamId = getRouterParam(event, 'id')
  if (!teamId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing team ID' })
  }

  const team = identity.teams.find((t) => t.id === teamId)
  if (!team) {
    throw createError({ statusCode: 404, statusMessage: 'Team not found' })
  }

  return {
    teamId: team.id,
    teamName: team.name,
    domain: team.domain || null
  }
})
