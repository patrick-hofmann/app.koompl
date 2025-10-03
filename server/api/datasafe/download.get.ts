import { readFile, ensureTeamDatasafe } from '../../utils/datasafeStorage'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id

  if (!teamId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected'
    })
  }

  const query = getQuery(event)
  const path = typeof query.path === 'string' ? query.path : ''
  if (!path) {
    throw createError({ statusCode: 400, statusMessage: 'File path required' })
  }

  await ensureTeamDatasafe(teamId)
  const record = await readFile(teamId, path)
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  return {
    ok: true,
    file: {
      name: record.node.name,
      path: record.node.path,
      mimeType: record.file.mimeType,
      size: record.file.size,
      base64: record.file.data,
      encoding: record.file.encoding,
      source: record.file.source,
      ruleMatches: record.file.ruleMatches,
      metadata: record.file.metadata,
      updatedAt: record.file.updatedAt
    }
  }
})
