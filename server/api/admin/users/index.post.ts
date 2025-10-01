import { upsertUser } from '../../../utils/identityStorage'
import { requireSuperAdmin } from '../../../utils/authSession'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const body = await readBody<{
    name?: string
    email?: string
    password?: string
  }>(event)

  const name = String(body?.name || '').trim()
  const email = String(body?.email || '')
    .trim()
    .toLowerCase()
  const password = String(body?.password || '').trim()

  if (!name || !email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Name, email, and password are required' })
  }

  const user = await upsertUser({ name, email, password })
  return user
})
