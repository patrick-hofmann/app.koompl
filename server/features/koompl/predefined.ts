import type { Agent } from '~/types'
import { createAgentStorage } from '../../utils/shared'

export interface PredefinedAgent {
  id: string
  role: string
  description: string
  mcp_servers: string[]
  system_prompt: string
  model?: string
  temperature?: number
  max_tokens?: number
  max_steps?: number
}

export interface PredefinedKoomplTemplate {
  id: string
  role: string
  description: string
  mcpServerIds: string[]
  prompt: string
}

export interface PredefinedKoomplStatus {
  template: PredefinedKoomplTemplate
  isEnabled: boolean
  agentId?: string
  teamId?: string
}

export interface PredefinedKoomplContext {
  teamId: string
  userId?: string
}

/**
 * List all predefined koompl templates with their enabled status for a team
 */
export async function listPredefinedKoompls(
  context: PredefinedKoomplContext
): Promise<PredefinedKoomplStatus[]> {
  const docs = await loadPredefinedAgents()
  const templates = docs.map((doc) => ({
    id: doc.id,
    role: doc.role,
    description: doc.description,
    mcpServerIds: doc.mcp_servers,
    prompt: doc.system_prompt
  }))
  const storage = createAgentStorage()
  const allAgents = await storage.read()

  // Find which templates are enabled for this team
  const teamAgents = allAgents.filter(
    (agent) => agent.teamId === context.teamId && agent.isPredefined
  )

  return templates.map((template) => {
    const enabledAgent = teamAgents.find((agent) => agent.id === template.id)
    return {
      template,
      isEnabled: !!enabledAgent,
      agentId: enabledAgent?.id,
      teamId: enabledAgent?.teamId
    }
  })
}

/**
 * Get a specific predefined koompl template with status
 */
export async function getPredefinedKoompl(
  context: PredefinedKoomplContext,
  templateId: string
): Promise<PredefinedKoomplStatus | null> {
  const docs = await loadPredefinedAgents()
  const templates = docs.map((doc) => ({
    id: doc.id,
    role: doc.role,
    description: doc.description,
    mcpServerIds: doc.mcp_servers,
    prompt: doc.system_prompt
  }))
  const template = templates.find((t) => t.id === templateId)

  if (!template) {
    return null
  }

  const storage = createAgentStorage()
  const allAgents = await storage.read()
  const enabledAgent = allAgents.find(
    (agent) => agent.teamId === context.teamId && agent.id === templateId && agent.isPredefined
  )

  return {
    template,
    isEnabled: !!enabledAgent,
    agentId: enabledAgent?.id,
    teamId: enabledAgent?.teamId
  }
}

/**
 * Enable a predefined koompl template for a team
 */
export async function enablePredefinedKoompl(
  context: PredefinedKoomplContext,
  templateId: string,
  config?: {
    name?: string
    email?: string
  }
): Promise<Agent> {
  const docs = await loadPredefinedAgents()
  const templates = docs.map((doc) => ({
    id: doc.id,
    role: doc.role,
    description: doc.description,
    mcpServerIds: doc.mcp_servers,
    prompt: doc.system_prompt
  }))
  const template = templates.find((t) => t.id === templateId)

  if (!template) {
    throw new Error(`Predefined template not found: ${templateId}`)
  }

  const storage = createAgentStorage()
  const allAgents = await storage.read()

  // Check if already enabled
  const existing = allAgents.find(
    (agent) => agent.teamId === context.teamId && agent.id === templateId && agent.isPredefined
  )

  if (existing) {
    return existing
  }

  // Generate email from template ID if not provided
  const email = config?.email || templateId.toLowerCase()
  const name = config?.name || template.role

  // Create new agent from template
  const newAgent: Agent = {
    id: templateId,
    name,
    email,
    role: template.role,
    prompt: template.prompt,
    mcpServerIds: template.mcpServerIds,
    isPredefined: true,
    teamId: context.teamId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  allAgents.push(newAgent)
  await storage.write(allAgents)

  return newAgent
}

/**
 * Disable a predefined koompl template for a team
 */
export async function disablePredefinedKoompl(
  context: PredefinedKoomplContext,
  templateId: string
): Promise<boolean> {
  const storage = createAgentStorage()
  const allAgents = await storage.read()

  const index = allAgents.findIndex(
    (agent) => agent.teamId === context.teamId && agent.id === templateId && agent.isPredefined
  )

  if (index === -1) {
    return false // Not enabled
  }

  allAgents.splice(index, 1)
  await storage.write(allAgents)

  return true
}

/**
 * Update predefined koompl configuration (email, name only - prompt/role are locked)
 */
export async function updatePredefinedKoompl(
  context: PredefinedKoomplContext,
  templateId: string,
  updates: {
    name?: string
    email?: string
  }
): Promise<Agent | null> {
  const storage = createAgentStorage()
  const allAgents = await storage.read()

  const agent = allAgents.find(
    (agent) => agent.teamId === context.teamId && agent.id === templateId && agent.isPredefined
  )

  if (!agent) {
    return null
  }

  // Only allow updating name and email - prompt/role are locked for predefined
  if (updates.name !== undefined) {
    agent.name = updates.name
  }
  if (updates.email !== undefined) {
    agent.email = updates.email
  }

  agent.updatedAt = new Date().toISOString()

  await storage.write(allAgents)
  return agent
}

/**
 * Load all predefined agents from content collection
 * This abstracts the queryCollection implementation detail
 */
export async function loadPredefinedAgents(event?: any): Promise<PredefinedAgent[]> {
  console.log('[KoomplFeature] About to call queryCollection("agents").all()')
  try {
    // Check if queryCollection is available
    console.log('[KoomplFeature] queryCollection available:', typeof queryCollection)
    if (typeof queryCollection === 'undefined') {
      console.error('[KoomplFeature] queryCollection is undefined - this might be the issue')
      return []
    }

    // For server-side usage, pass the event object as the first argument
    // @ts-expect-error injected by @nuxt/content at runtime
    const docs = event
      ? await queryCollection(event, 'agents').all()
      : await queryCollection('agents').all()
    console.log(
      '[KoomplFeature] queryCollection("agents").all() completed successfully, found',
      docs?.length || 0,
      'agents'
    )
    return (docs || []) as PredefinedAgent[]
  } catch (error) {
    console.error('[KoomplFeature] queryCollection("agents").all() failed:', error)
    console.error('[KoomplFeature] Error stack:', error.stack)
    console.error('[KoomplFeature] Falling back to empty array due to cloudflare error')
    // Fallback to empty array to prevent the error from breaking the application
    return []
  }
}

/**
 * Load a specific predefined agent by ID from content collection
 * This abstracts the queryCollection implementation detail
 */
export async function loadPredefinedAgentById(
  agentId: string,
  event?: any
): Promise<PredefinedAgent | null> {
  try {
    console.log(`[KoomplFeature] Loading agent by ID: ${agentId}`)
    console.log(`[KoomplFeature] About to call loadPredefinedAgents() from loadPredefinedAgentById`)
    // Load all agents and find by ID (since .where().find() doesn't work in server context)
    const docs = await loadPredefinedAgents(event)
    console.log(`[KoomplFeature] Loaded ${docs.length} predefined agents`)

    // Log all available agent IDs for debugging
    const agentIds = docs.map((doc) => {
      // Extract agent ID from file path like "agents/agents/dara-datasafe.md"
      return doc.id.split('/').pop()?.replace('.md', '') || doc.id
    })
    console.log(`[KoomplFeature] Available agent IDs:`, agentIds)

    // Find by extracting agent ID from file path
    const found = docs.find((doc) => {
      const extractedId = doc.id.split('/').pop()?.replace('.md', '') || doc.id
      return extractedId === agentId
    })

    console.log(`[KoomplFeature] Found agent:`, found ? 'YES' : 'NO')
    if (found) {
      console.log(`[KoomplFeature] Agent details:`, {
        id: found.id,
        name: found.name,
        description: found.description?.substring(0, 100) + '...',
        systemPrompt: found.system_prompt?.substring(0, 100) + '...',
        mcpServers: found.mcp_servers,
        hasMcpServers: !!found.mcp_servers,
        mcpServersLength: found.mcp_servers?.length || 0
      })
    } else {
      console.log(`[KoomplFeature] Agent with ID '${agentId}' not found in loaded agents`)
    }
    return found || null
  } catch (e) {
    console.error('[KoomplFeature] Failed to load agent frontmatter from content:', e)
    console.error('[KoomplFeature] Error details:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    })
    return null
  }
}
