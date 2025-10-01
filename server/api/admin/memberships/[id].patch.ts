import { getIdentity, upsertMembership } from '../../../utils/identityStorage'
import { requireSuperAdmin } from '../../../utils/authSession'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Membership id is required' })
  }

  const body = await readBody<{
    userId?: string
    teamId?: string
    role?: 'admin' | 'user'
  }>(event)

  const identity = await getIdentity()
  const existing = identity.memberships.find((membership) => membership.id === id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Membership not found' })
  }

  const userId = body?.userId !== undefined ? String(body.userId).trim() : existing.userId
  const teamId = body?.teamId !== undefined ? String(body.teamId).trim() : existing.teamId
  const role = body?.role !== undefined ? body.role : existing.role

  return await upsertMembership({ id, userId, teamId, role })
})
