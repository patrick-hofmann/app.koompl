// import type { Team, AuthUser, TeamMembership } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { email, password } = body

    if (!email || !password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email and password are required'
      })
    }

    const { getIdentity } = await import('../../utils/identityStorage')
    const authData = await getIdentity()

    // Find user credentials
    const foundUser = authData.users.find((u) => u.email === email && u.password === password)
    if (!foundUser) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid credentials'
      })
    }

    // Get all team memberships for this user
    const userMemberships = authData.memberships.filter((m) => m.userId === foundUser.id)
    if (userMemberships.length === 0) {
      throw createError({
        statusCode: 401,
        statusMessage: 'User is not a member of any teams'
      })
    }

    // Get available teams for this user
    const availableTeams = userMemberships
      .map((membership) => {
        const team = authData.teams.find((t) => t.id === membership.teamId)
        if (!team) {
          return null
        }
        return {
          id: team.id,
          name: team.name,
          description: team.description,
          domain: team.domain,
          role: membership.role
        }
      })
      .filter(Boolean)

    // Uniquify in case something duplicated accidentally
    const uniqueTeams = availableTeams.filter(
      (team, index, arr) => arr.findIndex((t) => t.id === team.id) === index
    )
    if (uniqueTeams.length !== availableTeams.length) {
      console.warn(
        'DUPLICATES DETECTED in team computation:',
        availableTeams.length,
        '->',
        uniqueTeams.length
      )
    }

    // Select the first team as default (could be enhanced to remember last selected team)
    const currentTeam = uniqueTeams.length > 0 ? uniqueTeams[0] : null
    if (!currentTeam) {
      throw createError({
        statusCode: 401,
        statusMessage: 'No available teams found'
      })
    }

    // Clear any existing session and set fresh user session via helper
    await clearUserSession(event)
    const { setCustomUserSession } = await import('../../utils/authSession')
    const isSuperAdmin = authData.superAdminIds.includes(foundUser.id)
    await setCustomUserSession(event, {
      user: {
        id: foundUser.id,
        name: foundUser.name,
        email: foundUser.email,
        role: currentTeam.role,
        isSuperAdmin
      },
      team: {
        id: currentTeam.id,
        name: currentTeam.name,
        description: currentTeam.description,
        domain: currentTeam.domain,
        role: currentTeam.role
      },
      availableTeams: uniqueTeams
    })

    return { success: true, availableTeams: uniqueTeams, isSuperAdmin }
  } catch (error: unknown) {
    const err = error as { statusCode?: number; statusMessage?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || 'Authentication failed'
    })
  }
})
