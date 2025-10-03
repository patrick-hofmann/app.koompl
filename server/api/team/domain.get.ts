import { getIdentity } from '../../utils/identityStorage'

export default defineEventHandler(async (event) => {
  // Get current user session
  const session = await getUserSession(event)
  if (!session?.user?.id || !session?.team?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const currentTeamId = session.team.id

  // Fetch team data directly from storage (not from session)
  const identity = await getIdentity()
  const team = identity.teams.find((t) => t.id === currentTeamId)

  if (!team) {
    throw createError({ statusCode: 404, statusMessage: 'Team not found' })
  }

  return {
    teamId: team.id,
    teamName: team.name,
    teamDescription: team.description,
    domain: team.domain || null
  }
})
