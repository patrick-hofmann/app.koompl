/**
 * Built-in MCP Tools Executor
 *
 * Provides direct tool execution for builtin MCP servers without HTTP overhead.
 * This is production-ready and works on edge servers.
 */

import { kanbanDefinition, type KanbanMcpContext } from '../builtin/kanban'
import { calendarDefinition } from '../builtin/calendar'
import { datasafeDefinition, type DatasafeMcpContext } from '../builtin/datasafe'
import type { BuiltinMcpDefinition, BuiltinToolResponse } from '../builtin/shared'
import {
  listAgentDirectory,
  getAgentDirectoryEntry,
  findAgentsByCapability,
  listDirectoryCapabilities
} from '../agents'

export interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, any>
    required?: string[]
    additionalProperties?: boolean
  }
}

export interface McpToolResult {
  content: Array<{
    type: string
    text: string
  }>
  isError?: boolean
}

function toMcpTool(tool: {
  name: string
  description: string
  inputSchema?: Record<string, any>
}): McpTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema:
      tool.inputSchema ||
      ({ type: 'object', properties: {}, additionalProperties: false } as McpTool['inputSchema'])
  }
}

function formatBuiltinResponse(response: BuiltinToolResponse): McpToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
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
    ],
    isError: !response.success
  }
}

async function executeUsingDefinition<TContext>(
  definition: BuiltinMcpDefinition<TContext>,
  context: TContext,
  toolName: string,
  args: Record<string, any>
): Promise<McpToolResult> {
  const tool = definition.tools.find((item) => item.name === toolName)
  if (!tool) {
    return formatBuiltinResponse({ success: false, error: `Unknown tool: ${toolName}` })
  }

  try {
    const response = await tool.execute({ context, args })
    return formatBuiltinResponse(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return formatBuiltinResponse({ success: false, error: message })
  }
}

/**
 * Get all available Kanban tools
 */
export function getKanbanTools(): McpTool[] {
  return kanbanDefinition.tools.map(toMcpTool)
}

/**
 * Get all available Calendar tools
 */
export function getCalendarTools(): McpTool[] {
  return calendarDefinition.tools.map(toMcpTool)
}

/**
 * Execute a Kanban tool directly (no HTTP)
 */
export async function executeKanbanTool(
  context: KanbanMcpContext,
  toolName: string,
  args: Record<string, any>
): Promise<McpToolResult> {
  return executeUsingDefinition(kanbanDefinition, context, toolName, args)
}

export function getAgentsDirectoryTools(): McpTool[] {
  return [
    {
      name: 'list_agents',
      description:
        'List active agents with their roles, capabilities, and delegation preferences. Optional team filter.',
      inputSchema: {
        type: 'object',
        properties: {
          teamId: { type: 'string', description: 'Optional team identifier' }
        },
        additionalProperties: false
      }
    },
    {
      name: 'get_agent',
      description: 'Get detailed information about a specific agent by id, username, or email.',
      inputSchema: {
        type: 'object',
        properties: {
          agentIdOrEmail: {
            type: 'string',
            description: 'Agent id, username, or email address'
          },
          teamId: { type: 'string', description: 'Optional team identifier' }
        },
        required: ['agentIdOrEmail'],
        additionalProperties: false
      }
    },
    {
      name: 'find_agents_by_capability',
      description:
        'Find agents that match a capability keyword (e.g. "calendar", "kanban", "delegation").',
      inputSchema: {
        type: 'object',
        properties: {
          capability: { type: 'string', description: 'Capability keyword (partial match allowed)' },
          teamId: { type: 'string', description: 'Optional team identifier' }
        },
        required: ['capability'],
        additionalProperties: false
      }
    },
    {
      name: 'list_capabilities',
      description: 'List available capability keys that agents in this workspace expose.',
      inputSchema: {
        type: 'object',
        properties: {
          teamId: { type: 'string', description: 'Optional team identifier' }
        },
        additionalProperties: false
      }
    }
  ]
}

export async function executeAgentsDirectoryTool(
  context: { teamId?: string },
  functionName: string,
  args: Record<string, any> = {}
): Promise<McpToolResult> {
  const effectiveTeamId =
    typeof args.teamId === 'string' && args.teamId.trim().length > 0
      ? args.teamId.trim()
      : context.teamId

  const buildResult = (payload: unknown): McpToolResult => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }
    ]
  })

  try {
    switch (functionName) {
      case 'list_agents': {
        const agents = await listAgentDirectory(effectiveTeamId)
        return buildResult({
          success: true,
          total: agents.length,
          data: agents,
          summary: agents.length
            ? `Found ${agents.length} agent${agents.length === 1 ? '' : 's'}`
            : 'No agents found'
        })
      }

      case 'get_agent': {
        const identifier = String(args.agentIdOrEmail || '').trim()
        if (!identifier) {
          throw new Error('agentIdOrEmail is required')
        }
        const agent = await getAgentDirectoryEntry(identifier, effectiveTeamId)
        return buildResult({
          success: !!agent,
          data: agent,
          summary: agent ? `Resolved agent ${agent.name} (${agent.role})` : 'Agent not found'
        })
      }

      case 'find_agents_by_capability': {
        const capability = String(args.capability || '').trim()
        if (!capability) {
          throw new Error('capability is required')
        }
        const agents = await findAgentsByCapability(capability, effectiveTeamId)
        return buildResult({
          success: true,
          total: agents.length,
          data: agents,
          summary: agents.length
            ? `Found ${agents.length} agent${agents.length === 1 ? '' : 's'} for capability "${capability}"`
            : `No agents cover capability "${capability}"`
        })
      }

      case 'list_capabilities': {
        const capabilities = await listDirectoryCapabilities(effectiveTeamId)
        return buildResult({
          success: true,
          total: capabilities.length,
          data: capabilities,
          summary: capabilities.length
            ? `Available capabilities: ${capabilities.join(', ')}`
            : 'No capabilities discovered'
        })
      }

      default:
        throw new Error(`Unknown agents directory tool: ${functionName}`)
    }
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
}

/**
 * Get all available Datasafe tools
 */
export function getDatasafeTools(): McpTool[] {
  return datasafeDefinition.tools.map(toMcpTool)
}

/**
 * Execute a Datasafe tool directly (no HTTP)
 */
export async function executeDatasafeTool(
  context: DatasafeMcpContext,
  toolName: string,
  args: Record<string, any>
): Promise<McpToolResult> {
  return executeUsingDefinition(datasafeDefinition, context, toolName, args)
}
