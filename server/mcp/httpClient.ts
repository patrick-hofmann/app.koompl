/**
 * HTTP MCP Client
 * Allows agents to connect to HTTP-based MCP servers (like our builtin-kanban endpoint)
 */

export interface HttpMcpTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

export interface HttpMcpCallResult {
  content: Array<{
    type: string
    text: string
  }>
  isError?: boolean
}

export class HttpMcpClient {
  private baseUrl: string
  private headers: Record<string, string>
  private cachedTools: HttpMcpTool[] | null = null

  constructor(baseUrl: string, headers: Record<string, string> = {}) {
    this.baseUrl = baseUrl
    this.headers = headers
  }

  /**
   * List available tools from the HTTP MCP server
   */
  async listTools(): Promise<HttpMcpTool[]> {
    if (this.cachedTools) {
      return this.cachedTools
    }

    const response = await $fetch<any>(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    })

    this.cachedTools = response.result?.tools || []
    return this.cachedTools
  }

  /**
   * Call a tool on the HTTP MCP server
   */
  async callTool(name: string, args: Record<string, any>): Promise<HttpMcpCallResult> {
    const response = await $fetch<any>(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name,
          arguments: args
        }
      })
    })

    if (response.error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: response.error.message || 'Tool call failed'
            })
          }
        ],
        isError: true
      }
    }

    return response.result || { content: [] }
  }

  /**
   * Clear cached tools
   */
  clearCache(): void {
    this.cachedTools = null
  }
}

/**
 * Create an HTTP MCP client for builtin Kanban
 */
export function createBuiltinKanbanHttpClient(
  teamId: string,
  userId: string,
  baseUrl: string = 'http://localhost:3000/api/mcp/builtin-kanban'
): HttpMcpClient {
  // For now, we'll use development mode which allows teamId/userId in tool arguments
  // In production, this would need proper session/auth headers
  return new HttpMcpClient(baseUrl, {
    'x-team-id': teamId,
    'x-user-id': userId
  })
}
