import { addSuperAdmin, setSuperAdminIds } from '../../../utils/identityStorage'
import { requireSuperAdmin } from '../../../utils/authSession'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const body = await readBody<{
    userId?: string
    userIds?: string[]
  }>(event)

  if (Array.isArray(body?.userIds)) {
    const ids = body!.userIds.map((id) => String(id).trim()).filter(Boolean)
    const superAdmins = await setSuperAdminIds(ids)
    return { superAdminIds: superAdmins }
  }

  const userId = String(body?.userId || '').trim()
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'User id is required' })
  }

  const superAdmins = await addSuperAdmin(userId)
  return { superAdminIds: superAdmins }
})
