import { getCustomKoompl, updateCustomKoompl } from '../../../features/koompl/custom'
import type { Agent } from '~/types'

export default defineEventHandler(async (event) => {
  const { session } = await getUserSession(event)

  if (!session?.team?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Not authenticated'
    })
  }

  const koomplId = getRouterParam(event, 'id')
  if (!koomplId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Koompl ID is required'
    })
  }

  // Verify it exists and belongs to team
  const existing = await getCustomKoompl(koomplId)
  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Custom koompl not found'
    })
  }

  if (existing.teamId !== session.team.id) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Not authorized to update this koompl'
    })
  }

  const body = await readBody<Partial<Agent>>(event)
  const updated = await updateCustomKoompl(koomplId, body)

  if (!updated) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Failed to update koompl'
    })
  }

  return {
    ok: true,
    koompl: updated
  }
})
