/**
 * Built-in MCP Server for Calendar Access
 * This provides agents with the ability to interact with team calendars
 */

import type { McpContextResult } from '../types/mcp-clients'
import {
  getTeamCalendarEvents,
  getUserCalendarEvents,
  getCalendarEventsByDateRange,
  getCalendarEvent,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  searchCalendarEvents
} from './calendarStorage'
import type { CalendarEvent } from '../types/calendar'

export interface CalendarMcpContext {
  teamId: string
  userId: string
  agentId?: string
}

/**
 * Get summary of upcoming calendar events for context
 */
export async function fetchCalendarContext(
  context: CalendarMcpContext,
  limit: number = 10
): Promise<McpContextResult | null> {
  // Get events for the next 30 days
  const now = new Date()
  const futureDate = new Date()
  futureDate.setDate(now.getDate() + 30)

  const events = await getCalendarEventsByDateRange(
    context.teamId,
    now.toISOString(),
    futureDate.toISOString()
  )

  if (!events.length) {
    return {
      serverId: 'builtin-calendar',
      serverName: 'Team Calendar',
      provider: 'builtin',
      category: 'calendar',
      summary: 'No upcoming calendar events found for this team.',
      details: []
    }
  }

  // Sort by start date and take the first items
  const sortedEvents = events
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, limit)

  const eventSummaries = sortedEvents.map((event) => {
    const startDate = new Date(event.startDate).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    return `• ${event.title} - ${startDate}`
  })

  return {
    serverId: 'builtin-calendar',
    serverName: 'Team Calendar',
    provider: 'builtin',
    category: 'calendar',
    summary: `Upcoming Events (next 30 days):\n${eventSummaries.join('\n')}`,
    details: sortedEvents
  }
}

/**
 * List all events for the team
 */
export async function listEvents(
  context: CalendarMcpContext,
  startDate?: string,
  endDate?: string,
  userId?: string
): Promise<CalendarEvent[]> {
  if (startDate && endDate) {
    const userIds = userId ? [userId] : undefined
    return await getCalendarEventsByDateRange(context.teamId, startDate, endDate, userIds)
  } else if (userId) {
    return await getUserCalendarEvents(context.teamId, userId)
  } else {
    return await getTeamCalendarEvents(context.teamId)
  }
}

/**
 * Get a specific event by ID
 */
export async function getEventById(
  context: CalendarMcpContext,
  eventId: string
): Promise<CalendarEvent | null> {
  return await getCalendarEvent(context.teamId, eventId)
}

/**
 * Create a new calendar event
 */
export async function createMcpEvent(
  context: CalendarMcpContext,
  eventData: {
    title: string
    description?: string
    startDate: string
    endDate: string
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
): Promise<CalendarEvent> {
  return await createCalendarEvent(context.teamId, context.userId, eventData)
}

/**
 * Update an existing calendar event
 */
export async function modifyMcpEvent(
  context: CalendarMcpContext,
  eventId: string,
  updates: {
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
): Promise<CalendarEvent | null> {
  // Verify the event belongs to the user
  const event = await getCalendarEvent(context.teamId, eventId)
  if (!event || event.userId !== context.userId) {
    return null
  }

  return await updateCalendarEvent(context.teamId, eventId, updates)
}

/**
 * Delete a calendar event
 */
export async function removeMcpEvent(
  context: CalendarMcpContext,
  eventId: string
): Promise<boolean> {
  // Verify the event belongs to the user
  const event = await getCalendarEvent(context.teamId, eventId)
  if (!event || event.userId !== context.userId) {
    return false
  }

  return await deleteCalendarEvent(context.teamId, eventId)
}

/**
 * Search for events by title, description, or location
 */
export async function searchMcpEvents(
  context: CalendarMcpContext,
  query: string,
  userId?: string
): Promise<CalendarEvent[]> {
  const userIds = userId ? [userId] : undefined
  return await searchCalendarEvents(context.teamId, query, userIds)
}

/**
 * Get events for a specific user
 */
export async function getMcpEventsByUser(
  context: CalendarMcpContext,
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<CalendarEvent[]> {
  if (startDate && endDate) {
    return await getCalendarEventsByDateRange(context.teamId, startDate, endDate, [userId])
  }
  return await getUserCalendarEvents(context.teamId, userId)
}

/**
 * Get events for multiple users
 */
export async function getMcpEventsByUsers(
  context: CalendarMcpContext,
  userIds: string[],
  startDate?: string,
  endDate?: string
): Promise<CalendarEvent[]> {
  if (startDate && endDate) {
    return await getCalendarEventsByDateRange(context.teamId, startDate, endDate, userIds)
  }

  // If no date range, get all events and filter by user
  const allEvents = await getTeamCalendarEvents(context.teamId)
  return allEvents.filter((event) => userIds.includes(event.userId))
}
