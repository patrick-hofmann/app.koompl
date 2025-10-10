import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export interface BuiltinToolResponse<TData = unknown> {
  success: boolean
  summary?: string
  data?: TData
  error?: string
}

export interface BuiltinToolDefinition<TContext = unknown, TArgs = Record<string, any>> {
  name: string
  description: string
  inputSchema: Tool['inputSchema']
  execute: (options: { context: TContext; args: TArgs }) => Promise<BuiltinToolResponse>
}

export interface BuiltinContextSpec {
  teamIdEnv: string
  userIdEnv: string
  agentIdEnv?: string
}

export interface BuiltinMcpDefinition<TContext = unknown> {
  id: string
  serverName: string
  version?: string
  logPrefix?: string
  context: {
    spec: BuiltinContextSpec
    resolve: (env: NodeJS.ProcessEnv) => TContext
  }
  tools: BuiltinToolDefinition<TContext>[]
}

export interface BuiltinServerOptions {
  connect?: boolean
}

export interface ToolExecutionResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}
