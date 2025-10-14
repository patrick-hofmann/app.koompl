import type { Agent } from '~/types'
import { createAgentStorage, createAgentObject, updateAgentObject } from '../../utils/shared'

export interface CustomKoomplContext {
  teamId?: string
  userId?: string
}

/**
 * List all custom koompls (excludes predefined templates)
 */
export async function listCustomKoompls(context: CustomKoomplContext): Promise<Agent[]> {
  const storage = createAgentStorage()
  const allAgents = await storage.read()

  let filtered = allAgents.filter((agent) => !agent.isPredefined)

  if (context.teamId) {
    filtered = filtered.filter((agent) => agent.teamId === context.teamId)
  }

  return filtered
}

/**
 * Get a specific custom koompl by ID
 */
export async function getCustomKoompl(koomplId: string): Promise<Agent | null> {
  const storage = createAgentStorage()
  const agent = await storage.findById(koomplId)

  if (!agent || agent.isPredefined) {
    return null
  }

  return agent
}

/**
 * Create a new custom koompl
 */
export async function createCustomKoompl(
  context: CustomKoomplContext,
  data: Partial<Agent>
): Promise<Agent> {
  const storage = createAgentStorage()
  const newAgent = createAgentObject(data, context.teamId, context.userId)

  // Ensure it's not marked as predefined
  newAgent.isPredefined = false

  const allAgents = await storage.read()
  allAgents.push(newAgent)
  await storage.write(allAgents)

  return newAgent
}

/**
 * Update a custom koompl
 */
export async function updateCustomKoompl(
  koomplId: string,
  updates: Partial<Agent>
): Promise<Agent | null> {
  const storage = createAgentStorage()
  const allAgents = await storage.read()
  const agent = allAgents.find((a) => a.id === koomplId && !a.isPredefined)

  if (!agent) {
    return null
  }

  const updated = updateAgentObject(agent, updates)
  await storage.write(allAgents)

  return updated
}

/**
 * Delete a custom koompl
 */
export async function deleteCustomKoompl(koomplId: string): Promise<boolean> {
  const storage = createAgentStorage()
  const allAgents = await storage.read()
  const index = allAgents.findIndex((a) => a.id === koomplId && !a.isPredefined)

  if (index === -1) {
    return false
  }

  allAgents.splice(index, 1)
  await storage.write(allAgents)

  return true
}
