/**
 * Agent Flow Engine - Complete Implementation
 *
 * This is the core engine that manages multi-round agent flows.
 * It handles flow creation, round execution, state management, and flow completion.
 */

import type {
  AgentFlow,
  EmailTrigger,
  FlowRequester,
  FlowStatus,
  RoundResult,
  ResumeInput,
  FlowRound,
  FlowDecision
} from '../types/agent-flows'
import { nanoid } from 'nanoid'

export class AgentFlowEngine {
  private storage = useStorage('agent-flows')

  /**
   * Get agent-specific storage path
   * Flows are scoped per agent for complete isolation
   */
  private getAgentFlowPath(agentId: string, flowId: string): string {
    return `${agentId}/flows/${flowId}.json`
  }

  /**
   * Start a new agent flow from an incoming email
   */
  async startFlow(params: {
    agentId: string
    trigger: EmailTrigger
    maxRounds?: number
    timeoutMinutes?: number
    teamId?: string
    userId?: string
  }): Promise<AgentFlow> {
    const flowId = `flow-${params.agentId}-${nanoid(8)}`
    const now = new Date().toISOString()
    const timeoutAt = new Date(Date.now() + (params.timeoutMinutes || 60) * 60 * 1000).toISOString()

    const flow: AgentFlow = {
      id: flowId,
      agentId: params.agentId,
      status: 'active',
      trigger: params.trigger,
      requester: {
        email: params.trigger.from,
        name: this.extractNameFromEmail(params.trigger.from)
      },
      rounds: [],
      currentRound: 0,
      maxRounds: params.maxRounds || 10,
      teamId: params.teamId,
      userId: params.userId,
      createdAt: now,
      updatedAt: now,
      timeoutAt,
      metadata: {
        totalAiCalls: 0,
        totalMcpCalls: 0,
        totalAgentMessages: 0
      }
    }

    await this.saveFlow(flow)

    console.log(`[AgentFlowEngine] Started flow ${flowId} for agent ${params.agentId}`)
    if (params.teamId) {
      console.log(
        `[AgentFlowEngine] Flow context: teamId=${params.teamId}, userId=${params.userId || 'none'}`
      )
    }

    return flow
  }

  /**
   * Execute a single round of the flow
   */
  async executeRound(flowId: string, agentId?: string): Promise<RoundResult> {
    console.log(`[AgentFlowEngine] Executing round for flow ${flowId}`)

    const flow = await this.validateAndLoadFlow(flowId, agentId)
    this.validateFlowCanExecute(flow)

    const round = await this.createNewRound(flow)
    await this.processDecision(flow, round)
    await this.updateFlowWithRound(flow, round)

    return await this.handleDecision(flow, round.decision)
  }

  private async validateAndLoadFlow(flowId: string, agentId?: string): Promise<AgentFlow> {
    const flow = await this.loadFlow(flowId, agentId)
    if (!flow) {
      throw createError({ statusCode: 404, statusMessage: `Flow ${flowId} not found` })
    }
    return flow
  }

  private validateFlowCanExecute(flow: AgentFlow): void {
    if (flow.status !== 'active') {
      throw createError({
        statusCode: 400,
        statusMessage: `Flow ${flow.id} is not active (status: ${flow.status})`
      })
    }

    if (flow.currentRound >= flow.maxRounds) {
      throw createError({
        statusCode: 400,
        statusMessage: `Flow ${flow.id} has exceeded maximum rounds (${flow.maxRounds})`
      })
    }
  }

  private async createNewRound(flow: AgentFlow): Promise<FlowRound> {
    const roundNumber = flow.currentRound + 1
    return {
      roundNumber,
      startedAt: new Date().toISOString(),
      decision: {
        type: 'continue',
        reasoning: 'Starting round execution',
        confidence: 0
      },
      actions: [],
      aiCalls: [],
      mcpCalls: [],
      messages: []
    }
  }

  private async processDecision(flow: AgentFlow, round: FlowRound): Promise<void> {
    const { DecisionEngine } = await import('./decisionEngine')
    const decisionEngine = new DecisionEngine()

    try {
      const decision = await decisionEngine.makeDecision({
        flow,
        agent: await this.getAgent(flow.agentId)
      })

      round.decision = decision
      round.completedAt = new Date().toISOString()

      this.recordAiCall(round, decision)
    } catch (error) {
      console.error('[AgentFlowEngine] Decision engine error:', error)
      round.decision = {
        type: 'fail',
        reasoning: `Decision engine error: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 1.0
      }
      round.completedAt = new Date().toISOString()
    }
  }

  private recordAiCall(round: FlowRound, decision: FlowDecision): void {
    if (decision) {
      round.aiCalls.push({
        id: `ai-${nanoid(8)}`,
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt: 'Decision prompt',
        response: JSON.stringify(decision),
        timestamp: new Date().toISOString()
      })
    }
  }

  private async updateFlowWithRound(flow: AgentFlow, round: FlowRound): Promise<void> {
    flow.rounds.push(round)
    flow.currentRound = round.roundNumber
    flow.updatedAt = new Date().toISOString()

    flow.metadata.totalAiCalls += round.aiCalls.length
    flow.metadata.totalMcpCalls += round.mcpCalls.length
    flow.metadata.totalAgentMessages += round.messages.length

    await this.saveFlow(flow)
  }

  /**
   * Resume a suspended flow (after receiving expected response)
   * IMPORTANT: Only resumes flows belonging to the specified agent
   */
  async resumeFlow(flowId: string, input: ResumeInput, agentId?: string): Promise<void> {
    console.log(`[AgentFlowEngine] Resuming flow ${flowId}`)

    const flow = await this.loadFlow(flowId, agentId)
    if (!flow) {
      throw createError({ statusCode: 404, statusMessage: `Flow ${flowId} not found` })
    }

    // Verify the flow belongs to the agent (if agentId provided)
    if (agentId && flow.agentId !== agentId) {
      throw createError({
        statusCode: 403,
        statusMessage: `Flow ${flowId} does not belong to agent ${agentId}`
      })
    }

    if (flow.status !== 'waiting') {
      throw createError({
        statusCode: 400,
        statusMessage: `Flow ${flowId} is not waiting (status: ${flow.status})`
      })
    }

    // Add the received input to the flow context
    if (input.type === 'email_response' && input.email) {
      const currentRound = flow.rounds[flow.rounds.length - 1]
      if (currentRound) {
        currentRound.messages.push({
          id: `msg-${nanoid(8)}`,
          direction: 'received',
          from: input.email.from,
          subject: input.email.subject,
          body: input.email.body,
          timestamp: new Date().toISOString()
        })
      }
    }

    // Clear wait state and set to active
    flow.status = 'active'
    flow.waitingFor = undefined
    flow.updatedAt = new Date().toISOString()

    await this.saveFlow(flow)

    // Execute next round
    await this.executeRound(flowId, flow.agentId)
  }

  /**
   * Complete a flow and send final response
   */
  async completeFlow(flowId: string, finalResponse: string, agentId?: string): Promise<void> {
    console.log(`[AgentFlowEngine] Completing flow ${flowId}`)

    const flow = await this.loadFlow(flowId, agentId)
    if (!flow) {
      throw createError({ statusCode: 404, statusMessage: `Flow ${flowId} not found` })
    }

    // Send final response email to requester
    const { MessageRouter } = await import('./messageRouter')
    const messageRouter = new MessageRouter()

    const formattedResponse = this.formatFinalResponseWithOriginalEmail(finalResponse, flow)

    try {
      await messageRouter.sendAgentToUserEmail({
        fromAgentId: flow.agentId,
        toEmail: flow.requester.email,
        subject: `Re: ${flow.trigger.subject}`,
        body: formattedResponse,
        flowId: flow.id
      })
    } catch (error) {
      console.error('[AgentFlowEngine] Failed to send final response:', error)
      // Continue with completion even if email fails
    }

    // Update flow status
    flow.status = 'completed'
    flow.completedAt = new Date().toISOString()
    flow.updatedAt = new Date().toISOString()

    await this.saveFlow(flow)

    console.log(`[AgentFlowEngine] Flow ${flowId} completed successfully`)
  }

  /**
   * Append the original user email to the agent's final response for context
   */
  private formatFinalResponseWithOriginalEmail(finalResponse: string, flow: AgentFlow): string {
    const trimmedResponse = finalResponse.trimEnd()
    const responseBody = trimmedResponse.length > 0 ? trimmedResponse : finalResponse
    const originalBody = flow.trigger.body.trim()

    if (!originalBody) {
      return responseBody
    }

    const quotedOriginal = originalBody
      .split(/\r?\n/)
      .map((line) => (line.length > 0 ? `> ${line}` : '>'))
      .join('\n')

    const requesterDisplay = flow.requester.name
      ? `${flow.requester.name} <${flow.requester.email}>`
      : flow.requester.email

    const originalMetadata = [
      '---- Original Message ----',
      `Date: ${new Date(flow.trigger.receivedAt).toLocaleString()}`,
      `From: ${requesterDisplay}`,
      flow.trigger.to ? `To: ${flow.trigger.to}` : undefined,
      flow.trigger.subject ? `Subject: ${flow.trigger.subject}` : undefined
    ].filter(Boolean)

    return `${responseBody}\n\n${originalMetadata.join('\n')}\n\n${quotedOriginal}`
  }

  /**
   * Fail a flow with error message
   */
  async failFlow(flowId: string, reason: string, agentId?: string): Promise<void> {
    console.log(`[AgentFlowEngine] Failing flow ${flowId}: ${reason}`)

    const flow = await this.loadFlow(flowId, agentId)
    if (!flow) {
      throw createError({ statusCode: 404, statusMessage: `Flow ${flowId} not found` })
    }

    // Send failure notification to requester
    const { MessageRouter } = await import('./messageRouter')
    const messageRouter = new MessageRouter()

    const failureMessage = `I apologize, but I was unable to complete your request.\n\nReason: ${reason}\n\nIf you need further assistance, please try again or contact support.`

    try {
      await messageRouter.sendAgentToUserEmail({
        fromAgentId: flow.agentId,
        toEmail: flow.requester.email,
        subject: `Re: ${flow.trigger.subject}`,
        body: failureMessage,
        flowId: flow.id
      })
    } catch (error) {
      console.error('[AgentFlowEngine] Failed to send failure notification:', error)
    }

    // Update flow status
    flow.status = 'failed'
    flow.completedAt = new Date().toISOString()
    flow.updatedAt = new Date().toISOString()

    // Add failure info to last round
    if (flow.rounds.length > 0) {
      const lastRound = flow.rounds[flow.rounds.length - 1]
      lastRound.decision.reasoning = `FAILED: ${reason}`
    }

    await this.saveFlow(flow)

    console.log(`[AgentFlowEngine] Flow ${flowId} failed: ${reason}`)
  }

  /**
   * Check for timed-out flows and handle them
   */
  async processTimeouts(): Promise<void> {
    console.log('[AgentFlowEngine] Processing timeouts')

    // Get all active and waiting flows
    // Note: This is inefficient for large scale - should use indexes
    const agentStorage = useStorage('agents')
    const agents = (await agentStorage.getItem<Array<{ id: string }>>('agents.json')) || []

    const now = Date.now()
    let timeoutCount = 0

    for (const agent of agents) {
      if (!agent?.id) continue

      const flows = await this.listFlows({
        agentId: agent.id,
        status: ['active', 'waiting']
      })

      for (const flow of flows) {
        const timeoutTime = new Date(flow.timeoutAt).getTime()

        if (now > timeoutTime) {
          console.log(`[AgentFlowEngine] Flow ${flow.id} has timed out`)

          // Update status to timeout
          flow.status = 'timeout'
          flow.completedAt = new Date().toISOString()
          flow.updatedAt = new Date().toISOString()

          await this.saveFlow(flow)

          // Send timeout notification to requester
          const { MessageRouter } = await import('./messageRouter')
          const messageRouter = new MessageRouter()

          const timeoutMessage =
            "I apologize, but your request has timed out.\n\nThis can happen when:\n- Required information takes too long to gather\n- Other agents don't respond in time\n- The system is experiencing high load\n\nPlease try your request again."

          try {
            await messageRouter.sendAgentToUserEmail({
              fromAgentId: flow.agentId,
              toEmail: flow.requester.email,
              subject: `Re: ${flow.trigger.subject}`,
              body: timeoutMessage,
              flowId: flow.id
            })
          } catch (error) {
            console.error('[AgentFlowEngine] Failed to send timeout notification:', error)
          }

          timeoutCount++
        }
      }
    }

    console.log(`[AgentFlowEngine] Processed ${timeoutCount} timeout(s)`)
  }

  /**
   * Get flow details
   */
  async getFlow(flowId: string, agentId: string): Promise<AgentFlow | null> {
    return await this.loadFlow(flowId, agentId)
  }

  /**
   * List flows for an agent
   */
  async listAgentFlows(
    agentId: string,
    filters?: {
      status?: FlowStatus[]
      limit?: number
    }
  ): Promise<AgentFlow[]> {
    const flows = await this.listFlows({
      agentId,
      status: filters?.status
    })

    // Sort by creation date (newest first)
    flows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Apply limit
    if (filters?.limit) {
      return flows.slice(0, filters.limit)
    }

    return flows
  }

  /**
   * Private helper methods
   */

  private async handleDecision(flow: AgentFlow, decision: FlowDecision): Promise<RoundResult> {
    console.log(`[AgentFlowEngine] ┌─ Handling decision: ${decision.type}`)
    console.log(`[AgentFlowEngine] │  Confidence: ${(decision.confidence * 100).toFixed(0)}%`)
    console.log(
      `[AgentFlowEngine] │  Reasoning: ${decision.reasoning.substring(0, 100)}${decision.reasoning.length > 100 ? '...' : ''}`
    )
    switch (decision.type) {
      case 'continue': {
        // Continue to next round - check if we haven't exceeded max rounds
        if (flow.currentRound >= flow.maxRounds) {
          console.log(
            `[AgentFlowEngine] ⚠ Max rounds (${flow.maxRounds}) reached, completing flow`
          )
          await this.completeFlow(
            flow.id,
            'Flow completed after reaching maximum rounds',
            flow.agentId
          )
          return {
            decision: 'complete',
            reasoning: 'Maximum rounds reached',
            confidence: 1.0
          }
        }

        // Execute next round
        console.log(`[AgentFlowEngine] → Continuing to round ${flow.currentRound + 1}`)
        const nextRoundResult = await this.executeRound(flow.id, flow.agentId)
        return nextRoundResult
      }

      case 'wait_for_agent':
        // Send message to target agent and wait
        await this.handleWaitForAgent(flow, decision)
        return {
          decision: 'wait_for_agent',
          reasoning: decision.reasoning,
          confidence: decision.confidence
        }

      case 'wait_for_mcp':
        // Call MCP and wait for response
        await this.handleWaitForMcp(flow, decision)
        return {
          decision: 'wait_for_mcp',
          reasoning: decision.reasoning,
          confidence: decision.confidence
        }

      case 'complete':
        // Complete the flow
        await this.completeFlow(flow.id, decision.finalResponse || 'Flow completed', flow.agentId)
        return {
          decision: 'complete',
          reasoning: decision.reasoning,
          confidence: decision.confidence
        }

      case 'fail':
        // Fail the flow
        await this.failFlow(flow.id, decision.reasoning, flow.agentId)
        return {
          decision: 'fail',
          reasoning: decision.reasoning,
          confidence: decision.confidence
        }

      default:
        throw createError({
          statusCode: 500,
          statusMessage: `Unknown decision type: ${(decision as any).type}`
        })
    }
  }

  private async handleWaitForAgent(flow: AgentFlow, decision: FlowDecision): Promise<void> {
    this.validateTargetAgent(decision)
    const { fromAgent, toAgentEmail } = await this.resolveAgentEmails(flow, decision)

    // Generate unique request ID for tracking this specific request
    const requestId = `req-${nanoid(8)}`

    // Format message body in email forwarding style with original email context
    const formattedBody = this.formatForwardedMessage(
      decision.targetAgent!.messageBody,
      flow.trigger,
      flow.requester
    )

    // Send email to target agent with request ID
    const { MessageRouter } = await import('./messageRouter')
    // Update flow status to waiting BEFORE sending email
    // Ensures the inbound handler (webhook or development simulation) finds the flow waiting
    flow.status = 'waiting'
    flow.waitingFor = {
      type: 'agent_response',
      agentId: decision.targetAgent.agentId || toAgentEmail, // Store email or legacy ID
      requestId: requestId,
      expectedBy: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
    }
    flow.updatedAt = new Date().toISOString()

    // Add to current round's messages
    const currentRound = flow.rounds[flow.rounds.length - 1]
    if (currentRound) {
      currentRound.messages.push({
        id: `msg-${nanoid(8)}`,
        direction: 'sent',
        to: toAgentEmail,
        subject: `[Req: ${requestId}] ${decision.targetAgent.messageSubject}`,
        body: formattedBody,
        timestamp: new Date().toISOString()
      })

      flow.metadata.totalAgentMessages++
    }

    // Save flow BEFORE sending email so recipient can find it in waiting state
    await this.saveFlow(flow)
    console.log(`[AgentFlowEngine] ✓ Flow ${flow.id} saved as WAITING before sending email`)

    // NOW send the email
    const messageRouter = new MessageRouter()

    try {
      await messageRouter.sendAgentToAgentEmail({
        fromAgentEmail: fromAgent.email,
        toAgentEmail: toAgentEmail,
        subject: decision.targetAgent.messageSubject,
        body: formattedBody,
        flowId: flow.id,
        requestId: requestId
      })
    } catch (error) {
      console.error('[AgentFlowEngine] Failed to send email to agent:', error)
      throw error
    }

    console.log(`[AgentFlowEngine] 📧 Email dispatched to: ${toAgentEmail}`)
    console.log(
      `[AgentFlowEngine] 📧 Subject: [Req: ${requestId}] ${decision.targetAgent.messageSubject}`
    )
    console.log(
      `[AgentFlowEngine] ⏳ Flow ${flow.id} now waiting for response from agent ${toAgentEmail}`
    )
    console.log(`[AgentFlowEngine] ⏳ Request ID: ${requestId}`)
  }

  /**
   * Format message body in email forwarding style with original email context
   */
  private formatForwardedMessage(
    messageBody: string,
    trigger: EmailTrigger,
    requester: FlowRequester
  ): string {
    const date = new Date(trigger.receivedAt).toLocaleString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })

    return `${messageBody}

---- Original Message ----
Date: ${date}
From: ${requester.name || requester.email} <${requester.email}>
To: ${trigger.to}
Subject: ${trigger.subject}

${trigger.body}`
  }

  private validateTargetAgent(decision: FlowDecision): void {
    if (!decision.targetAgent) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Decision type is wait_for_agent but targetAgent is not specified'
      })
    }
  }

  private async resolveAgentEmails(flow: AgentFlow, decision: FlowDecision) {
    const agents = await this.loadAgents()

    const fromAgent = agents.find((a) => a?.id === flow.agentId)
    if (!fromAgent?.email) {
      throw createError({
        statusCode: 500,
        statusMessage: `Agent ${flow.agentId} not found or has no email`
      })
    }

    const toAgentEmail = this.resolveTargetAgentEmail(agents, decision)
    if (!toAgentEmail) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Target agent email not specified and could not be resolved'
      })
    }

    return { fromAgent, toAgentEmail }
  }

  private async loadAgents() {
    const agentsStorage = useStorage('agents')
    return (
      (await agentsStorage.getItem<Array<{ id?: string; email?: string }>>('agents.json')) || []
    )
  }

  private resolveTargetAgentEmail(
    agents: Array<{ id?: string; email?: string }>,
    decision: FlowDecision
  ): string | null {
    // Try email first (preferred)
    if (decision.targetAgent?.agentEmail) {
      return decision.targetAgent.agentEmail
    }

    // Legacy support: look up email by ID
    if (decision.targetAgent?.agentId) {
      const toAgent = agents.find((a) => a?.id === decision.targetAgent?.agentId)
      return toAgent?.email || null
    }

    return null
  }

  private async handleWaitForMcp(flow: AgentFlow, decision: FlowDecision): Promise<void> {
    if (!decision.mcpCall) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Decision type is wait_for_mcp but mcpCall is not specified'
      })
    }

    // TODO: Implement MCP call logic
    console.log(`[AgentFlowEngine] TODO: Call MCP server ${decision.mcpCall.serverId}`)
    console.log(`Method: ${decision.mcpCall.method}`)
    console.log(`Params: ${JSON.stringify(decision.mcpCall.params)}`)

    // For now, mark as failed
    throw createError({
      statusCode: 501,
      statusMessage: 'MCP calls not yet implemented'
    })
  }

  private async saveFlow(flow: AgentFlow): Promise<void> {
    const path = this.getAgentFlowPath(flow.agentId, flow.id)
    await this.storage.setItem(path, flow)
  }

  private async loadFlow(flowId: string, agentId?: string): Promise<AgentFlow | null> {
    // If agentId not provided, try to extract from flowId (e.g., flow-agent-a-123)
    if (!agentId) {
      const match = flowId.match(/^flow-([^-]+)-/)
      if (match) {
        agentId = match[1]
      } else {
        console.warn('[AgentFlowEngine] Loading flow without agentId, cannot determine path')
        return null
      }
    }

    const path = this.getAgentFlowPath(agentId, flowId)
    return await this.storage.getItem<AgentFlow>(path)
  }

  private async listFlows(filters?: {
    agentId?: string
    status?: FlowStatus[]
  }): Promise<AgentFlow[]> {
    const allFlows: AgentFlow[] = []

    if (filters?.agentId) {
      // List flows for specific agent only
      const keys = await this.storage.getKeys(`${filters.agentId}/flows/`)

      for (const key of keys) {
        const flow = await this.storage.getItem<AgentFlow>(key)
        if (!flow) continue

        if (filters.status && !filters.status.includes(flow.status)) continue

        allFlows.push(flow)
      }
    } else {
      // List flows across all agents (less efficient, avoid if possible)
      console.warn('[AgentFlowEngine] Listing flows without agentId filter, this is slow')
      // TODO: Implement agent discovery and iterate through each agent's flows
      // For now, this is intentionally limited to encourage agent-specific queries
    }

    return allFlows
  }

  private async getAgent(agentId: string): Promise<any> {
    const agentsStorage = useStorage('agents')
    const agents = (await agentsStorage.getItem<any[]>('agents.json')) || []
    const agent = agents.find((a) => a?.id === agentId)

    if (!agent) {
      throw createError({ statusCode: 404, statusMessage: `Agent ${agentId} not found` })
    }

    return agent
  }

  private extractNameFromEmail(emailHeader: string): string {
    // Extract name from "Name <email@domain.com>" format
    const match = emailHeader.match(/^([^<]+)</)
    if (match) {
      return match[1].trim().replace(/['"]/g, '')
    }

    // Fallback to email username
    const email = emailHeader.trim()
    return email.split('@')[0]
  }
}

// Export singleton instance
export const agentFlowEngine = new AgentFlowEngine()
