/**
 * Mail Feature - Centralized Email Handling
 *
 * This module provides a unified interface for all email operations including:
 * - Storing inbound/outbound emails
 * - Retrieving emails and conversations
 * - Managing email logs
 * - Threading and conversation management
 *
 * All API endpoints should use these functions rather than directly accessing storage.
 */

import type { Mail } from '~/types'
import type {
  MailLogEntry,
  InboundEmail,
  OutboundEmail,
  EmailConversation,
  EmailAttachment
} from '../../types/mail'
import { mailStorage } from './storage'
import {
  buildConversationId,
  generateExcerpt,
  extractThreadingHeaders,
  extractParticipants,
  extractEmailAddress,
  normalizeSubject
} from './threading'
import {
  processEmailAttachments,
  parseAttachmentsFromMCP,
  type ProcessedAttachments
} from './attachments'
import {
  listAttachments as listAttachmentsFromStorage,
  getAttachment as getAttachmentFromStorage,
  getAttachmentById as getAttachmentByIdFromStorage,
  deleteAttachments as deleteAttachmentsFromStorage,
  attachmentExists as checkAttachmentExists,
  type StoredAttachment
} from './attachment-storage'

/**
 * Mail context for scoping operations
 */
export interface MailContext {
  teamId?: string
  agentId?: string
  userId?: string
}

/**
 * Parameters for storing an inbound email
 */
export interface StoreInboundEmailParams {
  messageId: string
  from: string
  to: string
  subject: string
  body: string
  html?: string
  inReplyTo?: string[]
  references?: string[]
  agentId?: string
  agentEmail?: string
  teamId?: string
  conversationId?: string
  mcpContexts?: unknown[]
  rawPayload?: Record<string, unknown>
  attachments?: EmailAttachment[]
}

/**
 * Parameters for storing an outbound email
 */
export interface StoreOutboundEmailParams {
  messageId: string
  from: string
  to: string
  subject: string
  body: string
  agentId: string
  agentEmail: string
  teamId?: string
  conversationId?: string
  inReplyTo?: string
  references?: string[]
  usedOpenAI: boolean
  mailgunSent: boolean
  mcpServerIds?: string[]
  mcpContextCount?: number
  attachments?: EmailAttachment[]
  isAutomatic?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Store an inbound email (from Mailgun webhook)
 */
export async function storeInboundEmail(params: StoreInboundEmailParams): Promise<InboundEmail> {
  return await mailStorage.storeInboundEmail(params)
}

/**
 * Update inbound email context after agent resolution
 * (Does not create a duplicate log entry)
 */
export async function updateInboundEmailContext(params: {
  messageId: string
  agentId?: string
  agentEmail?: string
  mcpContexts?: unknown[]
  attachments?: EmailAttachment[]
}): Promise<void> {
  return await mailStorage.updateInboundEmailContext(params)
}

/**
 * Store an outbound email (agent response)
 */
export async function storeOutboundEmail(params: StoreOutboundEmailParams): Promise<OutboundEmail> {
  return await mailStorage.storeOutboundEmail(params)
}

// ═══════════════════════════════════════════════════════════════════════════
// RETRIEVAL OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get an inbound email by message ID
 */
export async function getInboundEmail(messageId: string): Promise<InboundEmail | null> {
  return await mailStorage.getInboundEmailByMessageId(messageId)
}

/**
 * Get an outbound email by message ID
 */
export async function getOutboundEmail(messageId: string): Promise<OutboundEmail | null> {
  return await mailStorage.getOutboundEmailByMessageId(messageId)
}

/**
 * Get any email (inbound or outbound) by message ID
 */
export async function getEmail(
  messageId: string
): Promise<{ email: InboundEmail | OutboundEmail; type: 'inbound' | 'outbound' } | null> {
  return await mailStorage.getEmailByMessageId(messageId)
}

/**
 * Get all emails for a specific agent
 */
export async function getAgentEmails(
  context: MailContext
): Promise<{ incoming: Mail[]; outgoing: Mail[] }> {
  if (!context.agentId) {
    return { incoming: [], outgoing: [] }
  }
  return await mailStorage.getAgentEmails(context.agentId)
}

/**
 * Get conversations for a specific agent
 */
export async function getAgentConversations(
  context: MailContext,
  limit: number = 50
): Promise<EmailConversation[]> {
  if (!context.agentId) {
    return []
  }
  return await mailStorage.getAgentConversations(context.agentId, limit)
}

/**
 * Get all emails in a conversation
 */
export async function getConversationEmails(
  context: MailContext,
  conversationId: string
): Promise<Array<InboundEmail | OutboundEmail>> {
  if (!context.agentId) {
    return []
  }
  return await mailStorage.getConversationEmails(conversationId, context.agentId)
}

/**
 * Mark conversation as read
 */
export async function markConversationRead(
  context: MailContext,
  conversationId: string
): Promise<void> {
  if (!context.agentId) {
    return
  }
  return await mailStorage.markConversationAsRead(context.agentId, conversationId)
}

// ═══════════════════════════════════════════════════════════════════════════
// LOG OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get email logs for a specific agent
 */
export async function getAgentLogs(context: MailContext, limit = 100): Promise<MailLogEntry[]> {
  if (!context.agentId) {
    return []
  }
  return await mailStorage.getLogsForAgent(context.agentId, limit)
}

/**
 * Get recent emails for stats/dashboard
 */
export async function getRecentEmails(
  limit = 50,
  type?: 'inbound' | 'outgoing'
): Promise<MailLogEntry[]> {
  return await mailStorage.getRecentEmails(limit, type)
}

/**
 * Get all logs (internal use only - for debugging/admin)
 */
export async function getAllLogs(): Promise<MailLogEntry[]> {
  return await mailStorage['getAllLogs']()
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clear all emails for a specific agent
 */
export async function clearAgentEmails(context: MailContext): Promise<{ deletedCount: number }> {
  if (!context.agentId) {
    return { deletedCount: 0 }
  }
  return await mailStorage.clearAgentEmails(context.agentId)
}

/**
 * Clear all logs for a specific agent
 */
export async function clearAgentLogs(context: MailContext): Promise<{ deletedCount: number }> {
  if (!context.agentId) {
    return { deletedCount: 0 }
  }
  return await mailStorage.clearAgentLogs(context.agentId)
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTACHMENT HANDLING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Process and store email attachments from Mailgun payload
 * Extracts attachments, validates them, and stores to mail storage
 */
export async function storeEmailAttachments(
  payload: Record<string, unknown>,
  context: {
    teamId: string
    messageId: string
    from: string
    subject: string
  }
): Promise<ProcessedAttachments> {
  return await processEmailAttachments(payload, context)
}

/**
 * List all attachments for a specific email message
 */
export async function listAttachments(messageId: string): Promise<EmailAttachment[]> {
  return await listAttachmentsFromStorage(messageId)
}

/**
 * Get a specific attachment with its data
 */
export async function getAttachment(
  messageId: string,
  filename: string
): Promise<StoredAttachment | null> {
  return await getAttachmentFromStorage(messageId, filename)
}

/**
 * Get attachment by ID (format: messageId-filename)
 */
export async function getAttachmentById(attachmentId: string): Promise<StoredAttachment | null> {
  return await getAttachmentByIdFromStorage(attachmentId)
}

/**
 * Check if an attachment exists
 */
export async function attachmentExists(messageId: string, filename: string): Promise<boolean> {
  return await checkAttachmentExists(messageId, filename)
}

/**
 * Delete all attachments for a message
 */
export async function deleteAttachments(messageId: string): Promise<number> {
  return await deleteAttachmentsFromStorage(messageId)
}

/**
 * Parse attachments from MCP arguments
 * Handles inline base64 data and email storage references
 */
export async function parseAttachments(
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
  return await parseAttachmentsFromMCP(args, teamId, userId)
}

// ═══════════════════════════════════════════════════════════════════════════
// THREADING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build conversation ID from email headers
 */
export function createConversationId(
  currentMessageId: string,
  inReplyTo?: string[],
  references?: string[]
): string {
  return buildConversationId(currentMessageId, inReplyTo, references)
}

/**
 * Extract threading headers from Mailgun payload
 */
export function parseThreadingHeaders(payload: Record<string, unknown>) {
  return extractThreadingHeaders(payload)
}

/**
 * Generate email excerpt for preview
 */
export function createExcerpt(body: string, maxLength?: number): string {
  return generateExcerpt(body, maxLength)
}

/**
 * Extract unique participants from emails
 */
export function getParticipants(emails: Array<{ from: string; to: string }>): string[] {
  return extractParticipants(emails)
}

/**
 * Extract email address from header
 */
export function parseEmailAddress(header: string): string {
  return extractEmailAddress(header)
}

/**
 * Normalize subject line for threading
 */
export function parseSubject(subject: string): string {
  return normalizeSubject(subject)
}

// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Migration helper: Convert existing data to unified format
 */
export async function migrateExistingData(): Promise<void> {
  return await mailStorage.migrateExistingData()
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type {
  MailLogEntry,
  InboundEmail,
  OutboundEmail,
  EmailConversation,
  EmailAttachment,
  AgentEmailIndex
} from '../../types/mail'

export type { ThreadingHeaders } from './threading'
export type { ProcessedAttachments } from './attachments'
export type { StoredAttachment } from './attachment-storage'
