import { removeTeam } from '../../../features/team'
import { requireSuperAdmin } from '../../../utils/authSession'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Team id is required' })
  }

  await removeTeam(id)
  return { success: true }
})
