/**
 * Message Router - Simplified Email Routing
 *
 * Routes incoming emails to flows and handles agent communication.
 */

import type { AgentFlow } from '../types/agent-flows'
import { agentFlowEngine } from './agentFlowEngine'
import { agentLogger } from './agentLogging'
import { evaluateOutboundMail } from './mailPolicy'

export interface InboundEmail {
  messageId: string
  from: string
  to: string
  subject: string
  body: string
  receivedAt: string
  inReplyTo?: string[]
  references?: string[]
}

export class MessageRouter {
  /**
   * Route incoming email - check if it matches an active flow
   */
  async routeInboundEmail(email: InboundEmail, agentId: string) {
    console.log(`[MessageRouter] Routing email for agent ${agentId}`)

    const flow = await this.matchEmailToFlow(email, agentId)

    if (flow) {
      console.log(`[MessageRouter] Email matched to flow ${flow.id}`)
      return { isFlowResponse: true, flow }
    }

    console.log(`[MessageRouter] Email is a new request for agent ${agentId}`)
    return { isFlowResponse: false }
  }

  /**
   * Send email from one agent to another
   */
  async sendAgentToAgentEmail(params: {
    fromAgentEmail: string
    toAgentEmail: string
    subject: string
    body: string
    flowId: string
    requestId: string
  }): Promise<string> {
    this.logEmailStart(params)

    const { fromAgent, toAgent } = await this.validateAgents(
      params.fromAgentEmail,
      params.toAgentEmail
    )
    await this.checkPermissions(fromAgent, params.toAgentEmail)

    const emailData = this.prepareEmailData(fromAgent, toAgent, params)
    const { messageId, mailgunSent } = await this.dispatchEmail(emailData)

    await this.logEmailActivity(fromAgent, emailData, messageId, mailgunSent, params)

    this.logEmailSuccess(messageId, mailgunSent)
    return messageId
  }

  /**
   * Send email from agent to external user
   */
  async sendAgentToUserEmail(params: {
    fromAgentId: string
    toEmail: string
    subject: string
    body: string
    flowId?: string
  }): Promise<string> {
    console.log(
      `[MessageRouter] Sending email from agent ${params.fromAgentId} to user ${params.toEmail}`
    )

    const agent = await this.getAgent(params.fromAgentId)
    if (!agent) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }

    const outboundPolicy = await evaluateOutboundMail(agent, params.toEmail)
    if (!outboundPolicy.allowed) {
      throw createError({
        statusCode: 403,
        statusMessage: outboundPolicy.reason || 'Outbound email blocked by policy'
      })
    }

    // Construct full email from username + team domain
    const { getAgentFullEmail } = await import('./agentEmailHelpers')
    const fromFullEmail = await getAgentFullEmail(agent.email, agent.teamId)

    const toAgent = await this.getAgentByEmail(params.toEmail)
    const toFullEmail = toAgent ? await getAgentFullEmail(toAgent.email, toAgent.teamId) : undefined

    const emailData = {
      from: `${agent.name} <${fromFullEmail}>`,
      to: params.toEmail,
      subject: params.subject,
      text: params.body,
      simulateInboundForAgent: toFullEmail,
      forceMailgun: !toAgent
    }

    console.log('[MessageRouter] → Dispatching email...')
    const { messageId, mailgunSent } = await this.dispatchEmail(emailData)

    await this.logUserEmailActivity(params, agent, emailData, messageId, mailgunSent, fromFullEmail)
    this.logUserEmailResult(toAgent, params.toEmail)

    return messageId
  }

  private async logUserEmailActivity(
    params: any,
    agent: any,
    emailData: any,
    messageId: string,
    mailgunSent: boolean,
    fullEmail: string
  ) {
    try {
      await agentLogger.logEmailActivity({
        agentId: params.fromAgentId,
        agentEmail: fullEmail, // Use full email for logging
        direction: 'outbound',
        email: {
          messageId,
          from: emailData.from,
          to: emailData.to,
          subject: emailData.subject,
          body: emailData.text
        },
        metadata: {
          mailgunSent,
          isAutomatic: true,
          mcpContextCount: 0,
          flowId: params.flowId
        }
      })
    } catch (error) {
      console.error('[MessageRouter] Failed to log email activity:', error)
    }
  }

  private logUserEmailResult(toAgent: any, toEmail: string) {
    console.log('[MessageRouter] ✓ Email dispatched successfully')

    if (toAgent) {
      console.log(`[MessageRouter] ✓ Agent recipient detected: ${toAgent.name}`)
      console.log('[MessageRouter] → Inbound processing will occur via Mailgun/webhook flow')
    } else {
      console.log(`[MessageRouter] → External user ${toEmail} - dispatch complete`)
    }
  }

  // Helper methods for sendAgentToAgentEmail

  private logEmailStart(params: any) {
    console.log('\n[MessageRouter] ════════════════════════════════════════════')
    console.log('[MessageRouter] 📧 AGENT-TO-AGENT EMAIL')
    console.log(`[MessageRouter] From: ${params.fromAgentEmail}`)
    console.log(`[MessageRouter] To: ${params.toAgentEmail}`)
    console.log(`[MessageRouter] Subject: [Req: ${params.requestId}] ${params.subject}`)
    console.log(`[MessageRouter] Flow ID: ${params.flowId}`)
    console.log('[MessageRouter] ════════════════════════════════════════════')
  }

  private async validateAgents(fromEmail: string, toEmail: string) {
    console.log('[MessageRouter] → Looking up agents...')
    const fromAgent = await this.getAgentByEmail(fromEmail)
    const toAgent = await this.getAgentByEmail(toEmail)

    if (!fromAgent || !toAgent) {
      console.error('[MessageRouter] ✗ Agent lookup failed:')
      console.error(
        `[MessageRouter]   From agent (${fromEmail}): ${fromAgent ? '✓ found' : '✗ NOT FOUND'}`
      )
      console.error(
        `[MessageRouter]   To agent (${toEmail}): ${toAgent ? '✓ found' : '✗ NOT FOUND'}`
      )
      throw createError({
        statusCode: 404,
        statusMessage: 'One or both agents not found'
      })
    }

    console.log('[MessageRouter] ✓ Both agents found')
    console.log(`[MessageRouter]   From: ${fromAgent.name} <${fromAgent.email}>`)
    console.log(`[MessageRouter]   To: ${toAgent.name} <${toAgent.email}>`)

    return { fromAgent, toAgent }
  }

  private async checkPermissions(fromAgent: any, toEmail: string) {
    if (!fromAgent.multiRoundConfig?.canCommunicateWithAgents) {
      console.error(`[MessageRouter] ✗ Inter-agent communication is disabled for ${fromAgent.name}`)
      throw createError({
        statusCode: 403,
        statusMessage: `Agent ${fromAgent.email} does not have inter-agent communication enabled`
      })
    }

    let allowedEmails = fromAgent.multiRoundConfig.allowedAgentEmails || []

    // Migration: convert old agent IDs to emails
    if (allowedEmails.length === 0 && (fromAgent.multiRoundConfig as any).allowedAgentIds) {
      allowedEmails = await this.migrateAgentIds(fromAgent.multiRoundConfig)
    }

    // Compare by username only since storage keeps usernames
    const toUsername = toEmail.split('@')[0].toLowerCase()
    if (
      allowedEmails.length > 0 &&
      !allowedEmails.includes(toUsername) &&
      !allowedEmails.includes(toEmail.toLowerCase())
    ) {
      console.error('[MessageRouter] ✗ Permission denied:')
      console.error(
        `[MessageRouter]   ${fromAgent.name} is only allowed to contact: ${allowedEmails.join(', ')}`
      )
      console.error(`[MessageRouter]   Attempted to contact: ${toEmail}`)
      throw createError({
        statusCode: 403,
        statusMessage: `Agent ${fromAgent.email} is not allowed to communicate with ${toEmail}`
      })
    }

    console.log('[MessageRouter] ✓ Permission check passed')
    if (allowedEmails.length > 0) {
      console.log(`[MessageRouter]   Allowed agents: ${allowedEmails.join(', ')}`)
    } else {
      console.log('[MessageRouter]   Can contact: ALL agents')
    }
  }

  private async migrateAgentIds(multiRoundConfig: any) {
    const agentsStorage = useStorage('agents')
    const allAgents = (await agentsStorage.getItem<any[]>('agents.json')) || []
    const oldIds = multiRoundConfig.allowedAgentIds as string[]

    const allowedEmails = oldIds
      .map((id) => {
        const foundAgent = allAgents.find((a) => a?.id === id)
        return foundAgent?.email?.toLowerCase()
      })
      .filter((email): email is string => !!email)

    console.log(
      `[MessageRouter Migration] Converted ${oldIds.length} agent IDs to ${allowedEmails.length} emails`
    )
    return allowedEmails
  }

  private prepareEmailData(_fromAgent: any, _toAgent: any, params: any) {
    const subjectWithReqId = `[Req: ${params.requestId}] ${params.subject}`

    // Use full emails provided by caller (engine) to avoid double-appending domains
    return {
      from: params.fromAgentEmail.includes('<') ? params.fromAgentEmail : params.fromAgentEmail,
      to: params.toAgentEmail,
      subject: subjectWithReqId,
      text: params.body,
      simulateInboundForAgent: params.toAgentEmail
    }
  }

  private async logEmailActivity(
    fromAgent: any,
    emailData: any,
    messageId: string,
    mailgunSent: boolean,
    params: any
  ) {
    try {
      await agentLogger.logEmailActivity({
        agentId: fromAgent.id,
        agentEmail: params.fromAgentEmail || fromAgent.email,
        direction: 'outbound',
        email: {
          messageId,
          from: emailData.from,
          to: emailData.to,
          subject: emailData.subject,
          body: emailData.text
        },
        metadata: {
          mailgunSent,
          isAutomatic: true,
          mcpContextCount: 0,
          requestId: params.requestId,
          targetAgent: params.toAgentEmail,
          flowId: params.flowId
        }
      })
    } catch (error) {
      console.error('[MessageRouter] Failed to log email activity:', error)
    }
  }

  private logEmailSuccess(messageId: string, mailgunSent: boolean) {
    console.log('[MessageRouter] ✓ Email dispatched successfully')
    console.log(`[MessageRouter]   Mailgun sent: ${mailgunSent ? 'YES' : 'NO'}`)
    console.log(`[MessageRouter]   Message ID: ${messageId}`)
    console.log('[MessageRouter] ════════════════════════════════════════════\n')
  }

  /**
   * Check if incoming email is a response to THIS AGENT's active flow
   */
  async matchEmailToFlow(email: InboundEmail, agentId: string): Promise<AgentFlow | null> {
    const waitingFlows = await agentFlowEngine.listAgentFlows(agentId, { status: ['waiting'] })

    const messageMatch = this.matchEmailByMessageIds(email, waitingFlows)
    if (messageMatch) {
      return messageMatch
    }

    const requestId = this.extractRequestId(email.subject)
    if (!requestId) {
      console.log('[MessageRouter] No request ID found in subject, not a flow response')
      return null
    }

    console.log(`[MessageRouter] Found request ID: ${requestId}`)

    console.log(`[MessageRouter] Found ${waitingFlows.length} waiting flow(s) for agent`)

    for (const flow of waitingFlows) {
      if (this.isFlowWaitingForRequest(flow, requestId)) {
        if (await this.validateFlowMatch(flow, email)) {
          console.log(`[MessageRouter] Matched email to flow ${flow.id}`)
          return flow
        }
      }
    }

    console.log('[MessageRouter] No matching flow found for request ID')
    return null
  }

  private matchEmailByMessageIds(email: InboundEmail, flows: AgentFlow[]): AgentFlow | null {
    const referencedIds = new Set(
      [...(email.inReplyTo || []), ...(email.references || [])]
        .map((id) => this.normalizeMessageId(id))
        .filter((id): id is string => !!id)
    )

    if (referencedIds.size === 0) {
      return null
    }

    console.log(
      `[MessageRouter] Matching by message headers. Headers: ${Array.from(referencedIds).join(', ')}`
    )

    for (const flow of flows) {
      const waitState = flow.waitingFor
      if (!waitState) continue

      const candidateIds = new Set(
        [waitState.messageId, ...(waitState.threadMessageIds || [])]
          .map((id) => this.normalizeMessageId(id))
          .filter((id): id is string => !!id)
      )

      if (candidateIds.size === 0) continue

      const hasMatch = Array.from(candidateIds).some((id) => referencedIds.has(id))
      if (hasMatch) {
        console.log(`[MessageRouter] ✓ Message ID match found for flow ${flow.id}`)
        return flow
      }
    }

    console.log('[MessageRouter] No flow matched by message headers')
    return null
  }

  private isFlowWaitingForRequest(flow: AgentFlow, requestId: string): boolean {
    console.log(
      `[MessageRouter] Checking flow ${flow.id}: waitingFor.type=${flow.waitingFor?.type}, requestId=${flow.waitingFor?.requestId}`
    )
    return flow.waitingFor?.type === 'agent_response' && flow.waitingFor.requestId === requestId
  }

  private async validateFlowMatch(flow: AgentFlow, email: InboundEmail): Promise<boolean> {
    // Check if sender matches expected agent
    if (flow.waitingFor?.agentId) {
      const senderEmail = this.extractEmail(email.from)
      const expectedAgent = await this.getExpectedAgent(flow.waitingFor.agentId)

      // Extract username from both emails for comparison
      const senderUsername = senderEmail.split('@')[0].toLowerCase()
      const expectedUsername = expectedAgent?.email?.split('@')[0].toLowerCase() || ''

      if (expectedAgent && senderUsername !== expectedUsername) {
        console.warn(
          `[MessageRouter] Sender ${senderEmail} (${senderUsername}) does not match expected agent ${expectedAgent.email} (${expectedUsername})`
        )
        return false
      }

      console.log(`[MessageRouter] ✓ Flow matched: ${flow.id}`)
      console.log(`[MessageRouter]   Expected agent: ${expectedAgent?.email}`)
      console.log(`[MessageRouter]   Actual sender: ${senderEmail}`)
    }

    // Check if flow has expired
    if (flow.waitingFor?.expectedBy) {
      const expectedBy = new Date(flow.waitingFor.expectedBy).getTime()
      const now = Date.now()

      if (now > expectedBy) {
        console.warn(
          `[MessageRouter] Flow ${flow.id} has expired (expected by ${flow.waitingFor.expectedBy})`
        )
        return false
      }
    }

    return true
  }

  private normalizeMessageId(messageId?: string): string | undefined {
    if (!messageId) return undefined
    const trimmed = messageId.trim()
    if (!trimmed) return undefined
    const angleMatch = trimmed.match(/<([^>]+)>/)
    const normalized = (angleMatch ? angleMatch[1] : trimmed).trim()
    return normalized ? normalized.toLowerCase() : undefined
  }

  private async getExpectedAgent(agentIdOrEmail: string) {
    return agentIdOrEmail.includes('@')
      ? await this.getAgentByEmail(agentIdOrEmail)
      : await this.getAgent(agentIdOrEmail)
  }

  /**
   * Extract request ID from subject line
   */
  extractRequestId(subject: string): string | null {
    // Match [Req: req-abc123] or Re: [Req: req-abc123]
    // Include dashes in the pattern since nanoid can generate IDs with dashes
    const match = subject.match(/\[Req:\s*(req-[a-zA-Z0-9_-]+)\]/)

    if (match) {
      return match[1]
    }

    return null
  }

  /**
   * Extract email address from header
   */
  private extractEmail(emailHeader: string): string {
    // Handle "Name <email@domain.com>" format
    const match = emailHeader.match(/<([^>]+)>/)
    if (match) {
      return match[1].trim().toLowerCase()
    }

    // Handle plain email format
    return emailHeader.trim().toLowerCase()
  }

  /**
   * Send email based on environment configuration
   */
  private async dispatchEmail(params: {
    from: string
    to: string
    subject: string
    text: string
    simulateInboundForAgent?: string
    forceMailgun?: boolean
  }): Promise<{ messageId: string; mailgunSent: boolean }> {
    const isProduction = process.env.NODE_ENV === 'production'
    const shouldSendViaMailgun = isProduction || Boolean(params.forceMailgun)

    const { messageId, mailgunSent } = shouldSendViaMailgun
      ? await this.sendViaMailgun(params)
      : this.generateDevMessage(params)

    if (!shouldSendViaMailgun && params.simulateInboundForAgent) {
      this.scheduleDevInbound(params, messageId)
    }

    return { messageId, mailgunSent }
  }

  private async sendViaMailgun(params: any) {
    const messageId = await this.sendEmailViaMailgun(params)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[MessageRouter] (dev) Forced Mailgun send, message ID: ${messageId}`)
    }
    return { messageId, mailgunSent: true }
  }

  private generateDevMessage(_params: any) {
    const messageId = this.generateDevMessageId()
    console.log(`[MessageRouter] (dev) Generated message ID ${messageId} (Mailgun bypassed)`)
    return { messageId, mailgunSent: false }
  }

  private scheduleDevInbound(params: any, messageId: string) {
    const target = params.simulateInboundForAgent
    const port = process.env.PORT || 3000

    console.log(`[MessageRouter] (dev) Scheduling deferred inbound delivery for ${target}`)

    setImmediate(async () => {
      try {
        const payload = {
          recipient: target,
          to: target,
          To: target,
          'Message-Id': messageId,
          'message-id': messageId,
          sender: params.from,
          from: params.from,
          From: params.from,
          subject: params.subject,
          Subject: params.subject,
          'stripped-text': params.text,
          text: params.text,
          'body-plain': params.text
        }

        await $fetch(`http://localhost:${port}/api/mailgun/inbound`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        console.log(`[MessageRouter] (dev) Synthetic inbound sent to ${target}`)
      } catch (error) {
        console.error('[MessageRouter] ✗ Synthetic inbound failed:', error)
      }
    })
  }

  private generateDevMessageId(): string {
    const random = Math.random().toString(36).slice(2)
    return `dev-${Date.now()}-${random}`
  }

  /**
   * Get agent by email (extracts username and matches)
   * Note: agent.email now stores username only
   */
  private async getAgentByEmail(email: string): Promise<
    | {
        id: string
        name: string
        email: string // This is the username only
        teamId?: string
        multiRoundConfig?: {
          canCommunicateWithAgents?: boolean
          allowedAgentEmails?: string[]
        }
      }
    | undefined
  > {
    const agentsStorage = useStorage('agents')
    const agents =
      (await agentsStorage.getItem<
        Array<{
          id?: string
          name?: string
          email?: string
          teamId?: string
          multiRoundConfig?: Record<string, unknown>
        }>
      >('agents.json')) || []

    // Extract username from full email (agent.email stores username only now)
    const username = email.split('@')[0].toLowerCase().trim()
    const agent = agents.find((a) => a?.email?.toLowerCase().trim() === username)

    if (!agent || !agent.id || !agent.name || !agent.email) {
      return undefined
    }
    return {
      id: agent.id,
      name: agent.name,
      email: agent.email, // Username only
      teamId: agent.teamId,
      multiRoundConfig: agent.multiRoundConfig as {
        canCommunicateWithAgents?: boolean
        allowedAgentEmails?: string[]
      }
    }
  }

  /**
   * Get agent by ID (kept for backwards compatibility)
   * Note: agent.email now stores username only
   */
  private async getAgent(agentId: string): Promise<
    | {
        id: string
        name: string
        email: string // This is the username only
        teamId?: string
        multiRoundConfig?: {
          canCommunicateWithAgents?: boolean
          allowedAgentEmails?: string[]
        }
      }
    | undefined
  > {
    const agentsStorage = useStorage('agents')
    const agents =
      (await agentsStorage.getItem<
        Array<{
          id?: string
          name?: string
          email?: string
          teamId?: string
          multiRoundConfig?: Record<string, unknown>
        }>
      >('agents.json')) || []
    const agent = agents.find((a) => a?.id === agentId)
    if (!agent || !agent.id || !agent.name || !agent.email) {
      return undefined
    }
    return {
      id: agent.id,
      name: agent.name,
      email: agent.email, // Username only
      teamId: agent.teamId,
      multiRoundConfig: agent.multiRoundConfig as {
        canCommunicateWithAgents?: boolean
        allowedAgentEmails?: string[]
      }
    }
  }

  /**
   * Send email via Mailgun
   */
  private async sendEmailViaMailgun(params: {
    from: string
    to: string
    subject: string
    text: string
  }): Promise<string> {
    const settingsStorage = useStorage('settings')
    const settings = (await settingsStorage.getItem<Record<string, unknown>>('settings.json')) || {}

    const mailgunApiKey = String(settings.mailgunApiKey || process.env.MAILGUN_KEY || '').trim()
    const mailgunDomain = String(settings.mailgunDomain || process.env.MAILGUN_DOMAIN || '').trim()

    if (!mailgunApiKey || !mailgunDomain) {
      console.warn('[MessageRouter] Mailgun not configured, email not sent')
      // Return fake message ID for development
      return `dev-${Date.now()}`
    }

    try {
      const formData = new FormData()
      formData.append('from', params.from)
      formData.append('to', params.to)
      formData.append('subject', params.subject)
      formData.append('text', params.text)

      const response = await $fetch<{ id: string }>(
        `https://api.mailgun.net/v3/${mailgunDomain}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString('base64')}`
          },
          body: formData
        }
      )

      return response.id
    } catch (error) {
      console.error('[MessageRouter] Mailgun API error:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to send email via Mailgun'
      })
    }
  }
}
