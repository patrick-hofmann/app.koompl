/**
 * Built-in Calendar Tools Executor
 *
 * Provides direct tool execution for builtin Calendar MCP server without HTTP overhead.
 */

import { calendarDefinition, type CalendarMcpContext } from '../builtin/calendar'
import type { BuiltinToolResponse } from '../builtin/shared'

import type { McpToolResult } from './builtin'

/**
 * Execute a Calendar tool directly (no HTTP)
 */
function formatResponse(response: BuiltinToolResponse): McpToolResult {
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

export async function executeCalendarTool(
  context: CalendarMcpContext,
  toolName: string,
  args: Record<string, any>
): Promise<McpToolResult> {
  const tool = calendarDefinition.tools.find((item) => item.name === toolName)
  if (!tool) {
    return formatResponse({ success: false, error: `Unknown tool: ${toolName}` })
  }

  try {
    const result = await tool.execute({ context, args })
    return formatResponse(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return formatResponse({ success: false, error: message })
  }
}
