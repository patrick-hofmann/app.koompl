/**
 * Helper functions for constructing agent emails from username + team domain
 */

import type { Agent } from '~/types'
import { getIdentity } from './identityStorage'

/**
 * Constructs full email from username and team domain
 * @param username - The username part (e.g., "chris-coordinator")
 * @param teamId - The team ID to look up domain
 * @returns Full email address (e.g., "chris-coordinator@company.com")
 */
export async function getAgentFullEmail(username: string, teamId?: string): Promise<string> {
  if (!teamId) {
    // Fallback for agents without team
    return `${username}@agents.local`
  }

  const identity = await getIdentity()
  const team = identity.teams.find((t) => t.id === teamId)

  if (!team?.domain) {
    // Fallback if team has no domain
    return `${username}@agents.local`
  }

  return `${username}@${team.domain}`
}

/**
 * Constructs full email synchronously when team domain is already known
 * @param username - The username part
 * @param teamDomain - The team's domain
 * @returns Full email address
 */
export function constructEmail(username: string, teamDomain?: string): string {
  if (!teamDomain) {
    return `${username}@agents.local`
  }
  return `${username}@${teamDomain}`
}

/**
 * Extracts username from email address
 * @param email - Full email or just username
 * @returns Username part only
 */
export function extractUsername(email: string): string {
  return email.split('@')[0]
}

/**
 * Validates username format (alphanumeric, hyphens, underscores only)
 * @param username - Username to validate
 * @returns True if valid
 */
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_-]+$/i.test(username)
}

/**
 * Gets agent's full email for display/sending
 * Uses agent.email (username) + agent.teamId to construct full email
 */
export async function getAgentEmail(agent: Agent): Promise<string> {
  return await getAgentFullEmail(agent.email, agent.teamId)
}
