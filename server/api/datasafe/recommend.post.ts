import { recommendPlacement } from '../../features/datasafe'
import type { DatasafeAttachmentContext } from '../../types/datasafe'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id

  if (!teamId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected'
    })
  }

  const body = await readBody<Partial<DatasafeAttachmentContext>>(event)
  if (!body?.filename || !body.mimeType || typeof body.size !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'Missing file metadata' })
  }

  const context = { teamId, userId: session.user?.id }
  const recommendation = await recommendPlacement(context, {
    filename: body.filename,
    mimeType: body.mimeType,
    size: body.size,
    data: body.data || '',
    encoding: 'base64',
    source: body.source || 'ui-upload',
    emailMeta: body.emailMeta,
    tags: body.tags,
    ruleHints: body.ruleHints
  })

  return {
    ok: true,
    recommendation
  }
})
