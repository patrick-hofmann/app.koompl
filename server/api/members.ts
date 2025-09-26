import type { Member } from '~/types'

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

function generateAvatar(name: string, email?: string) {
  const src = email ? `https://ui-avatars.com/api/?background=0ea5e9&color=ffffff&name=${encodeURIComponent(name)}` : `https://ui-avatars.com/api/?background=0ea5e9&color=ffffff&name=${encodeURIComponent(name)}`
  return { src, alt: name, text: name.charAt(0).toUpperCase() }
}

export default eventHandler(async (event) => {
  try {
    const session = await getUserSession(event)
    if (!session?.user || !session?.team) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    const currentTeamId = session.team.id

    // Get all memberships for this team
    const teamMemberships = authData.teamMemberships.filter(
      m => m.teamId === currentTeamId
    )

    // Get all team member data by fetching users and their roles
    const members: Member[] = teamMemberships.map((membership) => {
      const user = authData.users.find(u => u.id === membership.userId)
      if (!user) {
        return null
      }
      return {
        name: user.name,
        username: user.email, // Using email as username for now
        role: membership.role,
        avatar: generateAvatar(user.name, user.email)
      }
    }).filter(Boolean) as Member[]

    return members
  } catch (error: unknown) {
    const err = error as { statusCode?: number, statusMessage?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || 'Failed to fetch members'
    })
  }
})
