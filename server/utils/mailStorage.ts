/**
 * Unified Mail Storage System
 *
 * This module provides a centralized way to store and retrieve all email data
 * for agents, including incoming emails, outgoing emails, and activity logs.
 */

import type { Agent, Mail } from '~/types'
import type { MailLogEntry, InboundEmail, OutboundEmail } from '../types/mail'

export class UnifiedMailStorage {
  private storage = useStorage('mail')

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
    agentId?: string
    agentEmail?: string
    mcpContexts?: unknown[]
    rawPayload?: Record<string, unknown>
  }): Promise<InboundEmail> {
    const id = `inbound-${data.messageId}`
    const timestamp = new Date().toISOString()

    const inboundEmail: InboundEmail = {
      id,
      timestamp,
      messageId: data.messageId,
      from: data.from,
      to: data.to,
      subject: data.subject,
      body: data.body,
      html: data.html,
      agentId: data.agentId,
      agentEmail: data.agentEmail,
      mcpContexts: data.mcpContexts,
      rawPayload: data.rawPayload
    }

    // Store individual inbound email
    await this.storage.setItem(`emails/inbound/${id}.json`, inboundEmail)

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
      metadata: { hasHtml: !!data.html, hasRawPayload: !!data.rawPayload }
    })

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
  }): Promise<void> {
    const id = `inbound-${data.messageId}`

    // Update stored inbound email snapshot
    const existing = await this.storage.getItem<InboundEmail>(`emails/inbound/${id}.json`)
    if (existing) {
      const updated: InboundEmail = {
        ...existing,
        agentId: data.agentId ?? existing.agentId,
        agentEmail: data.agentEmail ?? existing.agentEmail,
        mcpContexts: data.mcpContexts ?? existing.mcpContexts
      }
      await this.storage.setItem(`emails/inbound/${id}.json`, updated)
    }

    // Update unified log entry in-place (do not add a new one)
    const logs = await this.getAllLogs()
    const idx = logs.findIndex(l => l.id === id && l.type === 'inbound')
    if (idx !== -1) {
      const entry = logs[idx]
      logs[idx] = {
        ...entry,
        agentId: data.agentId ?? entry.agentId,
        agentEmail: data.agentEmail ?? entry.agentEmail,
        mcpContextCount: Array.isArray(data.mcpContexts) ? data.mcpContexts.length : entry.mcpContextCount
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
    usedOpenAI: boolean
    mailgunSent: boolean
    mcpServerIds?: string[]
    mcpContextCount?: number
    isAutomatic?: boolean // true for automatic responses, false for manual responses
  }): Promise<OutboundEmail> {
    const id = `outbound-${data.messageId}`
    const timestamp = new Date().toISOString()

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
      usedOpenAI: data.usedOpenAI,
      mailgunSent: data.mailgunSent,
      mcpServerIds: data.mcpServerIds,
      mcpContextCount: data.mcpContextCount,
      isAutomatic: data.isAutomatic
    }

    // Store individual outbound email
    await this.storage.setItem(`emails/outbound/${id}.json`, outboundEmail)

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
      metadata: { isAutomatic: data.isAutomatic }
    })

    return outboundEmail
  }

  /**
   * Get all emails for a specific agent
   */
  async getAgentEmails(agentId: string): Promise<{ incoming: Mail[], outgoing: Mail[] }> {
    const logs = await this.getLogsForAgent(agentId)
    const agent = await this.getAgent(agentId)

    if (!agent) {
      return { incoming: [], outgoing: [] }
    }

    const incoming: Mail[] = []
    const outgoing: Mail[] = []

    for (const log of logs) {
      if (log.type === 'inbound') {
        const inboundEmail = await this.storage.getItem<InboundEmail>(`emails/inbound/${log.id}.json`)
        if (inboundEmail) {
          incoming.push(this.formatAsMail(inboundEmail, 'inbound'))
        }
      } else if (log.type === 'outgoing') {
        const outboundEmail = await this.storage.getItem<OutboundEmail>(`emails/outbound/${log.id}.json`)
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
      .filter(log => log.agentId === agentId)
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
      filteredLogs = allLogs.filter(log => log.type === type)
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
    return agents?.find(a => a?.id === agentId) || null
  }

  private async getAgentMcpServerIds(agentId: string): Promise<string[]> {
    const agent = await this.getAgent(agentId)
    return agent?.mcpServerIds || []
  }

  private formatAsMail(email: InboundEmail | OutboundEmail, direction: 'inbound' | 'outbound'): Mail {
    const isInbound = direction === 'inbound'
    const senderInfo = isInbound ? this.parseEmailHeader(email.from) : this.parseEmailHeader(email.to)
    const _recipientInfo = isInbound ? this.parseEmailHeader(email.to) : this.parseEmailHeader(email.from)

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

  private parseEmailHeader(header: string): { name: string, email: string } {
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
    const existingLogs = await agentsStorage.getItem<Array<Record<string, unknown>>>('email:log.json')
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
      case 'inbound_processed': return 'inbound_processed'
      case 'agent_respond': return 'outgoing'
      default: return 'inbound'
    }
  }

  /**
   * Clear all emails for a specific agent
   */
  async clearAgentEmails(agentId: string): Promise<{ deletedCount: number }> {
    console.log(`[MailStorage] Clearing all emails for agent ${agentId}`)

    let deletedCount = 0

    try {
      // Get all logs to find emails for this agent
      const allLogs = await this.getAllLogs()
      const agentLogs = allLogs.filter(log => log.agentId === agentId)

      console.log(`[MailStorage] Found ${agentLogs.length} email logs for agent ${agentId}`)

      // Delete individual email files
      for (const log of agentLogs) {
        try {
          if (log.type === 'inbound') {
            await this.storage.removeItem(`emails/inbound/${log.id}.json`)
          } else if (log.type === 'outgoing') {
            await this.storage.removeItem(`emails/outbound/${log.id}.json`)
          }
          deletedCount++
        } catch (error) {
          console.warn(`[MailStorage] Failed to delete email file for log ${log.id}:`, error)
        }
      }

      // Remove logs from unified log file
      const updatedLogs = allLogs.filter(log => log.agentId !== agentId)
      await this.storage.setItem('logs/unified.json', updatedLogs)

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
      const agentLogs = allLogs.filter(log => log.agentId === agentId)

      // Remove logs from unified log file
      const updatedLogs = allLogs.filter(log => log.agentId !== agentId)
      await this.storage.setItem('logs/unified.json', updatedLogs)

      console.log(`[MailStorage] ✓ Cleared ${agentLogs.length} logs for agent ${agentId}`)

      return { deletedCount: agentLogs.length }
    } catch (error) {
      console.error(`[MailStorage] ✗ Failed to clear logs for agent ${agentId}:`, error)
      throw error
    }
  }
}

// Export singleton instance
export const mailStorage = new UnifiedMailStorage()
