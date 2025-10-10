import { getEvent, deleteEvent } from '../../../features/calendar'

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

  const eventId = getRouterParam(event, 'eventId')

  if (!eventId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Event ID is required'
    })
  }

  const context = { teamId, userId }

  // Verify the event belongs to the user
  const existingEvent = await getEvent(context, eventId)

  if (!existingEvent) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Event not found'
    })
  }

  if (existingEvent.userId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You can only delete your own events'
    })
  }

  const success = await deleteEvent(context, eventId)

  if (!success) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete event'
    })
  }

  return { success: true }
})
