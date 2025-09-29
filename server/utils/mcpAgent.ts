import { MCPAgent, MCPClient } from 'mcp-use'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOpenAI } from '@langchain/openai'
import type { StoredMcpServer } from './mcpStorage'
import type { McpEmailContext } from './mcpClients'

export interface McpAgentConfig {
  llmProvider: 'anthropic' | 'openai'
  model?: string
  maxSteps?: number
  temperature?: number
  maxTokens?: number
}

export interface McpAgentResponse {
  success: boolean
  result?: string
  error?: string
  toolCalls?: Array<{
    tool: string
    input: unknown
    output?: unknown
  }>
}

export class KoomplMcpAgent {
  private agent: MCPAgent
  private client: MCPClient
  private config: McpAgentConfig

  constructor(config: McpAgentConfig) {
    this.config = {
      model: 'claude-3-5-sonnet-20241022',
      maxSteps: 5,
      temperature: 0.4,
      maxTokens: 1000,
      ...config
    }

    // Initialize LLM based on provider
    const llm = this.config.llmProvider === 'anthropic'
      ? new ChatAnthropic({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens
      })
      : new ChatOpenAI({
        model: this.config.model || 'gpt-4o',
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens
      })

    // Initialize MCP client with empty config (will be populated with servers)
    this.client = new MCPClient({ mcpServers: {} })

    // Initialize MCP agent
    this.agent = new MCPAgent({
      llm,
      client: this.client,
      maxSteps: this.config.maxSteps,
      useServerManager: true
    })
  }

  /**
   * Add MCP servers to the agent
   */
  async addServers(servers: StoredMcpServer[]): Promise<void> {
    const serverConfigs: Record<string, unknown> = {}

    for (const server of servers) {
      if (server.provider === 'custom' && server.url) {
        // Custom MCP server via HTTP
        serverConfigs[server.id] = {
          command: 'node',
          args: ['-e', `
            const { spawn } = require('child_process');
            const http = require('http');
            
            // Create a simple HTTP-to-MCP bridge
            const server = http.createServer((req, res) => {
              if (req.method === 'POST' && req.url === '/mcp') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                  try {
                    const data = JSON.parse(body);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      result: 'Custom MCP response',
                      data: data
                    }));
                  } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                  }
                });
              } else {
                res.writeHead(404);
                res.end();
              }
            });
            
            server.listen(0, () => {
              console.log('Custom MCP server running on port', server.address().port);
            });
          `]
        }
      } else {
        // Standard MCP server configurations
        const serverConfig: Record<string, unknown> = {
          command: 'npx',
          args: ['-y', this.getMcpServerPackage(server.provider)]
        }

        // Add environment variables for authentication
        if (server.auth.token) {
          serverConfig.env = { ...serverConfig.env, MCP_TOKEN: server.auth.token }
        }
        if (server.auth.apiKey) {
          serverConfig.env = { ...serverConfig.env, MCP_API_KEY: server.auth.apiKey }
        }
        if (server.auth.clientId) {
          serverConfig.env = { ...serverConfig.env, MCP_CLIENT_ID: server.auth.clientId }
        }
        if (server.auth.clientSecret) {
          serverConfig.env = { ...serverConfig.env, MCP_CLIENT_SECRET: server.auth.clientSecret }
        }

        serverConfigs[server.id] = serverConfig
      }
    }

    // Update client configuration
    this.client = new MCPClient({ mcpServers: serverConfigs })
    this.agent = new MCPAgent({
      llm: this.agent['llm'],
      client: this.client,
      maxSteps: this.config.maxSteps,
      useServerManager: true
    })
  }

  /**
   * Get the appropriate MCP server package for a provider
   */
  private getMcpServerPackage(provider: string): string {
    const packages: Record<string, string> = {
      'google-calendar': '@modelcontextprotocol/server-google-calendar',
      'microsoft-outlook': '@modelcontextprotocol/server-microsoft-outlook',
      'todoist': '@modelcontextprotocol/server-todoist',
      'trello': '@modelcontextprotocol/server-trello',
      'everything': '@modelcontextprotocol/server-everything'
    }
    return packages[provider] || '@modelcontextprotocol/server-everything'
  }

  /**
   * Process an email with MCP context and generate a response
   */
  async processEmail(
    email: McpEmailContext,
    agentPrompt: string,
    servers: StoredMcpServer[]
  ): Promise<McpAgentResponse> {
    try {
      // Add servers to the agent
      await this.addServers(servers)

      // Create a comprehensive prompt that includes email context and MCP capabilities
      const systemPrompt = this.createSystemPrompt(agentPrompt, servers)
      const userPrompt = this.createUserPrompt(email)

      // Run the agent
      const result = await this.agent.run(`${systemPrompt}\n\n${userPrompt}`)

      return {
        success: true,
        result: typeof result === 'string' ? result : String(result)
      }
    } catch (error) {
      console.error('MCP Agent error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Stream email processing for real-time responses
   */
  async* streamEmailProcessing(
    email: McpEmailContext,
    agentPrompt: string,
    servers: StoredMcpServer[]
  ): AsyncGenerator<McpAgentResponse, void, unknown> {
    try {
      // Add servers to the agent
      await this.addServers(servers)

      const systemPrompt = this.createSystemPrompt(agentPrompt, servers)
      const userPrompt = this.createUserPrompt(email)

      // Stream the agent response
      const stream = this.agent.stream(`${systemPrompt}\n\n${userPrompt}`)
      let fullResponse = ''
      for await (const chunk of stream) {
        if (typeof chunk === 'string') {
          fullResponse += chunk
          yield {
            success: true,
            result: chunk
          }
        }
      }

      // Final response
      yield {
        success: true,
        result: fullResponse
      }
    } catch (error) {
      console.error('MCP Agent streaming error:', error)
      yield {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Create system prompt for the agent
   */
  private createSystemPrompt(agentPrompt: string, servers: StoredMcpServer[]): string {
    const serverDescriptions = servers.map((server) => {
      const capabilities = this.getServerCapabilities(server)
      return `- ${server.name} (${server.provider}): ${server.description || 'No description'} - Capabilities: ${capabilities.join(', ')}`
    }).join('\n')

    return `You are an AI agent for Koompl, an intelligent email assistant platform. 

Your role: ${agentPrompt}

Available MCP Servers:
${serverDescriptions}

Instructions:
1. Use the available MCP servers to gather relevant context for the email
2. Provide helpful, accurate, and contextual responses
3. Be concise but comprehensive in your responses
4. Always consider the email context and available data when responding

When using MCP servers:
- Query relevant data based on the email content
- Use multiple servers if they provide complementary information
- Present the information in a clear, organized manner
- Cite sources when appropriate`
  }

  /**
   * Create user prompt from email context
   */
  private createUserPrompt(email: McpEmailContext): string {
    return `Please respond to this email:

From: ${email.from || 'Unknown sender'}
Subject: ${email.subject}
Received: ${email.receivedAt}

Email content:
${email.text}

Please provide a helpful response using the available MCP servers to gather relevant context.`
  }

  /**
   * Get server capabilities description
   */
  private getServerCapabilities(server: StoredMcpServer): string[] {
    const capabilities: Record<string, string[]> = {
      'google-calendar': ['calendar events', 'scheduling', 'availability'],
      'microsoft-outlook': ['outlook calendar', 'email integration', 'microsoft 365'],
      'todoist': ['task management', 'todo lists', 'project tracking'],
      'trello': ['project boards', 'card management', 'team collaboration'],
      'nuxt-ui': ['documentation', 'component examples', 'guidance'],
      'custom': ['custom integrations', 'api access', 'specialized data']
    }
    return capabilities[server.provider] || ['general data access']
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.client.closeAllSessions()
    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }
}

/**
 * Create a general-purpose MCP agent
 */
export function createGeneralAgent(config: Partial<McpAgentConfig> = {}): KoomplMcpAgent {
  return new KoomplMcpAgent({
    llmProvider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    maxSteps: 5,
    temperature: 0.4,
    maxTokens: 1000,
    ...config
  })
}

/**
 * Create a specialized agent with custom configuration
 */
export function createSpecializedAgent(config: Partial<McpAgentConfig> = {}): KoomplMcpAgent {
  return new KoomplMcpAgent({
    llmProvider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    maxSteps: 8,
    temperature: 0.3,
    maxTokens: 1500,
    ...config
  })
}
