import { upsertTeam, getIdentity } from '../../../../utils/identityStorage'

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

  const body = await readBody<{ domain?: string }>(event)
  const domain = body.domain ? String(body.domain).trim().toLowerCase() : undefined

  // Validate domain format (basic validation)
  if (domain && !/^[a-z0-9][a-z0-9-]*\.[a-z]{2,}$/i.test(domain)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid domain format. Expected format: example.com'
    })
  }

  // Get existing team
  const team = identity.teams.find((t) => t.id === teamId)
  if (!team) {
    throw createError({ statusCode: 404, statusMessage: 'Team not found' })
  }

  // Update team with new domain (upsertTeam will handle uniqueness validation)
  const updatedTeam = await upsertTeam({
    ...team,
    domain
  })

  return updatedTeam
})
