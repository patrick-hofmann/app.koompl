// import type { Team } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { teamId } = body

    if (!teamId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Team ID is required'
      })
    }

    const session = await getUserSession(event)

    if (!session?.user || !session?.availableTeams) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Not authenticated or no teams available'
      })
    }

    // Find the requested team from available teams
    const targetTeam = session.availableTeams.find(t => t.id === teamId)
    if (!targetTeam) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Team not available to this user'
      })
    }

    // Replace entire session with fresh data to avoid accumulation issues
    await replaceUserSession(event, {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: targetTeam.role
      },
      team: {
        id: targetTeam.id,
        name: targetTeam.name,
        description: targetTeam.description
      },
      availableTeams: session.availableTeams || [], // direct reference preserve integrity
      loggedInAt: session.loggedInAt || new Date().toISOString()
    })

    return {
      success: true,
      team: {
        id: targetTeam.id,
        name: targetTeam.name,
        description: targetTeam.description
      }
    }
  } catch (error: unknown) {
    const err = error as { statusCode?: number, statusMessage?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || 'Team switch failed'
    })
  }
})
