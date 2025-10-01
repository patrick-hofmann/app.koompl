import { upsertMembership } from '../../../utils/identityStorage'
import { requireSuperAdmin } from '../../../utils/authSession'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const body = await readBody<{
    userId?: string
    teamId?: string
    role?: 'admin' | 'user'
  }>(event)

  const membership = await upsertMembership({
    userId: String(body?.userId || ''),
    teamId: String(body?.teamId || ''),
    role: body?.role || 'user'
  })

  return membership
})
