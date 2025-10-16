import type { Agent } from '~/types'
import { createAgentStorage } from '../../utils/shared'

export interface PredefinedKoomplTemplate {
  id: string
  role: string
  description: string
  mcpServerIds: string[]
  multiRoundConfig: Agent['multiRoundConfig']
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
  const docs = await queryCollection('agents').all()
  const templates = docs.map((doc: any) => ({
    id: doc.id,
    role: doc.role,
    description: doc.description,
    mcpServerIds: doc.mcp_servers,
    multiRoundConfig: doc.multiRoundConfig || {},
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
  const docs = await queryCollection('agents').all()
  const templates = docs.map((doc: any) => ({
    id: doc.id,
    role: doc.role,
    description: doc.description,
    mcpServerIds: doc.mcp_servers,
    multiRoundConfig: doc.multiRoundConfig || {},
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
  const docs = await queryCollection('agents').all()
  const templates = docs.map((doc: any) => ({
    id: doc.id,
    role: doc.role,
    description: doc.description,
    mcpServerIds: doc.mcp_servers,
    multiRoundConfig: doc.multiRoundConfig || {},
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
    multiRoundConfig: template.multiRoundConfig,
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
