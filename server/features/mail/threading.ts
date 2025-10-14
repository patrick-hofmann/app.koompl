/**
 * Email Threading Utilities
 *
 * Handles conversation threading based on standard email headers (In-Reply-To, References)
 * and provides utilities for email processing.
 */

export interface ThreadingHeaders {
  inReplyTo?: string[]
  references?: string[]
}

/**
 * Extract threading headers from Mailgun webhook payload
 */
export function extractThreadingHeaders(payload: Record<string, unknown>): ThreadingHeaders {
  const result: ThreadingHeaders = {
    inReplyTo: [],
    references: []
  }

  // Helper to get header value
  function getHeader(key: string): string | undefined {
    const value =
      payload[key] ||
      payload[key.toLowerCase()] ||
      payload[key.toUpperCase()] ||
      (payload.headers as Record<string, unknown>)?.[key] ||
      (payload.headers as Record<string, unknown>)?.[key.toLowerCase()]

    return value ? String(value).trim() : undefined
  }

  // Extract In-Reply-To header
  const inReplyTo = getHeader('In-Reply-To') || getHeader('in-reply-to')
  if (inReplyTo) {
    // In-Reply-To can contain multiple message IDs separated by whitespace
    const messageIds = inReplyTo
      .split(/\s+/)
      .map((id) => id.replace(/^<|>$/g, '').trim())
      .filter((id) => id.length > 0)
    result.inReplyTo = messageIds
  }

  // Extract References header
  const references = getHeader('References') || getHeader('references')
  if (references) {
    // References contains a space-separated list of message IDs
    const messageIds = references
      .split(/\s+/)
      .map((id) => id.replace(/^<|>$/g, '').trim())
      .filter((id) => id.length > 0)
    result.references = messageIds
  }

  return result
}

/**
 * Build conversation ID from threading headers
 *
 * Strategy:
 * 1. If references exist, use the first (root) message ID
 * 2. Otherwise, if in-reply-to exists, use that
 * 3. Otherwise, this is a new conversation - use current message ID
 */
export function buildConversationId(
  currentMessageId: string,
  inReplyTo?: string[],
  references?: string[]
): string {
  // Clean message ID
  const cleanId = (id: string) => id.replace(/^<|>$/g, '').trim()

  // Use first reference as conversation root (it's the oldest message in the thread)
  if (references && references.length > 0) {
    return cleanId(references[0])
  }

  // Fall back to in-reply-to (this message is replying to that one)
  if (inReplyTo && inReplyTo.length > 0) {
    return cleanId(inReplyTo[0])
  }

  // This is a new conversation
  return cleanId(currentMessageId)
}

/**
 * Generate email excerpt for preview
 */
export function generateExcerpt(body: string, maxLength: number = 150): string {
  if (!body) return ''

  // Remove excessive whitespace and newlines
  const cleaned = body
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()

  // Truncate to max length
  if (cleaned.length <= maxLength) {
    return cleaned
  }

  // Find a good breaking point (space, punctuation)
  let breakPoint = maxLength
  const lastSpace = cleaned.lastIndexOf(' ', maxLength)
  const lastPeriod = cleaned.lastIndexOf('.', maxLength)
  const lastComma = cleaned.lastIndexOf(',', maxLength)

  // Use the closest natural break
  breakPoint = Math.max(lastSpace, lastPeriod, lastComma)
  if (breakPoint < maxLength * 0.7) {
    // If break is too early, just use max length
    breakPoint = maxLength
  }

  return cleaned.substring(0, breakPoint).trim() + '...'
}

/**
 * Extract all unique email addresses from participants
 */
export function extractParticipants(emails: Array<{ from: string; to: string }>): string[] {
  const participants = new Set<string>()

  for (const email of emails) {
    const fromEmail = extractEmailAddress(email.from)
    const toEmail = extractEmailAddress(email.to)

    if (fromEmail) participants.add(fromEmail)
    if (toEmail) participants.add(toEmail)
  }

  return Array.from(participants)
}

/**
 * Extract email address from "Name <email@domain.com>" format
 */
export function extractEmailAddress(header: string): string {
  if (!header) return ''

  // Handle "Name <email@domain.com>" format
  const match = header.match(/<([^>]+)>/)
  if (match) {
    return match[1].trim().toLowerCase()
  }

  // Handle plain email format
  return header.trim().toLowerCase()
}

/**
 * Normalize subject line for threading (remove Re:, Fwd:, etc.)
 */
export function normalizeSubject(subject: string): string {
  if (!subject) return ''

  return subject.replace(/^(Re|RE|re|Fwd|FWD|fwd):\s*/gi, '').trim()
}
