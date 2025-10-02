#!/usr/bin/env node

/**
 * Built-in Calendar MCP Server
 * This runs as a proper MCP server that the MCP client can connect to
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js'
import {
  listEvents,
  getEventById,
  createMcpEvent,
  modifyMcpEvent,
  removeMcpEvent,
  searchMcpEvents,
  getMcpEventsByUser,
  getMcpEventsByUsers,
  type CalendarMcpContext
} from './mcpCalendar'

// Get context from environment variables (passed by the MCP client)
const getCalendarContext = (): CalendarMcpContext => {
  console.log('[BuiltinCalendarMCP] Getting context from environment variables')
  const teamId = process.env.CALENDAR_TEAM_ID
  const userId = process.env.CALENDAR_USER_ID
  const agentId = process.env.CALENDAR_AGENT_ID

  console.log('[BuiltinCalendarMCP] Environment variables:', {
    hasTeamId: !!teamId,
    hasUserId: !!userId,
    hasAgentId: !!agentId
  })

  if (!teamId || !userId) {
    throw new Error('Missing required environment variables: CALENDAR_TEAM_ID, CALENDAR_USER_ID')
  }

  return {
    teamId,
    userId,
    agentId
  }
}

async function main() {
  console.log('[BuiltinCalendarMCP] Starting built-in Calendar MCP server...')

  const server = new Server(
    {
      name: 'builtin-calendar-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  )

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: 'list_events',
        description:
          'List calendar events, optionally filtered by date range and/or user. Returns all team events by default.',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'Start date in ISO 8601 format (optional)'
            },
            endDate: {
              type: 'string',
              description: 'End date in ISO 8601 format (optional)'
            },
            userId: {
              type: 'string',
              description: 'Filter events by user ID (optional)'
            }
          },
          additionalProperties: false
        }
      },
      {
        name: 'get_event',
        description: 'Get details of a specific calendar event by ID',
        inputSchema: {
          type: 'object',
          properties: {
            eventId: {
              type: 'string',
              description: 'Event ID to retrieve'
            }
          },
          required: ['eventId'],
          additionalProperties: false
        }
      },
      {
        name: 'create_event',
        description: 'Create a new calendar event',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Title of the event'
            },
            description: {
              type: 'string',
              description: 'Optional description of the event'
            },
            startDate: {
              type: 'string',
              description: 'Start date and time in ISO 8601 format'
            },
            endDate: {
              type: 'string',
              description: 'End date and time in ISO 8601 format'
            },
            allDay: {
              type: 'boolean',
              description: 'Whether this is an all-day event'
            },
            location: {
              type: 'string',
              description: 'Optional location of the event'
            },
            attendees: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional list of attendee user IDs or email addresses'
            },
            color: {
              type: 'string',
              description: 'Optional color for the event (hex code)'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags for the event'
            },
            recurrence: {
              type: 'object',
              properties: {
                frequency: {
                  type: 'string',
                  enum: ['daily', 'weekly', 'monthly', 'yearly'],
                  description: 'Recurrence frequency'
                },
                interval: {
                  type: 'number',
                  description: 'Interval between recurrences (e.g., 2 for every 2 weeks)'
                },
                endDate: {
                  type: 'string',
                  description: 'End date for recurrence in ISO 8601 format'
                },
                count: {
                  type: 'number',
                  description: 'Number of occurrences'
                }
              },
              description: 'Optional recurrence pattern'
            }
          },
          required: ['title', 'startDate', 'endDate'],
          additionalProperties: false
        }
      },
      {
        name: 'modify_event',
        description: 'Update an existing calendar event (only the event owner can modify)',
        inputSchema: {
          type: 'object',
          properties: {
            eventId: {
              type: 'string',
              description: 'ID of the event to modify'
            },
            title: {
              type: 'string',
              description: 'New title for the event'
            },
            description: {
              type: 'string',
              description: 'New description for the event'
            },
            startDate: {
              type: 'string',
              description: 'New start date and time in ISO 8601 format'
            },
            endDate: {
              type: 'string',
              description: 'New end date and time in ISO 8601 format'
            },
            allDay: {
              type: 'boolean',
              description: 'Whether this is an all-day event'
            },
            location: {
              type: 'string',
              description: 'New location of the event'
            },
            attendees: {
              type: 'array',
              items: { type: 'string' },
              description: 'New list of attendee user IDs or email addresses'
            },
            color: {
              type: 'string',
              description: 'New color for the event (hex code)'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'New tags for the event'
            },
            recurrence: {
              type: 'object',
              properties: {
                frequency: {
                  type: 'string',
                  enum: ['daily', 'weekly', 'monthly', 'yearly']
                },
                interval: {
                  type: 'number'
                },
                endDate: {
                  type: 'string'
                },
                count: {
                  type: 'number'
                }
              },
              description: 'New recurrence pattern'
            }
          },
          required: ['eventId'],
          additionalProperties: false
        }
      },
      {
        name: 'remove_event',
        description: 'Delete a calendar event (only the event owner can delete)',
        inputSchema: {
          type: 'object',
          properties: {
            eventId: {
              type: 'string',
              description: 'ID of the event to remove'
            }
          },
          required: ['eventId'],
          additionalProperties: false
        }
      },
      {
        name: 'search_events',
        description: 'Search for events by title, description, location, or tags',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            userId: {
              type: 'string',
              description: 'Optional user ID to limit search to specific user'
            }
          },
          required: ['query'],
          additionalProperties: false
        }
      },
      {
        name: 'get_events_by_user',
        description: 'Get all events for a specific user, optionally filtered by date range',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'User ID to get events for'
            },
            startDate: {
              type: 'string',
              description: 'Start date in ISO 8601 format (optional)'
            },
            endDate: {
              type: 'string',
              description: 'End date in ISO 8601 format (optional)'
            }
          },
          required: ['userId'],
          additionalProperties: false
        }
      },
      {
        name: 'get_events_by_users',
        description: 'Get events for multiple users, optionally filtered by date range',
        inputSchema: {
          type: 'object',
          properties: {
            userIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of user IDs to get events for'
            },
            startDate: {
              type: 'string',
              description: 'Start date in ISO 8601 format (optional)'
            },
            endDate: {
              type: 'string',
              description: 'End date in ISO 8601 format (optional)'
            }
          },
          required: ['userIds'],
          additionalProperties: false
        }
      }
    ]

    return { tools }
  })

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    console.log(`[BuiltinCalendarMCP] Tool call: ${name} with args:`, args)

    const context = getCalendarContext()

    try {
      switch (name) {
        case 'list_events': {
          const events = await listEvents(context, args.startDate, args.endDate, args.userId)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    data: events,
                    summary: `Found ${events.length} events`
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'get_event': {
          const event = await getEventById(context, args.eventId)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: !!event,
                    data: event,
                    summary: event ? `Retrieved event: ${event.title}` : 'Event not found'
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'create_event': {
          const event = await createMcpEvent(context, {
            title: args.title,
            description: args.description,
            startDate: args.startDate,
            endDate: args.endDate,
            allDay: args.allDay,
            location: args.location,
            attendees: args.attendees,
            color: args.color,
            tags: args.tags,
            recurrence: args.recurrence
          })
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    data: event,
                    summary: `Created event: ${event.title}`
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'modify_event': {
          const event = await modifyMcpEvent(context, args.eventId, {
            title: args.title,
            description: args.description,
            startDate: args.startDate,
            endDate: args.endDate,
            allDay: args.allDay,
            location: args.location,
            attendees: args.attendees,
            color: args.color,
            tags: args.tags,
            recurrence: args.recurrence
          })
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: !!event,
                    data: event,
                    summary: event
                      ? `Modified event: ${event.title}`
                      : 'Event not found or permission denied'
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'remove_event': {
          const success = await removeMcpEvent(context, args.eventId)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success,
                    summary: success
                      ? 'Event removed successfully'
                      : 'Event not found or permission denied'
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'search_events': {
          const events = await searchMcpEvents(context, args.query, args.userId)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    data: events,
                    summary: `Found ${events.length} matching events`
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'get_events_by_user': {
          const events = await getMcpEventsByUser(
            context,
            args.userId,
            args.startDate,
            args.endDate
          )
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    data: events,
                    summary: `Found ${events.length} events for user ${args.userId}`
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        case 'get_events_by_users': {
          const events = await getMcpEventsByUsers(
            context,
            args.userIds,
            args.startDate,
            args.endDate
          )
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    data: events,
                    summary: `Found ${events.length} events for selected users`
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        default:
          throw new Error(`Unknown tool: ${name}`)
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
  })

  // Start the server
  console.log('[BuiltinCalendarMCP] Connecting to stdio transport...')
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.log('[BuiltinCalendarMCP] Server connected and ready to receive requests')
}

// Run the server
main().catch((error) => {
  console.error('Calendar MCP Server error:', error)
  process.exit(1)
})
