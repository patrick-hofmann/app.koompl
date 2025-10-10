import type { CalendarEvent, CalendarEventList } from '../../types/calendar'

const storage = useStorage('identity')

/**
 * Get all calendar events for a team
 */
export async function getTeamCalendarEvents(teamId: string): Promise<CalendarEvent[]> {
  const key = `calendar:team:${teamId}`
  const events = (await storage.getItem<CalendarEventList>(key)) || {}
  return Object.values(events)
}

/**
 * Get calendar events for a specific user
 */
export async function getUserCalendarEvents(
  teamId: string,
  userId: string
): Promise<CalendarEvent[]> {
  const allEvents = await getTeamCalendarEvents(teamId)
  return allEvents.filter((event) => event.userId === userId)
}

/**
 * Get calendar events for multiple users
 */
export async function getUsersCalendarEvents(
  teamId: string,
  userIds: string[]
): Promise<CalendarEvent[]> {
  const allEvents = await getTeamCalendarEvents(teamId)
  return allEvents.filter((event) => userIds.includes(event.userId))
}

/**
 * Get calendar events within a date range
 */
export async function getCalendarEventsByDateRange(
  teamId: string,
  startDate: string,
  endDate: string,
  userIds?: string[]
): Promise<CalendarEvent[]> {
  const events = userIds
    ? await getUsersCalendarEvents(teamId, userIds)
    : await getTeamCalendarEvents(teamId)

  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()

  return events.filter((event) => {
    const eventStart = new Date(event.startDate).getTime()
    const eventEnd = new Date(event.endDate).getTime()
    return eventStart <= end && eventEnd >= start
  })
}

/**
 * Get a specific event by ID
 */
export async function getCalendarEvent(
  teamId: string,
  eventId: string
): Promise<CalendarEvent | null> {
  const key = `calendar:team:${teamId}`
  const events = (await storage.getItem<CalendarEventList>(key)) || {}
  return events[eventId] || null
}

/**
 * Create a new calendar event
 */
export async function createCalendarEvent(
  teamId: string,
  userId: string,
  eventData: Omit<
    CalendarEvent,
    'id' | 'teamId' | 'userId' | 'createdAt' | 'updatedAt' | 'createdBy'
  >
): Promise<CalendarEvent> {
  const key = `calendar:team:${teamId}`
  const events = (await storage.getItem<CalendarEventList>(key)) || {}

  const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const now = new Date().toISOString()

  const newEvent: CalendarEvent = {
    id: eventId,
    teamId,
    userId,
    ...eventData,
    createdAt: now,
    updatedAt: now,
    createdBy: userId
  }

  events[eventId] = newEvent
  await storage.setItem(key, events)

  return newEvent
}

/**
 * Update a calendar event
 */
export async function updateCalendarEvent(
  teamId: string,
  eventId: string,
  updates: Partial<Omit<CalendarEvent, 'id' | 'teamId' | 'createdAt' | 'updatedAt' | 'createdBy'>>
): Promise<CalendarEvent | null> {
  const key = `calendar:team:${teamId}`
  const events = (await storage.getItem<CalendarEventList>(key)) || {}

  if (!events[eventId]) {
    return null
  }

  events[eventId] = {
    ...events[eventId],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  await storage.setItem(key, events)
  return events[eventId]
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(teamId: string, eventId: string): Promise<boolean> {
  const key = `calendar:team:${teamId}`
  const events = (await storage.getItem<CalendarEventList>(key)) || {}

  if (!events[eventId]) {
    return false
  }

  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete events[eventId]
  await storage.setItem(key, events)
  return true
}

/**
 * Search calendar events
 */
export async function searchCalendarEvents(
  teamId: string,
  query: string,
  userIds?: string[]
): Promise<CalendarEvent[]> {
  const events = userIds
    ? await getUsersCalendarEvents(teamId, userIds)
    : await getTeamCalendarEvents(teamId)

  const lowerQuery = query.toLowerCase()

  return events.filter((event) => {
    return (
      event.title.toLowerCase().includes(lowerQuery) ||
      event.description?.toLowerCase().includes(lowerQuery) ||
      event.location?.toLowerCase().includes(lowerQuery) ||
      event.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
    )
  })
}
