import type { Agent, MailPolicyRule } from '~/types'
import { getIdentity } from '../team/storage'
import { normalizeMailPolicy } from '../../utils/mailPolicy'

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

const BUILTIN_SERVERS: BuiltinServer[] = [
  {
    id: 'builtin-kanban',
    name: 'Team Kanban Board',
    provider: 'builtin-kanban',
    category: 'productivity'
  },
  {
    id: 'builtin-datasafe',
    name: 'Team Datasafe',
    provider: 'builtin-datasafe',
    category: 'storage'
  },
  {
    id: 'builtin-agents',
    name: 'Agents Directory',
    provider: 'builtin-agents',
    category: 'directory'
  },
  {
    id: 'builtin-calendar',
    name: 'Team Calendar',
    provider: 'builtin-calendar',
    category: 'calendar'
  },
  {
    id: 'builtin-email',
    name: 'Email Support',
    provider: 'builtin-email',
    category: 'communication'
  }
]

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

function deriveCapabilities(
  agent: Agent,
  serverMap: Map<string, BuiltinServer>
): { capabilities: string[]; summary: string } {
  const capabilitySet = new Set<string>(['email_support'])
  const summaryParts: string[] = []

  const roleSlug = slugify(agent.role || '')
  if (roleSlug) {
    capabilitySet.add(`role_${roleSlug}`)
  }

  if (agent.multiRoundConfig?.canCommunicateWithAgents) {
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

  const { capabilities, summary } = deriveCapabilities(agent, context.serverMap)

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

  // Apply predefined overrides for consistent behavior with decision engine
  const { withPredefinedOverride } = await import('../../utils/predefinedKoompls')
  const effectiveAgent = withPredefinedOverride(agent)
  const normalizedPolicy = normalizeMailPolicy(effectiveAgent)

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
    canDelegate: Boolean(effectiveAgent.multiRoundConfig?.canCommunicateWithAgents),
    allowedAgents:
      effectiveAgent.multiRoundConfig?.allowedAgentEmails &&
      effectiveAgent.multiRoundConfig.allowedAgentEmails.length > 0
        ? effectiveAgent.multiRoundConfig.allowedAgentEmails
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
  return Promise.all(context.agents.map((agent) => buildDirectoryEntry(agent, context)))
}

export async function getAgentDirectoryEntry(
  identifier: string,
  teamId?: string
): Promise<AgentDirectoryEntry | null> {
  const context = await loadDirectoryContext(teamId)
  const normalized = identifier.toLowerCase()

  const agent = context.agents.find((candidate) => {
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

  const filteredAgents = context.agents.filter((agent) => {
    const { capabilities } = deriveCapabilities(agent, context.serverMap)
    return capabilities.some((entry) => entry.includes(target))
  })

  return Promise.all(filteredAgents.map((agent) => buildDirectoryEntry(agent, context)))
}

export async function listDirectoryCapabilities(teamId?: string): Promise<string[]> {
  const context = await loadDirectoryContext(teamId)
  const capabilitySet = new Set<string>()

  for (const agent of context.agents) {
    const { capabilities } = deriveCapabilities(agent, context.serverMap)
    capabilities.forEach((capability) => capabilitySet.add(capability))
  }

  return Array.from(capabilitySet).sort()
}

export type { AgentDirectoryEntry }
