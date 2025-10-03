#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js'

import { getAgentsDirectoryTools, executeAgentsDirectoryTool } from './builtinMcpTools'

const server = new Server(
  {
    name: 'builtin-agents-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
)

const toolDefinitions = getAgentsDirectoryTools()

const resolveTeamId = (provided?: unknown): string | undefined => {
  if (typeof provided === 'string' && provided.trim().length > 0) {
    return provided.trim()
  }
  const envTeam = process.env.AGENTS_TEAM_ID
  return envTeam && envTeam.trim().length > 0 ? envTeam.trim() : undefined
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  })) as Tool[]
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params
  const teamId = resolveTeamId((args as Record<string, unknown>).teamId)

  try {
    const result = await executeAgentsDirectoryTool({ teamId }, name, args as Record<string, any>)
    return result
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            },
            null,
            2
          )
        }
      ]
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.log('[BuiltinAgentsMCP] Server ready')
}

main().catch((error) => {
  console.error('[BuiltinAgentsMCP] Failed to start server', error)
  process.exit(1)
})
