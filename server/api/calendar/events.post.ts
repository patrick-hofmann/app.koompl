import { createEvent } from '../../features/calendar'
import type { CalendarEvent } from '../../types/calendar'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id
  const userId = session.user?.id

  if (!teamId || !userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected or user not authenticated'
    })
  }

  const body =
    await readBody<
      Omit<CalendarEvent, 'id' | 'teamId' | 'userId' | 'createdAt' | 'updatedAt' | 'createdBy'>
    >(event)

  if (!body.title || !body.startDate || !body.endDate) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: title, startDate, endDate'
    })
  }

  const newEvent = await createEvent({ teamId, userId }, body)
  return { event: newEvent }
})
