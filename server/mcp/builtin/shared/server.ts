import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { BuiltinMcpDefinition, BuiltinToolDefinition, BuiltinToolResponse } from './types'

function formatToolResponse(response: BuiltinToolResponse): string {
  return JSON.stringify(
    {
      success: response.success,
      summary: response.summary,
      data: response.data,
      error: response.error
    },
    null,
    2
  )
}

function toToolList(tools: BuiltinToolDefinition[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }))
}

function resolveContext<TContext>(definition: BuiltinMcpDefinition<TContext>): TContext {
  const {
    context: { spec, resolve }
  } = definition

  const teamId = process.env[spec.teamIdEnv]
  const userId = process.env[spec.userIdEnv]
  const agentId = spec.agentIdEnv ? process.env[spec.agentIdEnv] : undefined

  if (!teamId || !userId) {
    const missing: string[] = []
    if (!teamId) missing.push(spec.teamIdEnv)
    if (!userId) missing.push(spec.userIdEnv)
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  return resolve({ ...process.env, teamId, userId, agentId })
}

export async function runBuiltinServer<TContext>(
  definition: BuiltinMcpDefinition<TContext>
): Promise<void> {
  const logPrefix = definition.logPrefix ?? `[${definition.id}]`
  console.log(`${logPrefix} Starting built-in MCP server...`)

  const server = new Server(
    {
      name: definition.serverName,
      version: definition.version ?? '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toToolList(definition.tools) }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = definition.tools.find((item) => item.name === request.params.name)
    if (!tool) {
      const message = `Unknown tool: ${request.params.name}`
      console.error(`${logPrefix} ${message}`)
      return {
        content: [
          {
            type: 'text',
            text: formatToolResponse({ success: false, error: message })
          }
        ],
        isError: true
      }
    }

    let context: TContext
    try {
      context = resolveContext(definition)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`${logPrefix} ${message}`)
      return {
        content: [
          {
            type: 'text',
            text: formatToolResponse({ success: false, error: message })
          }
        ],
        isError: true
      }
    }

    try {
      const result = await tool.execute({ context, args: request.params.arguments ?? {} })
      return {
        content: [
          {
            type: 'text',
            text: formatToolResponse(result)
          }
        ],
        isError: !result.success
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`${logPrefix} Tool '${tool.name}' failed: ${message}`)
      return {
        content: [
          {
            type: 'text',
            text: formatToolResponse({ success: false, error: message })
          }
        ],
        isError: true
      }
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
