/**
 * Mail Attachment Storage
 *
 * Handles storage and retrieval of email attachments separately from emails.
 * Attachments are stored in the mail storage bucket, organized by message-id.
 */

import type { EmailAttachment } from '../../types/mail'

const storage = useStorage('mail')

/**
 * Stored attachment with binary data
 */
export interface StoredAttachment extends EmailAttachment {
  /** Base64-encoded attachment data */
  data: string
  /** Message ID this attachment belongs to */
  messageId: string
}

/**
 * Store an attachment for a specific message
 */
export async function storeAttachment(
  messageId: string,
  attachment: {
    filename: string
    data: string // base64
    mimeType: string
    size: number
    inline?: boolean
    contentId?: string
  }
): Promise<EmailAttachment> {
  const attachmentId = `${messageId}-${attachment.filename}`
  const sanitizedFilename = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storageKey = `attachments/${messageId}/${sanitizedFilename}.json`

  const storedAttachment: StoredAttachment = {
    id: attachmentId,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    inline: attachment.inline,
    contentId: attachment.contentId,
    data: attachment.data,
    messageId
  }

  await storage.setItem(storageKey, storedAttachment)

  console.log(
    `[MailAttachmentStorage] ✓ Stored attachment: ${attachment.filename} for message ${messageId}`
  )

  // Return attachment metadata without data
  return {
    id: attachmentId,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    inline: attachment.inline,
    contentId: attachment.contentId
  }
}

/**
 * Get all attachments for a specific message
 */
export async function listAttachments(messageId: string): Promise<EmailAttachment[]> {
  const attachmentKeys = await storage.getKeys(`attachments/${messageId}/`)
  const attachments: EmailAttachment[] = []

  for (const key of attachmentKeys) {
    try {
      const stored = await storage.getItem<StoredAttachment>(key)
      if (stored) {
        // Return metadata without data
        attachments.push({
          id: stored.id,
          filename: stored.filename,
          mimeType: stored.mimeType,
          size: stored.size,
          inline: stored.inline,
          contentId: stored.contentId
        })
      }
    } catch (error) {
      console.error(`[MailAttachmentStorage] Failed to load attachment from ${key}:`, error)
    }
  }

  return attachments
}

/**
 * Get a specific attachment with its data
 */
export async function getAttachment(
  messageId: string,
  filename: string
): Promise<StoredAttachment | null> {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storageKey = `attachments/${messageId}/${sanitizedFilename}.json`

  try {
    const stored = await storage.getItem<StoredAttachment>(storageKey)
    return stored || null
  } catch (error) {
    console.error(
      `[MailAttachmentStorage] Failed to get attachment ${filename} for ${messageId}:`,
      error
    )
    return null
  }
}

/**
 * Get attachment by ID (format: messageId-filename)
 */
export async function getAttachmentById(attachmentId: string): Promise<StoredAttachment | null> {
  // Parse attachment ID to extract message ID and filename
  const lastDashIndex = attachmentId.lastIndexOf('-')
  if (lastDashIndex === -1) {
    return null
  }

  const messageId = attachmentId.substring(0, lastDashIndex)
  const filename = attachmentId.substring(lastDashIndex + 1)

  return await getAttachment(messageId, filename)
}

/**
 * Delete all attachments for a specific message
 */
export async function deleteAttachments(messageId: string): Promise<number> {
  const attachmentKeys = await storage.getKeys(`attachments/${messageId}/`)
  let deletedCount = 0

  for (const key of attachmentKeys) {
    try {
      await storage.removeItem(key)
      deletedCount++
    } catch (error) {
      console.error(`[MailAttachmentStorage] Failed to delete attachment ${key}:`, error)
    }
  }

  if (deletedCount > 0) {
    console.log(
      `[MailAttachmentStorage] ✓ Deleted ${deletedCount} attachments for message ${messageId}`
    )
  }

  return deletedCount
}

/**
 * Check if an attachment exists
 */
export async function attachmentExists(messageId: string, filename: string): Promise<boolean> {
  const attachment = await getAttachment(messageId, filename)
  return attachment !== null
}
