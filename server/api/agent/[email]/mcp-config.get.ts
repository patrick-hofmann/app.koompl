import type { Agent } from '~/types'

interface McpConfigResponse {
  mcpConfigs: Record<string, { url: string }>
  serverIds: string[]
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
  const { getIdentity } = await import('../../../utils/identityStorage')
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

  const mcpServerIds = agent.mcpServerIds || []
  mcpServerIds.push('builtin-email') // all agents have email support

  // Map builtin/predefined server IDs to their API endpoints (without localhost)
  const builtinServerMap: Record<string, string> = {
    'builtin-kanban': '/api/mcp/builtin-kanban',
    'builtin-datasafe': '/api/mcp/builtin-datasafe',
    'builtin-agents': '/api/mcp/builtin-agents',
    'builtin-calendar': '/api/mcp/builtin-calendar',
    'builtin-email': '/api/mcp/builtin-email'
  }

  // Build MCP configs based on agent's mcpServerIds
  const mcpConfigs: Record<string, { url: string }> = {}

  for (const serverId of mcpServerIds) {
    // Check if it's a builtin server
    if (builtinServerMap[serverId]) {
      mcpConfigs[serverId] = { url: builtinServerMap[serverId] }
      continue
    }

    // Load custom MCP server from storage (e.g., "nuxt-ui-documentation")
    /* try {
      const { findMcpServer } = await import('../../../mcp/storage')
      const customServer = await findMcpServer(serverId)

      if (customServer && customServer.url) {
        // Remove localhost from URL if present for external access
        let serverUrl = customServer.url
        if (serverUrl.startsWith('http://localhost:3000')) {
          serverUrl = serverUrl.replace('http://localhost:3000', '')
        } else if (serverUrl.startsWith('https://localhost:3000')) {
          serverUrl = serverUrl.replace('https://localhost:3000', '')
        }

        mcpConfigs[serverId] = { url: serverUrl }

        console.log('[MCP Config] Loaded custom server:', {
          serverId,
          name: customServer.name,
          provider: customServer.provider,
          url: serverUrl
        })
      } else {
        console.warn('[MCP Config] Custom MCP server not found:', serverId)
      }
    } catch (error) {
      console.error('[MCP Config] Error loading custom server:', serverId, error)
    }
    */
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
