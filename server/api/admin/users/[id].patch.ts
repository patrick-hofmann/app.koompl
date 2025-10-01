import { getIdentity, upsertUser } from '../../../utils/identityStorage'
import { requireSuperAdmin } from '../../../utils/authSession'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User id is required' })
  }

  const body = await readBody<{
    name?: string
    email?: string
    password?: string
  }>(event)

  const identity = await getIdentity()
  const existing = identity.users.find((user) => user.id === id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const name = body?.name !== undefined ? String(body.name).trim() : existing.name
  const email = body?.email !== undefined ? String(body.email).trim() : existing.email
  const password =
    body?.password !== undefined && body.password !== ''
      ? String(body.password).trim()
      : existing.password

  return await upsertUser({ id, name, email, password })
})
