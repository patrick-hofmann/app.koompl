import { storeFile, ensureTeamDatasafe } from '../../utils/datasafeStorage'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id

  if (!teamId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected'
    })
  }

  const form = await readMultipartFormData(event)
  if (!form || !form.length) {
    throw createError({ statusCode: 400, statusMessage: 'Multipart form data required' })
  }

  const filePart = form.find((part) => part.filename)
  if (!filePart || !filePart.data) {
    throw createError({ statusCode: 400, statusMessage: 'File upload missing' })
  }

  const folderPart = form.find((part) => part.name === 'folder')
  const overwritePart = form.find((part) => part.name === 'overwrite')
  const explicitName = form.find((part) => part.name === 'name')

  const folder = folderPart?.data?.toString('utf8')?.trim() || ''
  const overwrite = overwritePart?.data?.toString('utf8') === 'true'
  const filename = explicitName?.data?.toString('utf8')?.trim() || filePart.filename || 'upload'

  const buffer = filePart.data
  const base64 = Buffer.from(buffer).toString('base64')
  const mimeType = filePart.type || 'application/octet-stream'
  const size = buffer.length

  await ensureTeamDatasafe(teamId)

  const node = await storeFile(teamId, [folder, filename].filter(Boolean).join('/'), {
    base64,
    mimeType,
    size,
    source: 'ui-upload',
    metadata: {
      uploadedBy: session.user?.id,
      uploadedAt: new Date().toISOString()
    },
    overwrite
  })

  return {
    ok: true,
    node
  }
})
