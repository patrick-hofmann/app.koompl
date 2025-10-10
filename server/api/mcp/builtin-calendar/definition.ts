import type { BuiltinMcpDefinition } from '../shared'
import type { CalendarMcpContext } from './context'
import {
  createMcpEvent,
  getEventById,
  getMcpEventsByUser,
  getMcpEventsByUsers,
  listEvents,
  removeMcpEvent,
  searchMcpEvents,
  modifyMcpEvent
} from './operations'

export const calendarDefinition: BuiltinMcpDefinition<CalendarMcpContext> = {
  id: 'builtin-calendar',
  serverName: 'builtin-calendar-server',
  logPrefix: '[BuiltinCalendarMCP]',
  context: {
    spec: {
      teamIdEnv: 'CALENDAR_TEAM_ID',
      userIdEnv: 'CALENDAR_USER_ID',
      agentIdEnv: 'CALENDAR_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.CALENDAR_TEAM_ID as string,
      userId: env.CALENDAR_USER_ID as string,
      agentId: env.CALENDAR_AGENT_ID || undefined
    })
  },
  tools: [
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
      },
      execute: async ({ context, args }) => {
        const { startDate, endDate, userId } = args as {
          startDate?: string
          endDate?: string
          userId?: string
        }
        const events = await listEvents(context, startDate, endDate, userId)
        return {
          success: true,
          data: events,
          summary: `Found ${events.length} events`
        }
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
      },
      execute: async ({ context, args }) => {
        const { eventId } = args as { eventId?: string }
        if (!eventId) {
          return { success: false, error: 'eventId is required' }
        }
        const event = await getEventById(context, eventId)
        return {
          success: !!event,
          data: event,
          summary: event ? `Retrieved event: ${event.title}` : 'Event not found'
        }
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
      },
      execute: async ({ context, args }) => {
        const {
          title,
          description,
          startDate,
          endDate,
          allDay,
          location,
          attendees,
          color,
          tags,
          recurrence
        } = args as {
          title?: string
          description?: string
          startDate?: string
          endDate?: string
          allDay?: boolean
          location?: string
          attendees?: string[]
          color?: string
          tags?: string[]
          recurrence?: {
            frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
            interval?: number
            endDate?: string
            count?: number
          }
        }
        if (!title || !startDate || !endDate) {
          return {
            success: false,
            error: 'title, startDate and endDate are required'
          }
        }
        const event = await createMcpEvent(context, {
          title,
          description,
          startDate,
          endDate,
          allDay,
          location,
          attendees,
          color,
          tags,
          recurrence
        })
        return {
          success: true,
          data: event,
          summary: `Created event: ${event.title}`
        }
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
      },
      execute: async ({ context, args }) => {
        const {
          eventId,
          title,
          description,
          startDate,
          endDate,
          allDay,
          location,
          attendees,
          color,
          tags,
          recurrence
        } = args as {
          eventId?: string
          title?: string
          description?: string
          startDate?: string
          endDate?: string
          allDay?: boolean
          location?: string
          attendees?: string[]
          color?: string
          tags?: string[]
          recurrence?: {
            frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
            interval?: number
            endDate?: string
            count?: number
          }
        }
        if (!eventId) {
          return { success: false, error: 'eventId is required' }
        }
        const event = await modifyMcpEvent(context, eventId, {
          title,
          description,
          startDate,
          endDate,
          allDay,
          location,
          attendees,
          color,
          tags,
          recurrence
        })
        return {
          success: !!event,
          data: event,
          summary: event ? `Modified event: ${event.title}` : 'Event not found or permission denied'
        }
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
      },
      execute: async ({ context, args }) => {
        const { eventId } = args as { eventId?: string }
        if (!eventId) {
          return { success: false, error: 'eventId is required' }
        }
        const success = await removeMcpEvent(context, eventId)
        return {
          success,
          summary: success ? 'Event removed successfully' : 'Event not found or permission denied'
        }
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
      },
      execute: async ({ context, args }) => {
        const { query, userId } = args as { query?: string; userId?: string }
        if (!query) {
          return { success: false, error: 'query is required' }
        }
        const events = await searchMcpEvents(context, query, userId)
        return {
          success: true,
          data: events,
          summary: `Found ${events.length} matching events`
        }
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
      },
      execute: async ({ context, args }) => {
        const { userId, startDate, endDate } = args as {
          userId?: string
          startDate?: string
          endDate?: string
        }
        if (!userId) {
          return { success: false, error: 'userId is required' }
        }
        const events = await getMcpEventsByUser(context, userId, startDate, endDate)
        return {
          success: true,
          data: events,
          summary: `Found ${events.length} events for user ${userId}`
        }
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
      },
      execute: async ({ context, args }) => {
        const { userIds, startDate, endDate } = args as {
          userIds?: string[]
          startDate?: string
          endDate?: string
        }
        if (!userIds || !userIds.length) {
          return { success: false, error: 'userIds must include at least one value' }
        }
        const events = await getMcpEventsByUsers(context, userIds, startDate, endDate)
        return {
          success: true,
          data: events,
          summary: `Found ${events.length} events for selected users`
        }
      }
    }
  ]
}
