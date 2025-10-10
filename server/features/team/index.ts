import type { IdentityUser, IdentityTeam, IdentityMembership, IdentityData } from './storage'
import {
  getIdentity,
  upsertUser,
  deleteUser,
  upsertTeam,
  deleteTeam,
  upsertMembership,
  deleteMembership,
  setSuperAdminIds,
  addSuperAdmin,
  removeSuperAdmin
} from './storage'

export interface TeamContext {
  userId?: string
  teamId?: string
}

/**
 * Get the entire identity data structure
 */
export async function getIdentityData(): Promise<IdentityData> {
  return await getIdentity()
}

/**
 * List all users
 */
export async function listUsers(): Promise<IdentityUser[]> {
  const identity = await getIdentity()
  return identity.users
}

/**
 * Get a specific user by ID
 */
export async function getUser(userId: string): Promise<IdentityUser | null> {
  const identity = await getIdentity()
  return identity.users.find((user) => user.id === userId) || null
}

/**
 * Get a user by email
 */
export async function getUserByEmail(email: string): Promise<IdentityUser | null> {
  const identity = await getIdentity()
  const normalizedEmail = email.toLowerCase().trim()
  return identity.users.find((user) => user.email.toLowerCase() === normalizedEmail) || null
}

/**
 * Create or update a user
 */
export async function saveUser(
  userData: Omit<IdentityUser, 'id'> & { id?: string }
): Promise<IdentityUser> {
  return await upsertUser(userData)
}

/**
 * Remove a user
 */
export async function removeUser(userId: string): Promise<void> {
  return await deleteUser(userId)
}

/**
 * List all teams
 */
export async function listTeams(): Promise<IdentityTeam[]> {
  const identity = await getIdentity()
  return identity.teams
}

/**
 * Get a specific team by ID
 */
export async function getTeam(teamId: string): Promise<IdentityTeam | null> {
  const identity = await getIdentity()
  return identity.teams.find((team) => team.id === teamId) || null
}

/**
 * Get team by domain
 */
export async function getTeamByDomain(domain: string): Promise<IdentityTeam | null> {
  const identity = await getIdentity()
  const normalizedDomain = domain.toLowerCase().trim()
  return identity.teams.find((team) => team.domain?.toLowerCase() === normalizedDomain) || null
}

/**
 * Create or update a team
 */
export async function saveTeam(
  teamData: Omit<IdentityTeam, 'id'> & { id?: string }
): Promise<IdentityTeam> {
  return await upsertTeam(teamData)
}

/**
 * Remove a team
 */
export async function removeTeam(teamId: string): Promise<void> {
  return await deleteTeam(teamId)
}

/**
 * List all memberships
 */
export async function listMemberships(): Promise<IdentityMembership[]> {
  const identity = await getIdentity()
  return identity.memberships
}

/**
 * Get memberships for a specific user
 */
export async function getUserMemberships(userId: string): Promise<IdentityMembership[]> {
  const identity = await getIdentity()
  return identity.memberships.filter((membership) => membership.userId === userId)
}

/**
 * Get memberships for a specific team
 */
export async function getTeamMemberships(teamId: string): Promise<IdentityMembership[]> {
  const identity = await getIdentity()
  return identity.memberships.filter((membership) => membership.teamId === teamId)
}

/**
 * Get a specific membership
 */
export async function getMembership(
  userId: string,
  teamId: string
): Promise<IdentityMembership | null> {
  const identity = await getIdentity()
  return (
    identity.memberships.find(
      (membership) => membership.userId === userId && membership.teamId === teamId
    ) || null
  )
}

/**
 * Create or update a membership
 */
export async function saveMembership(
  membershipData: Omit<IdentityMembership, 'id'> & { id?: string }
): Promise<IdentityMembership> {
  return await upsertMembership(membershipData)
}

/**
 * Remove a membership
 */
export async function removeMembership(membershipId: string): Promise<void> {
  return await deleteMembership(membershipId)
}

/**
 * Get team members with user details
 */
export async function getTeamMembers(
  teamId: string
): Promise<Array<IdentityUser & { role: 'admin' | 'user'; membershipId: string }>> {
  const identity = await getIdentity()
  const memberships = identity.memberships.filter((m) => m.teamId === teamId)

  return memberships
    .map((membership) => {
      const user = identity.users.find((u) => u.id === membership.userId)
      if (!user) return null

      return {
        ...user,
        role: membership.role,
        membershipId: membership.id
      }
    })
    .filter((member): member is NonNullable<typeof member> => member !== null)
}

/**
 * Get user's teams with membership details
 */
export async function getUserTeams(
  userId: string
): Promise<Array<IdentityTeam & { role: 'admin' | 'user'; membershipId: string }>> {
  const identity = await getIdentity()
  const memberships = identity.memberships.filter((m) => m.userId === userId)

  return memberships
    .map((membership) => {
      const team = identity.teams.find((t) => t.id === membership.teamId)
      if (!team) return null

      return {
        ...team,
        role: membership.role,
        membershipId: membership.id
      }
    })
    .filter((team): team is NonNullable<typeof team> => team !== null)
}

/**
 * Check if a user is a member of a team
 */
export async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  const membership = await getMembership(userId, teamId)
  return membership !== null
}

/**
 * Check if a user is an admin of a team
 */
export async function isTeamAdmin(userId: string, teamId: string): Promise<boolean> {
  const membership = await getMembership(userId, teamId)
  return membership !== null && membership.role === 'admin'
}

/**
 * List all super admin user IDs
 */
export async function listSuperAdmins(): Promise<string[]> {
  const identity = await getIdentity()
  return identity.superAdminIds
}

/**
 * Get super admin users with details
 */
export async function getSuperAdminUsers(): Promise<IdentityUser[]> {
  const identity = await getIdentity()
  return identity.users.filter((user) => identity.superAdminIds.includes(user.id))
}

/**
 * Check if a user is a super admin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const identity = await getIdentity()
  return identity.superAdminIds.includes(userId)
}

/**
 * Set super admin user IDs
 */
export async function setSuperAdmins(userIds: string[]): Promise<string[]> {
  return await setSuperAdminIds(userIds)
}

/**
 * Add a user as super admin
 */
export async function makeSuperAdmin(userId: string): Promise<string[]> {
  return await addSuperAdmin(userId)
}

/**
 * Remove a user from super admins
 */
export async function revokeSuperAdmin(userId: string): Promise<string[]> {
  return await removeSuperAdmin(userId)
}

/**
 * Get team statistics
 */
export async function getTeamStats(teamId?: string): Promise<{
  totalUsers: number
  totalTeams: number
  totalMemberships: number
  usersPerTeam?: Record<string, number>
  adminCount?: number
  userCount?: number
}> {
  const identity = await getIdentity()

  const stats: ReturnType<typeof getTeamStats> extends Promise<infer T> ? T : never = {
    totalUsers: identity.users.length,
    totalTeams: identity.teams.length,
    totalMemberships: identity.memberships.length
  }

  if (teamId) {
    const memberships = identity.memberships.filter((m) => m.teamId === teamId)
    stats.adminCount = memberships.filter((m) => m.role === 'admin').length
    stats.userCount = memberships.filter((m) => m.role === 'user').length
  } else {
    const usersPerTeam: Record<string, number> = {}
    for (const team of identity.teams) {
      const count = identity.memberships.filter((m) => m.teamId === team.id).length
      usersPerTeam[team.id] = count
    }
    stats.usersPerTeam = usersPerTeam
  }

  return stats
}

/**
 * Validate team access for a user
 */
export async function validateTeamAccess(
  userId: string,
  teamId: string
): Promise<{ hasAccess: boolean; role?: 'admin' | 'user' }> {
  const membership = await getMembership(userId, teamId)

  if (!membership) {
    return { hasAccess: false }
  }

  return {
    hasAccess: true,
    role: membership.role
  }
}
