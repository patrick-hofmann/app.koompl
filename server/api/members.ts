import type { Member } from '~/types'
import { getTeamMembers } from '../features/team'

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
    const teamMembers = await getTeamMembers(currentTeamId)

    // Transform to Member format
    const members: Member[] = teamMembers.map((member) => ({
      name: member.name,
      username: member.email, // Using email as username for now
      role: member.role,
      avatar: generateAvatar(member.name, member.email)
    }))

    return members
  } catch (error: unknown) {
    const err = error as { statusCode?: number; statusMessage?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || 'Failed to fetch members'
    })
  }
})
