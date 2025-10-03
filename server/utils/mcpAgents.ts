import type { Agent } from '~/types'
import type { StoredMcpServer } from '../types/mcp-storage'
import { getIdentity } from './identityStorage'

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
}

interface DirectoryContext {
  agents: Agent[]
  servers: StoredMcpServer[]
  serverMap: Map<string, StoredMcpServer>
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
  serverMap: Map<string, StoredMcpServer>
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
      case 'google-calendar':
      case 'microsoft-outlook':
        capabilitySet.add('calendar_management')
        serverSummaries.push('Kalenderpflege')
        break
      case 'builtin-kanban':
      case 'trello':
        capabilitySet.add('kanban_management')
        serverSummaries.push('Kanban-Workflows')
        break
      case 'todoist':
        capabilitySet.add('task_management')
        serverSummaries.push('Aufgabenverwaltung')
        break
      case 'nuxt-ui':
        capabilitySet.add('documentation_lookup')
        serverSummaries.push('Dokumentationssuche')
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
  const mcpStorage = useStorage('mcp')

  const [agents, servers, identity] = await Promise.all([
    agentsStorage.getItem<Agent[]>('agents.json'),
    mcpStorage.getItem<StoredMcpServer[]>('servers.json'),
    getIdentity()
  ])

  const filteredAgents = (agents || [])
    .filter((agent) => !teamId || agent.teamId === teamId)
    .sort((a, b) => a.name.localeCompare(b.name))
  const serverList = servers || []
  const domainById = new Map<string, string | undefined>()
  for (const team of identity.teams) {
    domainById.set(team.id, team.domain)
  }

  return {
    agents: filteredAgents,
    servers: serverList,
    serverMap: new Map(serverList.map((server) => [server.id, server])),
    teamDomainById: domainById
  }
}

function buildDirectoryEntry(agent: Agent, context: DirectoryContext): AgentDirectoryEntry {
  const teamDomain = agent.teamId ? context.teamDomainById.get(agent.teamId) : undefined
  const fullEmail = teamDomain ? `${agent.email}@${teamDomain}` : `${agent.email}@agents.local`

  const { capabilities, summary } = deriveCapabilities(agent, context.serverMap)

  const allowedAgents = agent.multiRoundConfig?.allowedAgentEmails
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
    .filter((server): server is StoredMcpServer => Boolean(server))
    .map((server) => ({
      id: server.id,
      name: server.name,
      provider: server.provider,
      category: server.category
    }))

  const description = (agent.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 320)

  return {
    id: agent.id,
    name: agent.name,
    username: agent.email,
    fullEmail,
    role: agent.role,
    teamId: agent.teamId,
    teamDomain,
    capabilities,
    summary,
    description: description || undefined,
    canDelegate: Boolean(agent.multiRoundConfig?.canCommunicateWithAgents),
    allowedAgents: allowedAgents && allowedAgents.length > 0 ? allowedAgents : undefined,
    mcpServers: visibleServers,
    isPredefined: agent.isPredefined,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt
  }
}

export async function listAgentDirectory(teamId?: string): Promise<AgentDirectoryEntry[]> {
  const context = await loadDirectoryContext(teamId)
  return context.agents.map((agent) => buildDirectoryEntry(agent, context))
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

  return context.agents
    .filter((agent) => {
      const { capabilities } = deriveCapabilities(agent, context.serverMap)
      return capabilities.some((entry) => entry.includes(target))
    })
    .map((agent) => buildDirectoryEntry(agent, context))
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
