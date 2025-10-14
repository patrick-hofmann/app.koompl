/**
 * Download email attachment by message ID and filename
 */

import { getAttachment } from '../../../../features/mail'

export default defineEventHandler(async (event) => {
  const messageId = getRouterParam(event, 'messageId')
  const filename = getRouterParam(event, 'filename')

  if (!messageId || !filename) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing message ID or filename'
    })
  }

  console.log(`[AttachmentDownload] Fetching attachment: ${messageId}/${filename}`)

  // Get the attachment from storage
  const attachment = await getAttachment(messageId, filename)

  if (!attachment) {
    throw createError({
      statusCode: 404,
      statusMessage: `Attachment not found: ${filename} in message ${messageId}`
    })
  }

  // Convert base64 to buffer
  const buffer = Buffer.from(attachment.data, 'base64')

  // Set response headers for download
  setResponseHeader(event, 'Content-Type', attachment.mimeType || 'application/octet-stream')
  setResponseHeader(event, 'Content-Length', buffer.length.toString())
  setResponseHeader(
    event,
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(attachment.filename)}"`
  )

  console.log(`[AttachmentDownload] ✓ Sending attachment: ${filename} (${buffer.length} bytes)`)

  return buffer
})
