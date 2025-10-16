import type { Agent } from '~/types'
import { createAgentStorage, extractUsername } from '../../utils/shared'
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
 * Create a new predefined agent
 */
export async function createAgent(
  context: AgentContext,
  agentData: Partial<Agent>
): Promise<Agent> {
  // Only allow predefined agents
  if (!agentData.isPredefined || !agentData.id) {
    throw createError({ statusCode: 400, statusMessage: 'Only predefined agents are supported' })
  }

  const storage = createAgentStorage()
  const existingAgents = await storage.read()

  // Auto-assign teamId from context if not provided
  const teamId = agentData.teamId || context.teamId

  // Check if predefined agent already exists
  const existing = existingAgents.find((a) => a.id === agentData.id)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Predefined agent already exists' })
  }

  const username = agentData.email ? extractUsername(agentData.email) : agentData.id
  const agent: Agent = {
    id: agentData.id,
    name: agentData.name || '',
    email: username,
    role: agentData.role || 'Agent',
    prompt: agentData.prompt || '',
    avatar: agentData.avatar,
    mcpServerIds: agentData.mcpServerIds || [],
    isPredefined: true
  }

  return await storage.create({
    ...agent,
    teamId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
}

/**
 * Update an existing agent (no longer supported for custom agents)
 */
export async function updateAgent(): Promise<Agent | null> {
  // Custom agent updates are no longer supported
  throw createError({
    statusCode: 403,
    statusMessage: 'Agent updates are not allowed. Only predefined agents are supported.'
  })
}

/**
 * Delete an agent (only predefined agents can be deleted)
 */
export async function deleteAgent(agentId: string): Promise<boolean> {
  const storage = createAgentStorage()
  const existing = await storage.findById(agentId)

  // Only allow deletion of predefined agents
  if (!existing || !existing.isPredefined) {
    throw createError({ statusCode: 403, statusMessage: 'Only predefined agents can be deleted' })
  }

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

  // Use mail policy system to check if agent can send emails to target
  const { evaluateOutboundMail } = await import('../../utils/mailPolicy')
  const result = await evaluateOutboundMail(agent, targetAgentEmail)
  return result.allowed
}

/**
 * Get agent statistics
 */
export async function getAgentStats(context: AgentContext): Promise<{
  totalAgents: number
  predefinedAgents: number
  agentsByTeam?: Record<string, number>
}> {
  const agents = await listAgents(context)

  const predefinedAgents = agents.filter((a) => a.isPredefined).length

  const stats: ReturnType<typeof getAgentStats> extends Promise<infer T> ? T : never = {
    totalAgents: predefinedAgents, // Only predefined agents are supported now
    predefinedAgents
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
