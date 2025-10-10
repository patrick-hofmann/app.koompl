import { getTeam, saveTeam, isSuperAdmin } from '../../../../features/team'

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
  const team = await getTeam(teamId)
  if (!team) {
    throw createError({ statusCode: 404, statusMessage: 'Team not found' })
  }

  // Update team with new domain (saveTeam will handle uniqueness validation)
  const updatedTeam = await saveTeam({
    ...team,
    domain
  })

  return updatedTeam
})
