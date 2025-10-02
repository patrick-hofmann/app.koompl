/**
 * Built-in Calendar Tools Executor
 *
 * Provides direct tool execution for builtin Calendar MCP server without HTTP overhead.
 */

import {
  listEvents,
  getEventById,
  createMcpEvent,
  modifyMcpEvent,
  removeMcpEvent,
  searchMcpEvents,
  getMcpEventsByUser,
  type CalendarMcpContext
} from './mcpCalendar'

import type { McpToolResult } from './builtinMcpTools'

/**
 * Execute a Calendar tool directly (no HTTP)
 */
export async function executeCalendarTool(
  context: CalendarMcpContext,
  toolName: string,
  args: Record<string, any>
): Promise<McpToolResult> {
  try {
    let result: any

    switch (toolName) {
      case 'list_events':
        result = await listEvents(context, args.startDate, args.endDate, args.userId)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  data: result,
                  summary: `Found ${result.length} event(s)`
                },
                null,
                2
              )
            }
          ]
        }

      case 'get_event':
        result = await getEventById(context, args.eventId)
        if (!result) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Event '${args.eventId}' not found`
                  },
                  null,
                  2
                )
              }
            ],
            isError: true
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  data: result,
                  summary: `Event: ${result.title}`
                },
                null,
                2
              )
            }
          ]
        }

      case 'create_event':
        result = await createMcpEvent(context, {
          title: args.title,
          description: args.description,
          startDate: args.startDate,
          endDate: args.endDate,
          allDay: args.allDay,
          location: args.location,
          color: args.color,
          tags: args.tags
        })
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  data: result,
                  summary: `Created event: ${result.title}`
                },
                null,
                2
              )
            }
          ]
        }

      case 'modify_event':
        result = await modifyMcpEvent(context, args.eventId, {
          title: args.title,
          description: args.description,
          startDate: args.startDate,
          endDate: args.endDate,
          allDay: args.allDay,
          location: args.location,
          color: args.color,
          tags: args.tags
        })
        if (!result) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    error: 'Event not found or permission denied'
                  },
                  null,
                  2
                )
              }
            ],
            isError: true
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  data: result,
                  summary: `Modified event: ${result.title}`
                },
                null,
                2
              )
            }
          ]
        }

      case 'remove_event':
        result = await removeMcpEvent(context, args.eventId)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: result,
                  summary: result
                    ? 'Event removed successfully'
                    : 'Event not found or permission denied'
                },
                null,
                2
              )
            }
          ],
          isError: !result
        }

      case 'search_events':
        result = await searchMcpEvents(context, args.query, args.userId)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  data: result,
                  summary: `Found ${result.length} event(s) matching '${args.query}'`
                },
                null,
                2
              )
            }
          ]
        }

      case 'get_events_by_user':
        result = await getMcpEventsByUser(context, args.userId, args.startDate, args.endDate)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  data: result,
                  summary: `Found ${result.length} event(s) for user ${args.userId}`
                },
                null,
                2
              )
            }
          ]
        }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: `Unknown tool: ${toolName}`
                },
                null,
                2
              )
            }
          ],
          isError: true
        }
    }
  } catch (error) {
    return {
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
      ],
      isError: true
    }
  }
}
