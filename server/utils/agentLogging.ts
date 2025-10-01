/**
 * Comprehensive Agent Activity Logging
 * 
 * This module provides detailed logging for agent activities including:
 * - MCP server usage (input/output)
 * - AI API usage (input/output)
 * - Email sending activities
 * - General agent actions
 */

import type { Agent } from '~/types'
import type { AgentLogEntry, McpUsageLog, AiUsageLog, EmailActivityLog } from '../types/agent-logging'

export class AgentLogger {
  private storage = useStorage('agent-logs')

  /**
   * Log MCP server usage
   */
  async logMcpUsage(data: {
    agentId: string
    agentEmail: string
    serverId: string
    serverName: string
    provider: string
    category: string
    input: {
      query: string
      context?: Record<string, unknown>
      parameters?: Record<string, unknown>
    }
    output: {
      result: unknown
      success: boolean
      error?: string
    }
    metadata?: {
      responseTime?: number
      contextCount?: number
    }
  }): Promise<McpUsageLog> {
    const id = `mcp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timestamp = new Date().toISOString()

    const log: McpUsageLog = {
      id,
      timestamp,
      agentId: data.agentId,
      agentEmail: data.agentEmail,
      type: 'mcp_usage',
      serverId: data.serverId,
      serverName: data.serverName,
      provider: data.provider,
      category: data.category,
      input: data.input,
      output: data.output,
      metadata: data.metadata || {}
    }

    await this.addLogEntry(log)
    return log
  }

  /**
   * Log AI API usage
   */
  async logAiUsage(data: {
    agentId: string
    agentEmail: string
    provider: 'openai'
    model: string
    input: {
      messages: Array<{ role: string, content: string }>
      temperature?: number
      maxTokens?: number
    }
    output: {
      result: string
      success: boolean
      error?: string
      tokens?: {
        prompt?: number
        completion?: number
        total?: number
      }
    }
    metadata?: {
      responseTime?: number
      promptLength?: number
      responseLength?: number
    }
  }): Promise<AiUsageLog> {
    const id = `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timestamp = new Date().toISOString()

    const log: AiUsageLog = {
      id,
      timestamp,
      agentId: data.agentId,
      agentEmail: data.agentEmail,
      type: 'ai_usage',
      provider: data.provider,
      model: data.model,
      input: data.input,
      output: data.output,
      metadata: data.metadata || {}
    }

    await this.addLogEntry(log)
    return log
  }

  /**
   * Log email activity
   */
  async logEmailActivity(data: {
    agentId: string
    agentEmail: string
    direction: 'inbound' | 'outbound'
    email: {
      messageId: string
      from: string
      to: string
      subject: string
      body: string
    }
    metadata?: {
      mailgunSent?: boolean
      isAutomatic?: boolean
      mcpContextCount?: number
    }
  }): Promise<EmailActivityLog> {
    const id = `email-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timestamp = new Date().toISOString()

    const log: EmailActivityLog = {
      id,
      timestamp,
      agentId: data.agentId,
      agentEmail: data.agentEmail,
      type: 'email_activity',
      direction: data.direction,
      email: data.email,
      metadata: data.metadata || {}
    }

    await this.addLogEntry(log)
    return log
  }

  /**
   * Get logs for a specific agent
   */
  async getAgentLogs(agentId: string, limit = 100): Promise<AgentLogEntry[]> {
    const allLogs = await this.getAllLogs()
    return allLogs
      .filter(log => log.agentId === agentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  /**
   * Get logs by type
   */
  async getLogsByType(type: AgentLogEntry['type'], limit = 100): Promise<AgentLogEntry[]> {
    const allLogs = await this.getAllLogs()
    return allLogs
      .filter(log => log.type === type)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  /**
   * Get recent logs across all agents
   */
  async getRecentLogs(limit = 100): Promise<AgentLogEntry[]> {
    const allLogs = await this.getAllLogs()
    return allLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  /**
   * Private helper methods
   */
  private async addLogEntry(entry: AgentLogEntry): Promise<void> {
    const allLogs = await this.getAllLogs()
    allLogs.push(entry)
    
    // Keep only the most recent 5000 entries to prevent storage bloat
    const sortedLogs = allLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5000)
    
    await this.storage.setItem('agent-activity-logs.json', sortedLogs)
  }

  private async getAllLogs(): Promise<AgentLogEntry[]> {
    const logs = await this.storage.getItem<AgentLogEntry[]>('agent-activity-logs.json')
    return Array.isArray(logs) ? logs : []
  }

  /**
   * Clear all activity logs for a specific agent
   */
  async clearAgentLogs(agentId: string): Promise<{ deletedCount: number }> {
    console.log(`[AgentLogger] Clearing all activity logs for agent ${agentId}`)

    try {
      const allLogs = await this.getAllLogs()
      const agentLogs = allLogs.filter(log => log.agentId === agentId)

      // Remove logs from activity log file
      const updatedLogs = allLogs.filter(log => log.agentId !== agentId)
      await this.storage.setItem('agent-activity-logs.json', updatedLogs)

      console.log(`[AgentLogger] ✓ Cleared ${agentLogs.length} activity logs for agent ${agentId}`)

      return { deletedCount: agentLogs.length }
    } catch (error) {
      console.error(`[AgentLogger] ✗ Failed to clear activity logs for agent ${agentId}:`, error)
      throw error
    }
  }
}

// Export singleton instance
export const agentLogger = new AgentLogger()
