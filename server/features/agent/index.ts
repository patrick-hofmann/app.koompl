import type { Agent } from '~/types'
import {
  createAgentStorage,
  createAgentObject,
  updateAgentObject,
  extractUsername
} from '../../utils/shared'
import {
  listAgentDirectory,
  getAgentDirectoryEntry,
  findAgentsByCapability,
  listDirectoryCapabilities,
  type AgentDirectoryEntry
} from './directory'

export interface AgentContext {
  teamId?: string
  userId?: string
}

/**
 * Get all agents, optionally filtered by team
 */
export async function listAgents(context: AgentContext): Promise<Agent[]> {
  const storage = createAgentStorage()
  const allAgents = await storage.read()

  if (context.teamId) {
    return allAgents.filter((agent) => agent.teamId === context.teamId)
  }

  return allAgents
}

/**
 * Get a specific agent by ID
 */
export async function getAgent(agentId: string): Promise<Agent | null> {
  const storage = createAgentStorage()
  return await storage.findById(agentId)
}

/**
 * Get agent by email/username
 */
export async function getAgentByEmail(email: string, teamId?: string): Promise<Agent | null> {
  const storage = createAgentStorage()
  const allAgents = await storage.read()
  const username = extractUsername(email)

  return (
    allAgents.find((agent) => {
      const matchesEmail = agent.email.toLowerCase() === username.toLowerCase()
      const matchesTeam = !teamId || agent.teamId === teamId
      return matchesEmail && matchesTeam
    }) || null
  )
}

/**
 * Create a new agent
 */
export async function createAgent(
  context: AgentContext,
  agentData: Partial<Agent>
): Promise<Agent> {
  const storage = createAgentStorage()
  const existingAgents = await storage.read()

  // Auto-assign teamId from context if not provided
  const teamId = agentData.teamId || context.teamId

  // For predefined agents, check if already exists and use the provided ID
  let agent: Agent
  if (agentData.isPredefined && agentData.id) {
    const existing = existingAgents.find((a) => a.id === agentData.id)
    if (existing) {
      throw createError({ statusCode: 409, statusMessage: 'Predefined agent already exists' })
    }

    const username = agentData.email ? extractUsername(agentData.email) : agentData.id
    agent = {
      id: agentData.id,
      name: agentData.name || '',
      email: username,
      role: agentData.role || 'Agent',
      prompt: agentData.prompt || '',
      avatar: agentData.avatar,
      mcpServerIds: agentData.mcpServerIds || [],
      isPredefined: true
    }
  } else {
    // For custom agents, generate ID and extract username
    agent = createAgentObject(
      agentData,
      existingAgents.map((a) => a.id)
    )
  }

  return await storage.create({
    ...agent,
    multiRoundConfig: agentData.multiRoundConfig,
    teamId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
}

/**
 * Update an existing agent
 */
export async function updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent | null> {
  const storage = createAgentStorage()
  const existing = await storage.findById(agentId)

  if (!existing) {
    return null
  }

  const updated = updateAgentObject(existing, updates)

  return await storage.update(agentId, {
    ...updated,
    multiRoundConfig: updates.multiRoundConfig ?? existing.multiRoundConfig,
    teamId: updates.teamId ?? existing.teamId,
    updatedAt: new Date().toISOString()
  })
}

/**
 * Delete an agent
 */
export async function deleteAgent(agentId: string): Promise<boolean> {
  const storage = createAgentStorage()
  return await storage.delete(agentId)
}

/**
 * Get agent directory entries with capabilities
 */
export async function getAgentDirectory(teamId?: string): Promise<AgentDirectoryEntry[]> {
  return await listAgentDirectory(teamId)
}

/**
 * Get a single agent directory entry
 */
export async function getAgentDirectoryInfo(
  identifier: string,
  teamId?: string
): Promise<AgentDirectoryEntry | null> {
  return await getAgentDirectoryEntry(identifier, teamId)
}

/**
 * Find agents by capability
 */
export async function findAgentsByCapabilities(
  capability: string,
  teamId?: string
): Promise<AgentDirectoryEntry[]> {
  return await findAgentsByCapability(capability, teamId)
}

/**
 * List all available agent capabilities
 */
export async function listCapabilities(teamId?: string): Promise<string[]> {
  return await listDirectoryCapabilities(teamId)
}

/**
 * Get agents with specific builtin MCP server
 * Supported: builtin-kanban, builtin-datasafe, builtin-agents, builtin-calendar, builtin-email
 */
export async function getAgentsWithBuiltinServer(
  builtinServerId: string,
  teamId?: string
): Promise<Agent[]> {
  const storage = createAgentStorage()
  const allAgents = await storage.read()

  // Validate it's a builtin server
  const validBuiltinServers = [
    'builtin-kanban',
    'builtin-datasafe',
    'builtin-agents',
    'builtin-calendar',
    'builtin-email'
  ]
  if (!validBuiltinServers.includes(builtinServerId)) {
    return []
  }

  return allAgents.filter((agent) => {
    const matchesTeam = !teamId || agent.teamId === teamId
    const hasServer = agent.mcpServerIds?.includes(builtinServerId)
    return matchesTeam && hasServer
  })
}

/**
 * Check if agent can communicate with another agent
 */
export async function canCommunicateWith(
  agentId: string,
  targetAgentEmail: string
): Promise<boolean> {
  const agent = await getAgent(agentId)
  if (!agent) return false

  // Check if agent can communicate with other agents
  if (!agent.multiRoundConfig?.canCommunicateWithAgents) return false

  // Check if target agent is in allowed list
  const allowedAgents = agent.multiRoundConfig.allowedAgentEmails || []
  if (allowedAgents.length === 0) return true // No restrictions

  const targetUsername = extractUsername(targetAgentEmail)
  return allowedAgents.some(
    (allowed) => extractUsername(allowed).toLowerCase() === targetUsername.toLowerCase()
  )
}

/**
 * Get agent statistics
 */
export async function getAgentStats(context: AgentContext): Promise<{
  totalAgents: number
  predefinedAgents: number
  customAgents: number
  agentsByTeam?: Record<string, number>
}> {
  const agents = await listAgents(context)

  const predefinedAgents = agents.filter((a) => a.isPredefined).length
  const customAgents = agents.filter((a) => !a.isPredefined).length

  const stats: ReturnType<typeof getAgentStats> extends Promise<infer T> ? T : never = {
    totalAgents: agents.length,
    predefinedAgents,
    customAgents
  }

  if (!context.teamId) {
    const agentsByTeam: Record<string, number> = {}
    for (const agent of agents) {
      if (agent.teamId) {
        agentsByTeam[agent.teamId] = (agentsByTeam[agent.teamId] || 0) + 1
      }
    }
    stats.agentsByTeam = agentsByTeam
  }

  return stats
}
