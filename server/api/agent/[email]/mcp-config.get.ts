import agentConfig from '~~/agents.config'

interface McpConfigResponse {
  mcpConfigs: Record<string, { url: string }>
  serverIds: string[]
}

// Only builtin MCP servers are supported
const BUILTIN_SERVER_MAP: Record<string, string> = agentConfig.mcp.servers

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

  // Use feature function to find agent by email
  const { getAgentByEmail } = await import('../../../features/agent')
  const agent = await getAgentByEmail(recipientUsername, team.id)

  if (!agent) {
    throw createError({
      statusCode: 404,
      statusMessage: `No agent found with email: ${agentEmail}`
    })
  }

  // Load predefined agent from content files to get mcp_servers
  let mcpServerIds: string[] = []

  if (agent.isPredefined) {
    // Load from content files for predefined agents
    console.log('[MCP Config] About to call loadPredefinedAgentById from mcp-config.get.ts')
    const { loadPredefinedAgentById } = await import('../../../features/koompl/predefined')
    const predefinedAgent = await loadPredefinedAgentById(agent.id, event)

    console.log('[MCP Config] Agent loading details:', {
      agentId: agent.id,
      isPredefined: agent.isPredefined,
      predefinedAgentFound: !!predefinedAgent,
      predefinedAgentData: predefinedAgent
        ? {
            id: predefinedAgent.id,
            name: predefinedAgent.name,
            description: predefinedAgent.description,
            systemPrompt: predefinedAgent.system_prompt?.substring(0, 100) + '...',
            mcpServers: predefinedAgent.mcp_servers
          }
        : null,
      databaseAgentData: {
        id: agent.id,
        name: agent.name,
        mcpServerIds: agent.mcpServerIds
      }
    })

    if (predefinedAgent?.mcp_servers) {
      mcpServerIds = [...predefinedAgent.mcp_servers]
      console.log('[MCP Config] Using mcp_servers from content file:', mcpServerIds)
    } else {
      // Fallback to database if content file doesn't have mcp_servers
      mcpServerIds = agent.mcpServerIds || []
      console.log('[MCP Config] Fallback to database mcp_servers:', mcpServerIds)
    }
  } else {
    // Fallback to database for custom agents
    mcpServerIds = agent.mcpServerIds || []
    console.log('[MCP Config] Using database mcp_servers for custom agent:', mcpServerIds)
  }

  // Ensure all agents have email support
  if (!mcpServerIds.includes('builtin-email')) {
    mcpServerIds.push('builtin-email')
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
