import type { H3Event } from 'h3'
/**
 * Authentication/session helpers to deduplicate common flows
 */

type SessionUser = {
  id: string;
  name: string;
  email: string;
  role?: string
}

type SessionTeam = {
  id: string;
  name: string;
  description?: string;
  role?: string
}

type AvailableTeam = {
  id: string;
  name: string;
  description?: string;
  role?: string
}

export async function setCustomUserSession(
  event: H3Event,
  params: {
    user: SessionUser;
    team: SessionTeam;
    availableTeams: AvailableTeam[];
    loggedInAt?: string
  }
): Promise<void> {
  await replaceUserSession(event, {
    user: {
      id: params.user.id,
      name: params.user.name,
      email: params.user.email,
      role: params.user.role || params.team.role
    },
    team: {
      id: params.team.id,
      name: params.team.name,
      description: params.team.description
    },
    availableTeams: params.availableTeams,
    loggedInAt: params.loggedInAt || new Date().toISOString()
  })
}
export async function getRequiredSession<TSession = unknown>(event: H3Event): Promise<TSession> {
  const session = await getUserSession<TSession>(event)
  if (!session?.user || !session?.team) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }
  return session
}
