import type { Agent } from '~/types'

interface McpConfigResponse {
  mcpConfigs: Record<string, { url: string }>
  serverIds: string[]
}

// Only builtin MCP servers are supported
const BUILTIN_SERVER_MAP: Record<string, string> = {
  'builtin-kanban': '/api/mcp/builtin-kanban',
  'builtin-datasafe': '/api/mcp/builtin-datasafe',
  'builtin-agents': '/api/mcp/builtin-agents',
  'builtin-calendar': '/api/mcp/builtin-calendar',
  'builtin-email': '/api/mcp/builtin-email'
}

export default defineEventHandler(async (event): Promise<McpConfigResponse> => {
  const agentEmail = getRouterParam(event, 'email')

  if (!agentEmail) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing agent email parameter'
    })
  }

  // Extract domain and username from agent email
  const emailParts = agentEmail.split('@')
  if (emailParts.length !== 2) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid email format. Expected: username@domain.com'
    })
  }

  const recipientUsername = emailParts[0].toLowerCase()
  const recipientDomain = emailParts[1].toLowerCase()

  // Look up team by domain
  const { getIdentity } = await import('../../../features/team/storage')
  const identity = await getIdentity()
  const team = identity.teams.find((t) => t.domain?.toLowerCase() === recipientDomain)

  if (!team) {
    throw createError({
      statusCode: 404,
      statusMessage: `No team found for domain: ${recipientDomain}`
    })
  }

  // Load agents and filter by team
  const agentsStorage = useStorage('agents')
  const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
  const teamAgents = agents.filter((a) => a.teamId === team.id)

  // Find agent by username within the team
  const agent = teamAgents.find((a) => String(a?.email || '').toLowerCase() === recipientUsername)

  if (!agent) {
    throw createError({
      statusCode: 404,
      statusMessage: `No agent found with email: ${agentEmail}`
    })
  }

  // Get agent's MCP server IDs (only builtin servers supported)
  const mcpServerIds = agent.mcpServerIds || []
  if (!mcpServerIds.includes('builtin-email')) {
    mcpServerIds.push('builtin-email') // all agents have email support
  }

  // Build MCP configs - only builtin servers
  const mcpConfigs: Record<string, { url: string }> = {}

  for (const serverId of mcpServerIds) {
    if (BUILTIN_SERVER_MAP[serverId]) {
      mcpConfigs[serverId] = { url: BUILTIN_SERVER_MAP[serverId] }
    }
  }

  console.log('[MCP Config] Generated config for agent:', {
    agentId: agent.id,
    agentName: agent.name,
    agentEmail: `${agent.email}@${recipientDomain}`,
    mcpServerIds,
    configuredServers: Object.keys(mcpConfigs)
  })

  return {
    mcpConfigs,
    serverIds: mcpServerIds
  }
})
