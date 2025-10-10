import { downloadFile } from '../../features/datasafe'

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

  const context = { teamId, userId: session.user?.id }
  const { base64, node } = await downloadFile(context, path)

  return {
    ok: true,
    file: {
      name: node.name,
      path: node.path,
      mimeType: node.mimeType,
      size: node.size,
      base64,
      encoding: 'base64',
      source: node.source,
      ruleMatches: node.ruleMatches,
      metadata: node.metadata,
      updatedAt: node.updatedAt
    }
  }
})
