import type { CalendarEvent } from '../../types/calendar'
import {
  getTeamCalendarEvents,
  getUserCalendarEvents,
  getUsersCalendarEvents,
  getCalendarEventsByDateRange,
  getCalendarEvent as getCalendarEventStorage,
  createCalendarEvent as createCalendarEventStorage,
  updateCalendarEvent as updateCalendarEventStorage,
  deleteCalendarEvent as deleteCalendarEventStorage,
  searchCalendarEvents as searchCalendarEventsStorage
} from './storage'

export interface CalendarContext {
  teamId: string
  userId?: string
  agentId?: string
}

/**
 * Get all calendar events for a team
 */
export async function listEvents(context: CalendarContext): Promise<CalendarEvent[]> {
  return await getTeamCalendarEvents(context.teamId)
}

/**
 * Get calendar events for a specific user
 */
export async function getUserEvents(
  context: CalendarContext,
  userId: string
): Promise<CalendarEvent[]> {
  return await getUserCalendarEvents(context.teamId, userId)
}

/**
 * Get calendar events for multiple users
 */
export async function getUsersEvents(
  context: CalendarContext,
  userIds: string[]
): Promise<CalendarEvent[]> {
  return await getUsersCalendarEvents(context.teamId, userIds)
}

/**
 * Get calendar events within a date range
 */
export async function getEventsByDateRange(
  context: CalendarContext,
  startDate: string,
  endDate: string,
  userIds?: string[]
): Promise<CalendarEvent[]> {
  return await getCalendarEventsByDateRange(context.teamId, startDate, endDate, userIds)
}

/**
 * Get a specific calendar event by ID
 */
export async function getEvent(
  context: CalendarContext,
  eventId: string
): Promise<CalendarEvent | null> {
  return await getCalendarEventStorage(context.teamId, eventId)
}

/**
 * Create a new calendar event
 */
export async function createEvent(
  context: CalendarContext,
  eventData: Omit<
    CalendarEvent,
    'id' | 'teamId' | 'userId' | 'createdAt' | 'updatedAt' | 'createdBy'
  > & { userId?: string }
): Promise<CalendarEvent> {
  const userId = eventData.userId || context.userId || 'system'
  return await createCalendarEventStorage(context.teamId, userId, eventData)
}

/**
 * Update a calendar event
 */
export async function updateEvent(
  context: CalendarContext,
  eventId: string,
  updates: Partial<Omit<CalendarEvent, 'id' | 'teamId' | 'createdAt' | 'updatedAt' | 'createdBy'>>
): Promise<CalendarEvent | null> {
  return await updateCalendarEventStorage(context.teamId, eventId, updates)
}

/**
 * Delete a calendar event
 */
export async function deleteEvent(context: CalendarContext, eventId: string): Promise<boolean> {
  return await deleteCalendarEventStorage(context.teamId, eventId)
}

/**
 * Search calendar events
 */
export async function searchEvents(
  context: CalendarContext,
  query: string,
  userIds?: string[]
): Promise<CalendarEvent[]> {
  return await searchCalendarEventsStorage(context.teamId, query, userIds)
}

/**
 * Get upcoming events for a user
 */
export async function getUpcomingEvents(
  context: CalendarContext,
  userId: string,
  days: number = 7
): Promise<CalendarEvent[]> {
  const now = new Date()
  const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const events = await getCalendarEventsByDateRange(
    context.teamId,
    now.toISOString(),
    endDate.toISOString(),
    [userId]
  )

  return events.sort((a, b) => {
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  })
}

/**
 * Check if a user is available during a time range
 */
export async function checkAvailability(
  context: CalendarContext,
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ available: boolean; conflicts: CalendarEvent[] }> {
  const events = await getCalendarEventsByDateRange(context.teamId, startDate, endDate, [userId])

  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()

  const conflicts = events.filter((event) => {
    const eventStart = new Date(event.startDate).getTime()
    const eventEnd = new Date(event.endDate).getTime()
    return eventStart < end && eventEnd > start
  })

  return {
    available: conflicts.length === 0,
    conflicts
  }
}

/**
 * Get calendar statistics
 */
export async function getCalendarStats(
  context: CalendarContext,
  userId?: string
): Promise<{
  totalEvents: number
  upcomingEvents: number
  pastEvents: number
  eventsByUser?: Record<string, number>
}> {
  const events = userId
    ? await getUserCalendarEvents(context.teamId, userId)
    : await getTeamCalendarEvents(context.teamId)

  const now = new Date().getTime()
  const upcomingEvents = events.filter((e) => new Date(e.startDate).getTime() > now).length
  const pastEvents = events.filter((e) => new Date(e.endDate).getTime() < now).length

  const stats: ReturnType<typeof getCalendarStats> extends Promise<infer T> ? T : never = {
    totalEvents: events.length,
    upcomingEvents,
    pastEvents
  }

  if (!userId) {
    const eventsByUser: Record<string, number> = {}
    for (const event of events) {
      eventsByUser[event.userId] = (eventsByUser[event.userId] || 0) + 1
    }
    stats.eventsByUser = eventsByUser
  }

  return stats
}
