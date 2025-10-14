import { createCustomKoompl } from '../../../features/koompl/custom'
import type { Agent } from '~/types'

export default defineEventHandler(async (event) => {
  const { session } = await getUserSession(event)

  if (!session?.team?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Not authenticated'
    })
  }

  const body = await readBody<Partial<Agent>>(event)

  const koompl = await createCustomKoompl(
    {
      teamId: session.team.id,
      userId: session.user?.id
    },
    body
  )

  return {
    ok: true,
    koompl
  }
})
