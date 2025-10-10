import * as calendar from '../../../features/calendar'
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
    return await calendar.getEventsByDateRange(context, startDate, endDate, userIds)
  } else if (userId) {
    return await calendar.getUserEvents(context, userId)
  } else {
    return await calendar.listEvents(context)
  }
}

export async function getEventById(
  context: CalendarMcpContext,
  eventId: string
): Promise<CalendarEvent | null> {
  return await calendar.getEvent(context, eventId)
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
  return await calendar.createEvent(context, eventData)
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
  const event = await calendar.getEvent(context, eventId)
  if (!event || event.userId !== context.userId) {
    return null
  }

  return await calendar.updateEvent(context, eventId, updates)
}

export async function removeMcpEvent(
  context: CalendarMcpContext,
  eventId: string
): Promise<boolean> {
  const event = await calendar.getEvent(context, eventId)
  if (!event || event.userId !== context.userId) {
    return false
  }

  return await calendar.deleteEvent(context, eventId)
}

export async function searchMcpEvents(
  context: CalendarMcpContext,
  query: string,
  userId?: string
): Promise<CalendarEvent[]> {
  const userIds = userId ? [userId] : undefined
  return await calendar.searchEvents(context, query, userIds)
}

export async function getMcpEventsByUser(
  context: CalendarMcpContext,
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<CalendarEvent[]> {
  if (startDate && endDate) {
    return await calendar.getEventsByDateRange(context, startDate, endDate, [userId])
  }
  return await calendar.getUserEvents(context, userId)
}

export async function getMcpEventsByUsers(
  context: CalendarMcpContext,
  userIds: string[],
  startDate?: string,
  endDate?: string
): Promise<CalendarEvent[]> {
  if (startDate && endDate) {
    return await calendar.getEventsByDateRange(context, startDate, endDate, userIds)
  }

  return await calendar.getUsersEvents(context, userIds)
}
