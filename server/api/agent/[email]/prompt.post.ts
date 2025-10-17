import { runMCPAgentV2 } from '../../../utils/mcpAgentHelperV2'
import agentConfig from '~~/agents.config'
// import type { Agent } from '~/types' // Unused for now

interface AgentPromptRequest {
  userPrompt: string
  systemPrompt?: string
  files?: Array<{
    base64: string
    mimeType: string
    type?: 'image' | 'file'
  }>
  mcpServers?: string[]
  userId?: string
}

export default defineEventHandler(async (event) => {
  const agentEmail = getRouterParam(event, 'email')

  if (!agentEmail) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing agent email parameter'
    })
  }

  // Parse the request body
  const body = await readBody<AgentPromptRequest>(event)

  if (!body || !body.userPrompt) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required field: userPrompt'
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

  console.log('[AgentPrompt] Looking up agent:', {
    email: agentEmail,
    username: recipientUsername,
    domain: recipientDomain
  })

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

  console.log('[AgentPrompt] Found team:', {
    teamId: team.id,
    teamName: team.name,
    domain: recipientDomain
  })

  // Use feature function to find agent by email
  const { getAgentByEmail } = await import('../../../features/agent')
  const agent = await getAgentByEmail(recipientUsername, team.id)

  if (!agent) {
    throw createError({
      statusCode: 404,
      statusMessage: `No agent found with email: ${agentEmail}`
    })
  }

  // Use agent as-is (predefined agents are stored with their template values)
  const effectiveAgent = agent

  console.log('[AgentPrompt] Found agent:', {
    agentId: effectiveAgent.id,
    agentName: effectiveAgent.name,
    agentEmail: `${effectiveAgent.email}@${recipientDomain}`,
    teamId: effectiveAgent.teamId,
    mcpServerIds: effectiveAgent.mcpServerIds,
    isPredefined: effectiveAgent.isPredefined,
    hasPrompt: !!effectiveAgent.prompt,
    promptPreview: effectiveAgent.prompt
      ? effectiveAgent.prompt.substring(0, 100) + '...'
      : 'NO PROMPT SET'
  })

  // Get MCP configuration from the dedicated endpoint
  let mcpConfigs: Record<string, { url: string }> = {}

  try {
    // Use event.$fetch to preserve session context
    const configResponse = await event.$fetch(`/api/agent/${agentEmail}/mcp-config`, {
      method: 'GET'
    })

    mcpConfigs = configResponse.mcpConfigs

    console.log('[AgentPrompt] Loaded MCP config:', {
      serverIds: configResponse.serverIds,
      configuredServers: Object.keys(mcpConfigs)
    })
  } catch (error) {
    console.error('[AgentPrompt] Failed to load MCP config:', error)
    // Fall back to empty config if endpoint fails
    mcpConfigs = {}
  }

  // Convert files to attachments format
  const attachments = body.files?.map((file) => ({
    type: (file.type || 'file') as 'image' | 'file',
    base64: file.base64,
    mimeType: file.mimeType
  }))

  // Build system prompt with email communication guidelines
  const baseEmailGuidelines = agentConfig.behavior.emailGuidelines

  // Use the agent's instructions as system prompt if not provided
  const agentInstructions =
    body.systemPrompt || effectiveAgent.prompt || 'You are a helpful AI assistant.'

  console.log('[AgentPrompt] System prompt source:', {
    usingBodySystemPrompt: !!body.systemPrompt,
    usingAgentPrompt: !body.systemPrompt && !!effectiveAgent.prompt,
    usingDefault: !body.systemPrompt && !effectiveAgent.prompt,
    agentInstructionsPreview: agentInstructions.substring(0, 100) + '...'
  })

  const systemPrompt = `${agentInstructions}

${baseEmailGuidelines}`

  const userPrompt = body.userPrompt || 'This is a test prompt. Just respond with "Hello, world!"'

  console.log('[AgentPrompt] Executing agent prompt:', {
    teamId: team.id,
    userId: body.userId,
    hasAttachments: !!attachments && attachments.length > 0,
    attachmentCount: attachments?.length || 0,
    userPrompt,
    systemPrompt
  })

  // Execute the agent
  const result = await runMCPAgentV2({
    mcpConfigs,
    teamId: team.id,
    userId: body.userId,
    systemPrompt,
    userPrompt,
    attachments,
    event
  })

  console.log('[AgentPrompt] Result:', result)

  return {
    success: true,
    systemPrompt,
    userPrompt,
    result
  }
})
