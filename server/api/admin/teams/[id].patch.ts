import { getTeam, saveTeam } from '../../../features/team'
import { requireSuperAdmin } from '../../../utils/authSession'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Team id is required' })
  }

  const body = await readBody<{
    name?: string
    description?: string
    domain?: string
  }>(event)

  const existing = await getTeam(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Team not found' })
  }

  const name = body?.name !== undefined ? String(body.name).trim() : existing.name
  const description =
    body?.description !== undefined ? String(body.description).trim() : existing.description
  const domain =
    body?.domain !== undefined
      ? body.domain
        ? String(body.domain).trim()
        : undefined
      : existing.domain

  return await saveTeam({ id, name, description, domain })
})
