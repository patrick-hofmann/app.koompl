import type { Member } from '~/types'
import { getIdentity } from '../utils/identityStorage'

function generateAvatar(name: string, email?: string) {
  const src = email
    ? `https://ui-avatars.com/api/?background=0ea5e9&color=ffffff&name=${encodeURIComponent(name)}`
    : `https://ui-avatars.com/api/?background=0ea5e9&color=ffffff&name=${encodeURIComponent(name)}`
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
    const identity = await getIdentity()

    // Get all memberships for this team
    const teamMemberships = identity.memberships.filter((m) => m.teamId === currentTeamId)

    // Get all team member data by fetching users and their roles
    const members: Member[] = teamMemberships
      .map((membership) => {
        const user = identity.users.find((u) => u.id === membership.userId)
        if (!user) {
          return null
        }
        return {
          name: user.name,
          username: user.email, // Using email as username for now
          role: membership.role,
          avatar: generateAvatar(user.name, user.email)
        }
      })
      .filter(Boolean) as Member[]

    return members
  } catch (error: unknown) {
    const err = error as { statusCode?: number; statusMessage?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || 'Failed to fetch members'
    })
  }
})
