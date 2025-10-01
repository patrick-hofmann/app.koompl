import { upsertTeam } from '../../../utils/identityStorage'
import { requireSuperAdmin } from '../../../utils/authSession'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const body = await readBody<{
    name?: string
    description?: string
  }>(event)

  const name = String(body?.name || '').trim()
  const description = body?.description !== undefined ? String(body.description).trim() : undefined

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  const team = await upsertTeam({ name, description })
  return team
})
