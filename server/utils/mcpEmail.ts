/**
 * Email MCP Implementation
 * Provides email access tools for agents following the same patterns as kanban/datasafe MCPs
 */

import type { InboundEmail, OutboundEmail } from '../types/mail'
import { mailStorage } from './mailStorage'

export interface EmailMcpContext {
  teamId: string
  userId: string
  agentId: string
}

export interface EmailListResult {
  emails: Array<{
    id: string
    messageId: string
    from: string
    to: string
    subject: string
    body: string
    timestamp: string
    direction: 'inbound' | 'outbound'
    hasAttachments?: boolean
    attachmentCount?: number
  }>
  total: number
  hasMore: boolean
}

export interface EmailDetailResult {
  id: string
  messageId: string
  from: string
  to: string
  subject: string
  body: string
  html?: string
  timestamp: string
  direction: 'inbound' | 'outbound'
  inReplyTo?: string[]
  references?: string[]
  attachments?: Array<{
    filename: string
    mimeType: string
    size: number
    storedPath: string
  }>
}

/**
 * List emails for the current user with optional filtering
 */
export async function listEmails(
  context: EmailMcpContext,
  options: {
    limit?: number
    offset?: number
    startDate?: string
    endDate?: string
    from?: string
    subject?: string
    direction?: 'inbound' | 'outbound' | 'all'
  } = {}
): Promise<EmailListResult> {
  const { limit = 20, offset = 0, startDate, endDate, from, subject, direction = 'all' } = options

  try {
    // Get emails for the user
    const logs = await mailStorage.getLogsForAgent(context.agentId, limit + offset + 10)

    // Filter emails based on criteria
    const filteredEmails = logs.filter((log) => {
      // Direction filter
      if (direction !== 'all') {
        const emailDirection = log.type === 'inbound' ? 'inbound' : 'outbound'
        if (emailDirection !== direction) return false
      }

      // Date filters
      if (startDate && log.timestamp < startDate) return false
      if (endDate && log.timestamp > endDate) return false

      // From filter (case insensitive)
      if (from && !log.from.toLowerCase().includes(from.toLowerCase())) return false

      // Subject filter (case insensitive)
      if (subject && !log.subject.toLowerCase().includes(subject.toLowerCase())) return false

      return true
    })

    // Apply offset and limit
    const total = filteredEmails.length
    const paginatedEmails = filteredEmails.slice(offset, offset + limit)

    // Convert to result format
    const result: EmailListResult = {
      emails: paginatedEmails.map((log) => ({
        id: log.id,
        messageId: log.messageId || '',
        from: log.from,
        to: log.to || '',
        subject: log.subject,
        body: log.body,
        timestamp: log.timestamp,
        direction: log.type === 'inbound' ? 'inbound' : 'outbound',
        hasAttachments: false, // TODO: Check for attachments
        attachmentCount: 0
      })),
      total,
      hasMore: offset + limit < total
    }

    return result
  } catch (error) {
    console.error('[EmailMCP] Error listing emails:', error)
    throw new Error('Failed to list emails')
  }
}

/**
 * Get detailed content of a specific email
 */
export async function getEmail(
  context: EmailMcpContext,
  emailId: string
): Promise<EmailDetailResult | null> {
  try {
    // Try to get the email from storage
    // First try inbound emails
    let email: InboundEmail | OutboundEmail | null = null
    let direction: 'inbound' | 'outbound' = 'inbound'

    try {
      email = await mailStorage.getInboundEmail(emailId)
      direction = 'inbound'
    } catch {
      try {
        email = await mailStorage.getOutboundEmail(emailId)
        direction = 'outbound'
      } catch {
        // Email not found
        return null
      }
    }

    if (!email) return null

    // Convert to result format
    const result: EmailDetailResult = {
      id: email.id,
      messageId: email.messageId,
      from: email.from,
      to: email.to,
      subject: email.subject,
      body: email.body,
      html: 'html' in email ? email.html : undefined,
      timestamp: email.timestamp,
      direction,
      inReplyTo: 'inReplyTo' in email ? email.inReplyTo : undefined,
      references: 'references' in email ? email.references : undefined,
      attachments: [] // TODO: Get attachments from datasafe
    }

    return result
  } catch (error) {
    console.error('[EmailMCP] Error getting email:', error)
    throw new Error('Failed to get email')
  }
}

/**
 * Search emails by content, subject, or sender
 */
export async function searchEmails(
  context: EmailMcpContext,
  query: string,
  limit: number = 10
): Promise<EmailListResult> {
  try {
    const searchTerm = query.toLowerCase()

    // Get recent emails for search
    const logs = await mailStorage.getLogsForAgent(context.agentId, 100)

    // Filter emails that match the search query
    const matchingEmails = logs.filter((log) => {
      return (
        log.subject.toLowerCase().includes(searchTerm) ||
        log.body.toLowerCase().includes(searchTerm) ||
        log.from.toLowerCase().includes(searchTerm)
      )
    })

    // Convert to result format
    const result: EmailListResult = {
      emails: matchingEmails.slice(0, limit).map((log) => ({
        id: log.id,
        messageId: log.messageId || '',
        from: log.from,
        to: log.to || '',
        subject: log.subject,
        body: log.body,
        timestamp: log.timestamp,
        direction: log.type === 'inbound' ? 'inbound' : 'outbound',
        hasAttachments: false,
        attachmentCount: 0
      })),
      total: matchingEmails.length,
      hasMore: matchingEmails.length > limit
    }

    return result
  } catch (error) {
    console.error('[EmailMCP] Error searching emails:', error)
    throw new Error('Failed to search emails')
  }
}

/**
 * Get email thread/conversation
 */
export async function getEmailThread(
  context: EmailMcpContext,
  threadId: string
): Promise<EmailListResult> {
  try {
    // Get all emails and filter by thread
    const logs = await mailStorage.getLogsForAgent(context.agentId, 100)

    // Find emails that belong to the same thread
    const threadEmails = logs.filter((log) => {
      // Check if this email is part of the thread
      return (
        log.messageId === threadId ||
        (log.inReplyTo && log.inReplyTo.includes(threadId)) ||
        (log.references && log.references.some((ref) => ref.includes(threadId)))
      )
    })

    // Sort by timestamp
    threadEmails.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Convert to result format
    const result: EmailListResult = {
      emails: threadEmails.map((log) => ({
        id: log.id,
        messageId: log.messageId || '',
        from: log.from,
        to: log.to || '',
        subject: log.subject,
        body: log.body,
        timestamp: log.timestamp,
        direction: log.type === 'inbound' ? 'inbound' : 'outbound',
        hasAttachments: false,
        attachmentCount: 0
      })),
      total: threadEmails.length,
      hasMore: false
    }

    return result
  } catch (error) {
    console.error('[EmailMCP] Error getting email thread:', error)
    throw new Error('Failed to get email thread')
  }
}

/**
 * Get attachments from a specific email
 */
export async function getEmailAttachments(
  _context: EmailMcpContext,
  _emailId: string
): Promise<
  Array<{
    filename: string
    mimeType: string
    size: number
    storedPath: string
  }>
> {
  try {
    // TODO: Implement attachment retrieval from datasafe
    // This would require:
    // 1. Finding the email in storage
    // 2. Getting attachment metadata
    // 3. Looking up attachments in datasafe
    // 4. Returning attachment information

    // For now, return empty array
    return []
  } catch (error) {
    console.error('[EmailMCP] Error getting email attachments:', error)
    throw new Error('Failed to get email attachments')
  }
}
