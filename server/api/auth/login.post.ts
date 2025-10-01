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

    // Load auth data from JSON
    const authData = {
      teams: [
        {
          id: '1',
          name: 'Team 1',
          description: 'Team 1 description'
        },
        {
          id: '2',
          name: 'Team 2',
          description: 'Team 2 description'
        }
      ],
      users: [
        {
          id: '1',
          name: 'Member 1',
          email: 'test1@delta-mind.at',
          password: 'password1'
        },
        {
          id: '2',
          name: 'Member 2',
          email: 'test2@delta-mind.at',
          password: 'password2'
        }
      ],
      teamMemberships: [
        {
          id: '1',
          userId: '1',
          teamId: '1',
          role: 'admin'
        },
        {
          id: '2',
          userId: '2',
          teamId: '1',
          role: 'user'
        },
        {
          id: '3',
          userId: '2',
          teamId: '2',
          role: 'admin'
        }
      ]
    }

    // Find user credentials
    const foundUser = authData.users.find(u => u.email === email && u.password === password)
    if (!foundUser) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid credentials'
      })
    }

    // Get all team memberships for this user
    const userMemberships = authData.teamMemberships.filter(m => m.userId === foundUser.id)
    if (userMemberships.length === 0) {
      throw createError({
        statusCode: 401,
        statusMessage: 'User is not a member of any teams'
      })
    }

    // Get available teams for this user
    const availableTeams = userMemberships.map((membership) => {
      const team = authData.teams.find(t => t.id === membership.teamId)
      if (!team) {
        return null
      }
      return {
        id: team.id,
        name: team.name,
        description: team.description,
        role: membership.role
      }
    }).filter(Boolean)

    // Uniquify in case something duplicated accidentally
    const uniqueTeams = availableTeams.filter((team, index, arr) =>
      arr.findIndex(t => t.id === team.id) === index
    )
    if (uniqueTeams.length !== availableTeams.length) {
      console.warn('DUPLICATES DETECTED in team computation:', availableTeams.length, '->', uniqueTeams.length)
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
    const { setUserSession } = await import('../../utils/authSession')
    await setUserSession(event, {
      user: { id: foundUser.id, name: foundUser.name, email: foundUser.email, role: currentTeam.role },
      team: { id: currentTeam.id, name: currentTeam.name, description: currentTeam.description, role: currentTeam.role },
      availableTeams: uniqueTeams
    })

    return { success: true, availableTeams: uniqueTeams }
  } catch (error: unknown) {
    const err = error as { statusCode?: number, statusMessage?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || 'Authentication failed'
    })
  }
})
