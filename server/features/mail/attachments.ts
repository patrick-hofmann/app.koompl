/**
 * Mail Attachments - Centralized attachment handling for emails
 *
 * This module handles extraction, validation, and storage of email attachments
 * to the datasafe, keeping the mail feature responsible for all email-related operations.
 */

import type { EmailAttachment } from '../../types/mail'

/**
 * Result of processing email attachments
 */
export interface ProcessedAttachments {
  /** Attachment metadata for email storage */
  attachments: EmailAttachment[]
  /** Count of successfully stored attachments */
  storedCount: number
}

/**
 * Process and store email attachments from a Mailgun payload
 *
 * @param payload - The Mailgun webhook payload containing attachments
 * @param context - Context for storing attachments
 * @returns Processed attachment information
 */
export async function processEmailAttachments(
  payload: Record<string, unknown>,
  context: {
    teamId: string
    messageId: string
    from: string
    subject: string
  }
): Promise<ProcessedAttachments> {
  const result: ProcessedAttachments = {
    attachments: [],
    storedCount: 0
  }

  try {
    // Import mail attachment storage
    const { storeAttachment } = await import('./attachment-storage')

    // Import mailgun helpers
    const { getAttachmentStats, validateAttachment, extractMailgunAttachments } = await import(
      '../../utils/mailgunHelpers'
    )

    // Check if there are any attachments
    const stats = getAttachmentStats(payload)
    console.log(
      `[MailAttachments] Attachment stats: ${stats.totalCount} attachments, ${stats.totalSize} bytes`
    )

    if (!stats.hasAttachments) {
      return result
    }

    // Extract attachments from Mailgun payload
    const attachments = extractMailgunAttachments(payload)
    const validAttachments = []

    // Validate each attachment
    for (const attachment of attachments) {
      const validation = validateAttachment(attachment)
      if (validation.isValid) {
        validAttachments.push(attachment)
      } else {
        console.warn(
          `[MailAttachments] Skipping invalid attachment ${attachment.filename}:`,
          validation.errors
        )
      }
    }

    console.log(`[MailAttachments] Processing ${validAttachments.length} valid attachments`)

    // Store each valid attachment to mail storage
    for (const attachment of validAttachments) {
      try {
        const attachmentMetadata = await storeAttachment(context.messageId, {
          filename: attachment.filename,
          data: attachment.data,
          mimeType: attachment.mimeType,
          size: attachment.size,
          inline: false
        })

        result.attachments.push(attachmentMetadata)
        result.storedCount++

        console.log(
          `[MailAttachments] ✓ Stored attachment: ${attachment.filename} (${attachment.size} bytes) for message ${context.messageId}`
        )
      } catch (storeErr) {
        console.error(
          `[MailAttachments] Failed to store attachment ${attachment.filename}:`,
          storeErr
        )
      }
    }

    console.log(
      `[MailAttachments] ✓ Successfully processed ${result.storedCount}/${validAttachments.length} attachments`
    )
  } catch (error) {
    console.error('[MailAttachments] Failed to process attachments:', error)
  }

  return result
}

/**
 * Parse attachments from MCP arguments (for reply/forward operations)
 *
 * This handles attachments that may be:
 * - Inline base64 data
 * - References to datasafe files
 * - References to email attachments (message-id + filename)
 *
 * @param args - MCP tool arguments
 * @param teamId - Team ID for datasafe access
 * @param userId - User ID for datasafe access
 * @returns Array of parsed attachments ready for sending
 */
export async function parseAttachmentsFromMCP(
  args: Record<string, unknown>,
  teamId: string,
  userId: string
): Promise<
  Array<{
    filename: string
    data: string
    encoding: 'base64'
    mimeType: string
    size: number
  }>
> {
  const attachments: Array<{
    filename: string
    data: string
    encoding: 'base64'
    mimeType: string
    size: number
  }> = []

  if (!args.attachments || !Array.isArray(args.attachments)) {
    return attachments
  }

  for (const att of args.attachments) {
    if (!att || typeof att !== 'object') {
      continue
    }

    const filename = String(att.filename || `attachment-${Date.now()}.bin`)
    let data = String(att.data || '')
    let mimeType = String(att.mimeType || 'application/octet-stream')
    let size = typeof att.size === 'number' ? att.size : 0

    // Priority 1: Check for email storage reference (message_id + filename)
    if (att.email_message_id && typeof att.email_message_id === 'string') {
      const messageId = String(att.email_message_id)
      const attFilename = att.email_filename ? String(att.email_filename) : filename

      console.log(
        `[MailAttachments] Fetching attachment from email storage: ${messageId}/${attFilename}`
      )
      try {
        const { getAttachment } = await import('./attachment-storage')
        const stored = await getAttachment(messageId, attFilename)

        if (stored) {
          data = stored.data
          mimeType = stored.mimeType
          size = stored.size
          console.log(
            `[MailAttachments] ✓ Fetched ${attFilename} from email storage (${size} bytes)`
          )
        } else {
          console.error(`[MailAttachments] Email attachment not found: ${messageId}/${attFilename}`)
          continue
        }
      } catch (fetchError) {
        console.error(
          `[MailAttachments] Failed to fetch from email storage: ${messageId}/${attFilename}`,
          fetchError
        )
        continue
      }
    } else if (att.datasafe_path && typeof att.datasafe_path === 'string') {
      // Priority 2: Check for datasafe reference
      console.log(`[MailAttachments] Fetching attachment from datasafe: ${att.datasafe_path}`)
      try {
        const { downloadDatasafeFile } = await import('../../api/mcp/builtin-datasafe/operations')
        const { base64, node } = await downloadDatasafeFile(
          { teamId, userId, agentId: userId },
          att.datasafe_path
        )
        data = base64
        mimeType = node.mimeType || mimeType
        size = node.size || Buffer.from(base64, 'base64').length
        console.log(`[MailAttachments] ✓ Fetched ${filename} from datasafe (${size} bytes)`)
      } catch (fetchError) {
        console.error(
          `[MailAttachments] Failed to fetch from datasafe: ${att.datasafe_path}`,
          fetchError
        )
        continue
      }
    } else if (!data) {
      // Priority 3: Use inline data
      continue // No data and no references, skip
    }

    if (!size) {
      size = Buffer.from(data, 'base64').length
    }

    if (data) {
      attachments.push({
        filename,
        data,
        encoding: 'base64',
        mimeType,
        size
      })
    }
  }

  console.log(`[MailAttachments] Parsed ${attachments.length} attachments from MCP`)
  return attachments
}
