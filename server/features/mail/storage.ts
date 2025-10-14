/**
 * Unified Mail Storage System
 *
 * This module provides a centralized way to store and retrieve all email data
 * for agents, including incoming emails, outgoing emails, and activity logs.
 */

import type { Agent, Mail } from '~/types'
import type {
  MailLogEntry,
  InboundEmail,
  OutboundEmail,
  EmailConversation,
  AgentEmailIndex,
  EmailAttachment
} from '../../types/mail'
import { buildConversationId, generateExcerpt } from './threading'

function mapAttachments(attachments?: EmailAttachment[]): EmailAttachment[] | undefined {
  if (!attachments || attachments.length === 0) {
    return undefined
  }

  return attachments.map((attachment, index) => ({
    id: attachment.id ?? `att-${index}-${Date.now()}`,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    storageKey: attachment.storageKey,
    datasafePath: attachment.datasafePath,
    inline: attachment.inline,
    contentId: attachment.contentId
  }))
}

export class UnifiedMailStorage {
  private storage = useStorage('mail')
  private emailMount = useStorage('email-mount-point')

  /**
   * Store an inbound email (from Mailgun webhook)
   */
  async storeInboundEmail(data: {
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
  }): Promise<InboundEmail> {
    const id = `inbound-${data.messageId}`
    const timestamp = new Date().toISOString()

    // Build conversation ID if not provided
    const conversationId =
      data.conversationId || buildConversationId(data.messageId, data.inReplyTo, data.references)

    const inboundEmail: InboundEmail = {
      id,
      timestamp,
      messageId: data.messageId,
      from: data.from,
      to: data.to,
      subject: data.subject,
      body: data.body,
      html: data.html,
      inReplyTo: data.inReplyTo,
      references: data.references,
      agentId: data.agentId,
      agentEmail: data.agentEmail,
      teamId: data.teamId,
      conversationId,
      mcpContexts: data.mcpContexts,
      rawPayload: data.rawPayload,
      attachments: mapAttachments(data.attachments)
    }

    // Store individual inbound email
    await this.storage.setItem(`emails/inbound/${id}.json`, inboundEmail)

    if (data.agentId && data.teamId) {
      await this.persistEmailMountSnapshot({
        direction: 'inbound',
        email: inboundEmail,
        attachments: mapAttachments(data.attachments) ?? inboundEmail.attachments
      })
    }

    // Add to unified log
    await this.addToLog({
      id,
      timestamp,
      type: 'inbound',
      messageId: data.messageId,
      from: data.from,
      to: data.to,
      subject: data.subject,
      body: data.body,
      agentId: data.agentId,
      agentEmail: data.agentEmail,
      mcpServerIds: data.agentId ? await this.getAgentMcpServerIds(data.agentId) : [],
      mcpContextCount: data.mcpContexts?.length || 0,
      metadata: {
        hasHtml: !!data.html,
        hasRawPayload: !!data.rawPayload,
        hasThreadHeaders: Boolean(data.inReplyTo?.length || data.references?.length),
        conversationId,
        teamId: data.teamId
      }
    })

    // Update conversation index if agent is assigned
    if (data.agentId && data.teamId) {
      await this.updateAgentEmailIndex(data.agentId, data.teamId, inboundEmail, 'inbound')
    }

    return inboundEmail
  }

  /**
   * Update inbound email after agent resolution without creating a duplicate log entry
   */
  async updateInboundEmailContext(data: {
    messageId: string
    agentId?: string
    agentEmail?: string
    mcpContexts?: unknown[]
    attachments?: EmailAttachment[]
  }): Promise<void> {
    const id = `inbound-${data.messageId}`

    // Update stored inbound email snapshot
    const existing = await this.storage.getItem<InboundEmail>(`emails/inbound/${id}.json`)
    if (existing) {
      const updated: InboundEmail = {
        ...existing,
        agentId: data.agentId ?? existing.agentId,
        agentEmail: data.agentEmail ?? existing.agentEmail,
        mcpContexts: data.mcpContexts ?? existing.mcpContexts,
        attachments: mapAttachments(data.attachments) ?? existing.attachments
      }
      await this.storage.setItem(`emails/inbound/${id}.json`, updated)

      if (updated.agentId && updated.teamId) {
        await this.persistEmailMountSnapshot({
          direction: 'inbound',
          email: updated,
          attachments: mapAttachments(updated.attachments)
        })
      }
    }

    // Update unified log entry in-place (do not add a new one)
    const logs = await this.getAllLogs()
    const idx = logs.findIndex((l) => l.id === id && l.type === 'inbound')
    if (idx !== -1) {
      const entry = logs[idx]
      logs[idx] = {
        ...entry,
        agentId: data.agentId ?? entry.agentId,
        agentEmail: data.agentEmail ?? entry.agentEmail,
        mcpContextCount: Array.isArray(data.mcpContexts)
          ? data.mcpContexts.length
          : entry.mcpContextCount
      }
      // Keep only most recent 1000 entries after update
      const sortedLogs = logs
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 1000)
      await this.storage.setItem('logs/unified.json', sortedLogs)
    }
  }

  /**
   * Store an outbound email (agent response)
   */
  async storeOutboundEmail(data: {
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
    isAutomatic?: boolean // true for automatic responses, false for manual responses
  }): Promise<OutboundEmail> {
    const id = `outbound-${data.messageId}`
    const timestamp = new Date().toISOString()

    // Build conversation ID if not provided
    const conversationId =
      data.conversationId ||
      buildConversationId(
        data.messageId,
        data.inReplyTo ? [data.inReplyTo] : undefined,
        data.references
      )

    const outboundEmail: OutboundEmail = {
      id,
      timestamp,
      messageId: data.messageId,
      from: data.from,
      to: data.to,
      subject: data.subject,
      body: data.body,
      agentId: data.agentId,
      agentEmail: data.agentEmail,
      teamId: data.teamId,
      conversationId,
      inReplyTo: data.inReplyTo,
      references: data.references,
      usedOpenAI: data.usedOpenAI,
      mailgunSent: data.mailgunSent,
      mcpServerIds: data.mcpServerIds,
      mcpContextCount: data.mcpContextCount,
      isAutomatic: data.isAutomatic,
      attachments: mapAttachments(data.attachments)
    }

    // Store individual outbound email
    await this.storage.setItem(`emails/outbound/${id}.json`, outboundEmail)

    if (data.teamId) {
      await this.persistEmailMountSnapshot({
        direction: 'outbound',
        email: outboundEmail,
        attachments: outboundEmail.attachments
      })
    }

    // Add to unified log
    await this.addToLog({
      id,
      timestamp,
      type: 'outgoing',
      messageId: data.messageId,
      from: data.from,
      to: data.to,
      subject: data.subject,
      body: data.body,
      agentId: data.agentId,
      agentEmail: data.agentEmail,
      usedOpenAI: data.usedOpenAI,
      mailgunSent: data.mailgunSent,
      mcpServerIds: data.mcpServerIds,
      mcpContextCount: data.mcpContextCount,
      metadata: {
        isAutomatic: data.isAutomatic,
        conversationId,
        teamId: data.teamId
      }
    })

    // Update conversation index
    if (data.teamId) {
      await this.updateAgentEmailIndex(data.agentId, data.teamId, outboundEmail, 'outbound')
    }

    return outboundEmail
  }

  /**
   * Get an inbound email by message-id
   */
  async getInboundEmailByMessageId(messageId: string): Promise<InboundEmail | null> {
    const id = `inbound-${messageId}`
    const email = await this.storage.getItem<InboundEmail>(`emails/inbound/${id}.json`)
    return email || null
  }

  /**
   * Get an outbound email by message-id
   */
  async getOutboundEmailByMessageId(messageId: string): Promise<OutboundEmail | null> {
    const id = `outbound-${messageId}`
    const email = await this.storage.getItem<OutboundEmail>(`emails/outbound/${id}.json`)
    return email || null
  }

  /**
   * Get any email (inbound or outbound) by message-id
   */
  async getEmailByMessageId(
    messageId: string
  ): Promise<{ email: InboundEmail | OutboundEmail; type: 'inbound' | 'outbound' } | null> {
    // Try inbound first
    const inbound = await this.getInboundEmailByMessageId(messageId)
    if (inbound) {
      return { email: inbound, type: 'inbound' }
    }

    // Try outbound
    const outbound = await this.getOutboundEmailByMessageId(messageId)
    if (outbound) {
      return { email: outbound, type: 'outbound' }
    }

    return null
  }

  /**
   * Get all emails for a specific agent
   */
  async getAgentEmails(agentId: string): Promise<{ incoming: Mail[]; outgoing: Mail[] }> {
    const logs = await this.getLogsForAgent(agentId)
    const agent = await this.getAgent(agentId)

    if (!agent) {
      return { incoming: [], outgoing: [] }
    }

    const incoming: Mail[] = []
    const outgoing: Mail[] = []

    for (const log of logs) {
      if (log.type === 'inbound') {
        const inboundEmail = await this.storage.getItem<InboundEmail>(
          `emails/inbound/${log.id}.json`
        )
        if (inboundEmail) {
          incoming.push(this.formatAsMail(inboundEmail, 'inbound'))
        }
      } else if (log.type === 'outgoing') {
        const outboundEmail = await this.storage.getItem<OutboundEmail>(
          `emails/outbound/${log.id}.json`
        )
        if (outboundEmail) {
          outgoing.push(this.formatAsMail(outboundEmail, 'outbound'))
        }
      }
    }

    return { incoming, outgoing }
  }

  /**
   * Get email logs for a specific agent
   */
  async getLogsForAgent(agentId: string, limit = 100): Promise<MailLogEntry[]> {
    const allLogs = await this.getAllLogs()
    return allLogs
      .filter((log) => log.agentId === agentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  /**
   * Get recent emails for stats/dashboard
   */
  async getRecentEmails(limit = 50, type?: 'inbound' | 'outgoing'): Promise<MailLogEntry[]> {
    const allLogs = await this.getAllLogs()
    let filteredLogs = allLogs

    if (type) {
      filteredLogs = allLogs.filter((log) => log.type === type)
    }

    return filteredLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  /**
   * Private helper methods
   */
  private async addToLog(entry: MailLogEntry): Promise<void> {
    const allLogs = await this.getAllLogs()
    allLogs.push(entry)

    // Keep only the most recent 1000 entries to prevent storage bloat
    const sortedLogs = allLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 1000)

    await this.storage.setItem('logs/unified.json', sortedLogs)
  }

  private async getAllLogs(): Promise<MailLogEntry[]> {
    const logs = await this.storage.getItem<MailLogEntry[]>('logs/unified.json')
    return Array.isArray(logs) ? logs : []
  }

  private async getAgent(agentId: string): Promise<Agent | null> {
    const agentsStorage = useStorage('agents')
    const agents = await agentsStorage.getItem<Agent[]>('agents.json')
    return agents?.find((a) => a?.id === agentId) || null
  }

  private async getAgentMcpServerIds(agentId: string): Promise<string[]> {
    const agent = await this.getAgent(agentId)
    return agent?.mcpServerIds || []
  }

  private formatAsMail(
    email: InboundEmail | OutboundEmail,
    direction: 'inbound' | 'outbound'
  ): Mail {
    const isInbound = direction === 'inbound'
    const senderInfo = isInbound
      ? this.parseEmailHeader(email.from)
      : this.parseEmailHeader(email.to)
    const _recipientInfo = isInbound
      ? this.parseEmailHeader(email.to)
      : this.parseEmailHeader(email.from)

    return {
      id: parseInt(email.id.replace(/[^0-9]/g, '')) || Math.random(),
      unread: isInbound,
      from: {
        id: 0,
        name: senderInfo.name,
        email: senderInfo.email,
        avatar: {
          src: `https://i.pravatar.cc/128?u=${encodeURIComponent(senderInfo.email)}`,
          alt: senderInfo.name
        },
        status: 'online' as const,
        location: ''
      },
      subject: email.subject,
      body: email.body,
      date: email.timestamp
    }
  }

  private parseEmailHeader(header: string): { name: string; email: string } {
    // Handle "Name <email@domain.com>" format
    const match = header.match(/^([^<]+)<([^>]+)>$/)
    if (match) {
      return {
        name: match[1].trim().replace(/['"]/g, ''),
        email: match[2].trim()
      }
    }

    // Handle plain email format
    const email = header.trim()
    const name = email.split('@')[0]

    return { name, email }
  }

  /**
   * Migration helper: Convert existing data to unified format
   */
  async migrateExistingData(): Promise<void> {
    const agentsStorage = useStorage('agents')

    // Migrate existing email logs
    const existingLogs =
      await agentsStorage.getItem<Array<Record<string, unknown>>>('email:log.json')
    if (Array.isArray(existingLogs)) {
      for (const log of existingLogs) {
        const entry: MailLogEntry = {
          id: `migrated-${String(log.messageId || Math.random())}`,
          timestamp: String(log.timestamp || new Date().toISOString()),
          type: this.mapLogType(String(log.type || '')),
          messageId: String(log.messageId || ''),
          from: String(log.from || ''),
          to: String(log.to || ''),
          subject: String(log.subject || ''),
          body: '', // Not stored in old format
          agentId: String(log.agentId || ''),
          usedOpenAI: Boolean(log.usedOpenAI),
          mailgunSent: Boolean(log.mailgunSent),
          domainFiltered: Boolean(log.domainFiltered),
          mcpServerIds: Array.isArray(log.mcpServerIds) ? log.mcpServerIds.map(String) : [],
          mcpContextCount: Number(log.mcpContextCount || 0)
        }

        await this.addToLog(entry)
      }
    }

    // Migrate existing inbound snapshot
    const inboundSnapshot = await agentsStorage.getItem<Record<string, unknown>>('inbound.json')
    if (inboundSnapshot) {
      await this.storeInboundEmail({
        messageId: String(inboundSnapshot.messageId || ''),
        from: String(inboundSnapshot.from || ''),
        to: String(inboundSnapshot.to || ''),
        subject: String(inboundSnapshot.subject || ''),
        body: String(inboundSnapshot.text || ''),
        html: String(inboundSnapshot.html || ''),
        mcpContexts: Array.isArray(inboundSnapshot.mcpContexts) ? inboundSnapshot.mcpContexts : []
      })
    }
  }

  private mapLogType(oldType: string): MailLogEntry['type'] {
    switch (oldType) {
      case 'inbound_processed':
        return 'inbound_processed'
      case 'agent_respond':
        return 'outgoing'
      default:
        return 'inbound'
    }
  }

  /**
   * Clear all emails for a specific agent
   */
  async clearAgentEmails(agentId: string): Promise<{ deletedCount: number }> {
    console.log(`[MailStorage] Clearing all emails for agent ${agentId}`)

    let deletedCount = 0

    try {
      const pathsToDelete = new Set<string>()

      // Gather paths from unified logs
      const allLogs = await this.getAllLogs()
      const agentLogs = allLogs.filter((log) => log.agentId === agentId)

      for (const log of agentLogs) {
        if (log.type === 'inbound') {
          pathsToDelete.add(`emails/inbound/${log.id}.json`)
        } else if (log.type === 'outgoing') {
          pathsToDelete.add(`emails/outbound/${log.id}.json`)
        }
      }

      // Gather paths from conversation index (in case logs are missing)
      const index = await this.loadAgentEmailIndex(agentId)
      if (index) {
        for (const conversation of Object.values(index.conversations)) {
          for (const messageId of conversation.messageIds) {
            pathsToDelete.add(`emails/inbound/inbound-${messageId}.json`)
            pathsToDelete.add(`emails/outbound/outbound-${messageId}.json`)
          }
        }
      }

      // Remove collected email snapshots (verify ownership before deletion)
      for (const path of pathsToDelete) {
        const email = await this.storage.getItem<InboundEmail | OutboundEmail>(path)
        if (email && email.agentId === agentId) {
          await this.storage.removeItem(path)
          deletedCount++
        }
      }

      // Remove agent logs from unified log file
      const updatedLogs = allLogs.filter((log) => log.agentId !== agentId)
      await this.storage.setItem('logs/unified.json', updatedLogs)

      // Remove conversation index for this agent
      await this.storage.removeItem(`indexes/agents/${agentId}/conversations.json`)

      console.log(`[MailStorage] ✓ Cleared ${deletedCount} emails for agent ${agentId}`)

      return { deletedCount }
    } catch (error) {
      console.error(`[MailStorage] ✗ Failed to clear emails for agent ${agentId}:`, error)
      throw error
    }
  }

  /**
   * Clear all logs for a specific agent (email logs only)
   */
  async clearAgentLogs(agentId: string): Promise<{ deletedCount: number }> {
    console.log(`[MailStorage] Clearing all logs for agent ${agentId}`)

    try {
      const allLogs = await this.getAllLogs()
      const agentLogs = allLogs.filter((log) => log.agentId === agentId)

      // Remove logs from unified log file
      const updatedLogs = allLogs.filter((log) => log.agentId !== agentId)
      await this.storage.setItem('logs/unified.json', updatedLogs)

      console.log(`[MailStorage] ✓ Cleared ${agentLogs.length} logs for agent ${agentId}`)

      return { deletedCount: agentLogs.length }
    } catch (error) {
      console.error(`[MailStorage] ✗ Failed to clear logs for agent ${agentId}:`, error)
      throw error
    }
  }

  /**
   * Get conversations for a specific agent
   */
  async getAgentConversations(agentId: string, limit: number = 50): Promise<EmailConversation[]> {
    const agent = await this.getAgent(agentId)
    if (!agent?.teamId) {
      console.warn(`[MailStorage] Agent ${agentId} not found or has no team`)
      return []
    }

    const index = await this.loadAgentEmailIndex(agentId)
    if (!index) {
      return []
    }

    // Convert conversations object to array and sort by last message date
    const conversations = Object.values(index.conversations)
      .sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime())
      .slice(0, limit)

    return conversations
  }

  /**
   * Get all emails in a conversation
   */
  async getConversationEmails(
    conversationId: string,
    agentId: string
  ): Promise<Array<InboundEmail | OutboundEmail>> {
    const agent = await this.getAgent(agentId)
    if (!agent?.teamId) {
      throw new Error('Agent not found or has no team')
    }

    const index = await this.loadAgentEmailIndex(agentId)
    if (!index) {
      return []
    }

    const conversation = index.conversations[conversationId]
    if (!conversation) {
      return []
    }

    // Load all emails in the conversation
    const emails: Array<InboundEmail | OutboundEmail> = []
    for (const messageId of conversation.messageIds) {
      // Try inbound first
      const inbound = await this.storage.getItem<InboundEmail>(
        `emails/inbound/inbound-${messageId}.json`
      )
      if (inbound) {
        emails.push(inbound)
        continue
      }

      // Try outbound
      const outbound = await this.storage.getItem<OutboundEmail>(
        `emails/outbound/outbound-${messageId}.json`
      )
      if (outbound) {
        emails.push(outbound)
      }
    }

    // Sort by timestamp
    return emails.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  /**
   * Load agent email index from storage
   */
  private async loadAgentEmailIndex(agentId: string): Promise<AgentEmailIndex | null> {
    try {
      const index = await this.storage.getItem<AgentEmailIndex>(
        `indexes/agents/${agentId}/conversations.json`
      )
      return index || null
    } catch (error) {
      console.error(`[MailStorage] Failed to load index for agent ${agentId}:`, error)
      return null
    }
  }

  /**
   * Update agent email index when a new email is stored
   */
  private async updateAgentEmailIndex(
    agentId: string,
    teamId: string,
    email: InboundEmail | OutboundEmail,
    direction: 'inbound' | 'outbound'
  ): Promise<void> {
    try {
      // Load existing index or create new one
      let index = await this.loadAgentEmailIndex(agentId)
      if (!index) {
        index = {
          agentId,
          teamId,
          conversations: {},
          lastUpdated: new Date().toISOString()
        }
      }

      const conversationId = email.conversationId
      if (!conversationId) {
        console.warn(
          `[MailStorage] Email ${email.messageId} has no conversationId, skipping index update`
        )
        return
      }

      // Get or create conversation
      let conversation = index.conversations[conversationId]
      if (!conversation) {
        conversation = {
          id: conversationId,
          agentId,
          teamId,
          subject: email.subject,
          participants: [],
          messageIds: [],
          lastMessageDate: email.timestamp,
          messageCount: 0,
          hasUnread: direction === 'inbound',
          excerpt: generateExcerpt(email.body)
        }
        index.conversations[conversationId] = conversation
      }

      // Update conversation
      conversation.lastMessageDate = email.timestamp
      conversation.messageCount++
      conversation.excerpt = generateExcerpt(email.body)

      // Add message ID if not already present
      if (!conversation.messageIds.includes(email.messageId)) {
        conversation.messageIds.push(email.messageId)
      }

      // Update participants
      const participants = new Set(conversation.participants)
      const fromEmail = email.from.match(/<([^>]+)>/)?.[1] || email.from
      const toEmail = email.to.match(/<([^>]+)>/)?.[1] || email.to
      participants.add(fromEmail.toLowerCase())
      participants.add(toEmail.toLowerCase())
      conversation.participants = Array.from(participants)

      // Mark as unread if inbound
      if (direction === 'inbound') {
        conversation.hasUnread = true
      }

      // Update index timestamp
      index.lastUpdated = new Date().toISOString()

      // Save index
      await this.storage.setItem(`indexes/agents/${agentId}/conversations.json`, index)
    } catch (error) {
      console.error(`[MailStorage] Failed to update index for agent ${agentId}:`, error)
      // Don't throw - index update is not critical
    }
  }

  /**
   * Mark conversation as read
   */
  async markConversationAsRead(agentId: string, conversationId: string): Promise<void> {
    const index = await this.loadAgentEmailIndex(agentId)
    if (!index) {
      return
    }

    const conversation = index.conversations[conversationId]
    if (conversation) {
      conversation.hasUnread = false
      index.lastUpdated = new Date().toISOString()
      await this.storage.setItem(`indexes/agents/${agentId}/conversations.json`, index)
    }
  }

  private async persistEmailMountSnapshot(params: {
    direction: 'inbound' | 'outbound'
    email: InboundEmail | OutboundEmail
    attachments?: EmailAttachment[]
  }): Promise<void> {
    const { direction, email, attachments } = params

    if (!email.teamId || !email.agentId) {
      return
    }

    const basePath = `team/${email.teamId}/agent/${email.agentId}`
    const messagePath = `${basePath}/messages/${direction}-${email.messageId}.json`

    const payload = {
      ...email,
      direction,
      attachments: attachments ?? email.attachments ?? []
    }

    try {
      await this.emailMount.setItem(messagePath, payload)

      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          if (!attachment.storageKey) {
            continue
          }

          const attachmentPath = `${basePath}/attachments/${email.messageId}/${attachment.filename}`
          await this.emailMount.setItem(attachmentPath, {
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            size: attachment.size,
            storageKey: attachment.storageKey
          })
        }
      }
    } catch (error) {
      console.error('[MailStorage] Failed to persist email mount snapshot', {
        teamId: email.teamId,
        agentId: email.agentId,
        messageId: email.messageId,
        error
      })
    }
  }
}

// Export singleton instance
export const mailStorage = new UnifiedMailStorage()
