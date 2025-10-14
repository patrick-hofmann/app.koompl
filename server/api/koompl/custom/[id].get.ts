import { getCustomKoompl } from '../../../features/koompl/custom'

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

  const koompl = await getCustomKoompl(koomplId)

  if (!koompl) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Custom koompl not found'
    })
  }

  return {
    ok: true,
    koompl
  }
})
