export interface PredefinedAgent {
  id: string
  name: string
  email: string
  role: string
  description: string
  short_description: string
  long_description: string
  system_prompt: string
  icon: string
  color: string
  provider: string
  model: string
  temperature: number
  max_tokens: number
  max_steps: number
  mcp_servers: string[]
}

export interface MCPServerMetadata {
  id: string
  name: string
  provider: string
  category: string
  description: string
}

export interface AgentConfig {
  agents: PredefinedAgent[]
  general: {
    provider: string
    model: string
    temperature: number
    max_tokens: number
    max_steps: number
    mcp_servers: readonly string[]
    system_prompt: string
  }
  mcpServers: Record<string, string>
  mcpServerMetadata: readonly MCPServerMetadata[]
  standardEmailGuidelines: string
}

export interface AgentConfigHierarchy {
  predefined: {
    agents: Record<string, PredefinedAgent>
    general: AgentConfig['general']
  }
  mcp: {
    servers: Record<string, string>
    metadata: Record<string, MCPServerMetadata>
  }
  behavior: {
    emailGuidelines: string
  }
}
