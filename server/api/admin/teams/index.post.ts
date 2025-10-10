import { saveTeam } from '../../../features/team'
import { requireSuperAdmin } from '../../../utils/authSession'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const body = await readBody<{
    name?: string
    description?: string
    domain?: string
  }>(event)

  const name = String(body?.name || '').trim()
  const description = body?.description !== undefined ? String(body.description).trim() : undefined
  const domain = body?.domain ? String(body.domain).trim() : undefined

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  const team = await saveTeam({ name, description, domain })
  return team
})
