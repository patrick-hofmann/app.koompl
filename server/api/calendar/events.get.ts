import {
  getTeamCalendarEvents,
  getCalendarEventsByDateRange,
  getUsersCalendarEvents
} from '../../utils/calendarStorage'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id

  if (!teamId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected'
    })
  }

  const query = getQuery(event)
  const startDate = query.startDate as string | undefined
  const endDate = query.endDate as string | undefined
  const userIds = query.userIds as string | string[] | undefined

  let events

  if (startDate && endDate) {
    // Get events within date range
    const users = Array.isArray(userIds) ? userIds : userIds ? [userIds] : undefined
    events = await getCalendarEventsByDateRange(teamId, startDate, endDate, users)
  } else if (userIds) {
    // Get events for specific users
    const users = Array.isArray(userIds) ? userIds : [userIds]
    events = await getUsersCalendarEvents(teamId, users)
  } else {
    // Get all events
    events = await getTeamCalendarEvents(teamId)
  }

  return { events }
})
