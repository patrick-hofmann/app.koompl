import {
  getTeamCalendarEvents,
  getUserCalendarEvents,
  getCalendarEventsByDateRange,
  getCalendarEvent,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  searchCalendarEvents
} from '../../../utils/calendarStorage'
import type { CalendarEvent } from '../../../types/calendar'
import type { CalendarMcpContext } from './context'

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

export async function getEventById(
  context: CalendarMcpContext,
  eventId: string
): Promise<CalendarEvent | null> {
  return await getCalendarEvent(context.teamId, eventId)
}

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
  const event = await getCalendarEvent(context.teamId, eventId)
  if (!event || event.userId !== context.userId) {
    return null
  }

  return await updateCalendarEvent(context.teamId, eventId, updates)
}

export async function removeMcpEvent(
  context: CalendarMcpContext,
  eventId: string
): Promise<boolean> {
  const event = await getCalendarEvent(context.teamId, eventId)
  if (!event || event.userId !== context.userId) {
    return false
  }

  return await deleteCalendarEvent(context.teamId, eventId)
}

export async function searchMcpEvents(
  context: CalendarMcpContext,
  query: string,
  userId?: string
): Promise<CalendarEvent[]> {
  const userIds = userId ? [userId] : undefined
  return await searchCalendarEvents(context.teamId, query, userIds)
}

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

export async function getMcpEventsByUsers(
  context: CalendarMcpContext,
  userIds: string[],
  startDate?: string,
  endDate?: string
): Promise<CalendarEvent[]> {
  if (startDate && endDate) {
    return await getCalendarEventsByDateRange(context.teamId, startDate, endDate, userIds)
  }

  const allEvents = await getTeamCalendarEvents(context.teamId)
  return allEvents.filter((event) => userIds.includes(event.userId))
}
