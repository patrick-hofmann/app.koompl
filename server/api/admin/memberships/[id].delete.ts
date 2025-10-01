import { deleteMembership } from '../../../utils/identityStorage'
import { requireSuperAdmin } from '../../../utils/authSession'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Membership id is required' })
  }

  await deleteMembership(id)
  return { success: true }
})
