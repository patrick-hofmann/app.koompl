import { runMCPAgent } from '../../../utils/mcpAgentHelper'
import type { Agent } from '~/types'

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
  const { getIdentity } = await import('../../../utils/identityStorage')
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

  // Apply predefined agent overrides (if this is a predefined agent like Dara)
  const { withPredefinedOverride } = await import('../../../utils/predefinedKoompls')
  const effectiveAgent = withPredefinedOverride(agent)

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
  const baseEmailGuidelines = `
Email Communication Guidelines:
- You have access to reply_to_email and forward_email tools to communicate with users
- These tools require a message-id from the email storage
- When you receive a request via email:
  FIRST: Send a brief acknowledgment reply to the sender - if possible estimate a response time
  Then, completing the action: Send a concise follow-up with key results in reply to the sender
- Always use professional and friendly language
- Be concise and direct
`

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
  const result = await runMCPAgent({
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
