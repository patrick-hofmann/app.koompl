import type { Agent, MailPolicyRule } from '~/types'
import { getIdentity } from '../team/storage'
import { normalizeMailPolicy } from '../../utils/mailPolicy'
import agentConfig from '~~/agents.config'

interface AgentDirectoryEntry {
  id: string
  name: string
  username: string
  fullEmail: string
  role: string
  teamId?: string
  teamDomain?: string
  capabilities: string[]
  summary: string
  description?: string
  canDelegate: boolean
  allowedAgents?: string[]
  mcpServers: Array<{
    id: string
    name: string
    provider: string
    category: string
  }>
  isPredefined?: boolean
  createdAt?: string
  updatedAt?: string
  mailPolicy: {
    inbound: MailPolicyRule
    outbound: MailPolicyRule
    allowedInbound: string[]
    allowedOutbound: string[]
  }
}

// Builtin MCP servers metadata
interface BuiltinServer {
  id: string
  name: string
  provider: string
  category: string
}

const BUILTIN_SERVERS: BuiltinServer[] = Object.values(agentConfig.mcp.metadata).map((server) => ({
  id: server.id,
  name: server.name,
  provider: server.provider,
  category: server.category
}))

interface DirectoryContext {
  agents: Agent[]
  serverMap: Map<string, BuiltinServer>
  teamDomainById: Map<string, string | undefined>
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

async function deriveCapabilities(
  agent: Agent,
  serverMap: Map<string, BuiltinServer>
): { capabilities: string[]; summary: string } {
  const capabilitySet = new Set<string>(['email_support'])
  const summaryParts: string[] = []

  const roleSlug = slugify(agent.role || '')
  if (roleSlug) {
    capabilitySet.add(`role_${roleSlug}`)
  }

  // Check if agent can communicate with other agents using mail policy
  const normalizedPolicy = await normalizeMailPolicy(agent)
  if (
    normalizedPolicy.outbound === 'team_and_agents' ||
    normalizedPolicy.outbound === 'agents_only' ||
    normalizedPolicy.outbound === 'any'
  ) {
    capabilitySet.add('agent_delegation')
    summaryParts.push('koordiniert mit anderen Agents')
  }

  const serverSummaries: string[] = []

  for (const serverId of agent.mcpServerIds || []) {
    const server = serverMap.get(serverId)
    if (!server) continue

    capabilitySet.add(`mcp_${slugify(server.provider)}`)

    switch (server.provider) {
      case 'builtin-calendar':
        capabilitySet.add('calendar_management')
        serverSummaries.push('Kalenderpflege')
        break
      case 'builtin-kanban':
        capabilitySet.add('kanban_management')
        serverSummaries.push('Kanban-Workflows')
        break
      case 'builtin-datasafe':
        capabilitySet.add('file_management')
        serverSummaries.push('Dateiverwaltung')
        break
      case 'builtin-agents':
        capabilitySet.add('agent_directory')
        serverSummaries.push('Agent-Verzeichnis')
        break
      case 'builtin-email':
        capabilitySet.add('email_management')
        serverSummaries.push('E-Mail-Unterstützung')
        break
      default:
        serverSummaries.push(server.name)
        break
    }
  }

  if (serverSummaries.length > 0) {
    summaryParts.push(serverSummaries.join(', '))
  }

  if (summaryParts.length === 0) {
    summaryParts.push('beantwortet allgemeine Anfragen')
  }

  return {
    capabilities: Array.from(capabilitySet),
    summary: summaryParts.join(' · ')
  }
}

async function loadDirectoryContext(teamId?: string): Promise<DirectoryContext> {
  const agentsStorage = useStorage('agents')

  const [agents, identity] = await Promise.all([
    agentsStorage.getItem<Agent[]>('agents.json'),
    getIdentity()
  ])

  const filteredAgents = (agents || [])
    .filter((agent) => !teamId || agent.teamId === teamId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const domainById = new Map<string, string | undefined>()
  for (const team of identity.teams) {
    domainById.set(team.id, team.domain)
  }

  return {
    agents: filteredAgents,
    serverMap: new Map(BUILTIN_SERVERS.map((server) => [server.id, server])),
    teamDomainById: domainById
  }
}

async function buildDirectoryEntry(
  agent: Agent,
  context: DirectoryContext
): Promise<AgentDirectoryEntry> {
  const teamDomain = agent.teamId ? context.teamDomainById.get(agent.teamId) : undefined
  const fullEmail = teamDomain ? `${agent.email}@${teamDomain}` : `${agent.email}@agents.local`

  const { capabilities, summary } = await deriveCapabilities(agent, context.serverMap)

  const _allowedAgents = agent.multiRoundConfig?.allowedAgentEmails
    ?.map((email) => {
      const trimmed = email.trim()
      if (!trimmed) return ''
      if (trimmed.includes('@')) {
        return trimmed.toLowerCase()
      }
      return teamDomain
        ? `${trimmed.toLowerCase()}@${teamDomain.toLowerCase()}`
        : trimmed.toLowerCase()
    })
    .filter((value) => value.length > 0)

  const visibleServers = (agent.mcpServerIds || [])
    .map((serverId) => context.serverMap.get(serverId))
    .filter((server): server is BuiltinServer => Boolean(server))

  const description = (agent.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 320)

  // Use agent as-is; predefined agents are stored with their template values
  const effectiveAgent = agent
  const normalizedPolicy = await normalizeMailPolicy(agent)

  return {
    id: effectiveAgent.id,
    name: effectiveAgent.name,
    username: effectiveAgent.email,
    fullEmail,
    role: effectiveAgent.role,
    teamId: agent.teamId,
    teamDomain,
    capabilities,
    summary,
    description: description || undefined,
    canDelegate: Boolean(
      normalizedPolicy.outbound === 'team_and_agents' ||
        normalizedPolicy.outbound === 'agents_only' ||
        normalizedPolicy.outbound === 'any'
    ),
    allowedAgents:
      normalizedPolicy.allowedOutbound.size > 0
        ? Array.from(normalizedPolicy.allowedOutbound)
        : undefined,
    mcpServers: visibleServers,
    isPredefined: effectiveAgent.isPredefined,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    mailPolicy: {
      inbound: normalizedPolicy.inbound,
      outbound: normalizedPolicy.outbound,
      allowedInbound: Array.from(normalizedPolicy.allowedInbound),
      allowedOutbound: Array.from(normalizedPolicy.allowedOutbound)
    }
  }
}

export async function listAgentDirectory(teamId?: string): Promise<AgentDirectoryEntry[]> {
  const context = await loadDirectoryContext(teamId)
  // Only show predefined agents
  const predefinedAgents = context.agents.filter((agent) => agent.isPredefined)
  return Promise.all(predefinedAgents.map((agent) => buildDirectoryEntry(agent, context)))
}

export async function getAgentDirectoryEntry(
  identifier: string,
  teamId?: string
): Promise<AgentDirectoryEntry | null> {
  const context = await loadDirectoryContext(teamId)
  const normalized = identifier.toLowerCase()

  // Only look for predefined agents
  const agent = context.agents
    .filter((candidate) => candidate.isPredefined)
    .find((candidate) => {
      if (candidate.id === identifier) return true
      if (candidate.email && candidate.email.toLowerCase() === normalized) return true
      if (candidate.teamId) {
        const domain = context.teamDomainById.get(candidate.teamId) || 'agents.local'
        const fullEmail = `${candidate.email}@${domain}`.toLowerCase()
        if (fullEmail === normalized) return true
      }
      return false
    })

  if (!agent) return null
  return buildDirectoryEntry(agent, context)
}

export async function findAgentsByCapability(
  capability: string,
  teamId?: string
): Promise<AgentDirectoryEntry[]> {
  const context = await loadDirectoryContext(teamId)
  const target = slugify(capability)

  const withCaps = await Promise.all(
    context.agents.map(async (agent) => ({
      agent,
      capabilities: (await deriveCapabilities(agent, context.serverMap)).capabilities
    }))
  )

  const filtered = withCaps
    .filter((entry) => entry.capabilities.some((c) => c.includes(target)))
    .map((entry) => entry.agent)

  return Promise.all(filtered.map((agent) => buildDirectoryEntry(agent, context)))
}

export async function listDirectoryCapabilities(teamId?: string): Promise<string[]> {
  const context = await loadDirectoryContext(teamId)
  const capabilitySet = new Set<string>()

  const caps = await Promise.all(
    context.agents.map((agent) => deriveCapabilities(agent, context.serverMap))
  )
  for (const c of caps) {
    c.capabilities.forEach((capability) => capabilitySet.add(capability))
  }

  return Array.from(capabilitySet).sort()
}

export type { AgentDirectoryEntry }
