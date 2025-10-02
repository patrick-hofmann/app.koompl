/**
 * Decision Engine - AI-Powered Decision Making
 *
 * This engine analyzes flow state and makes intelligent decisions about next actions.
 * It uses AI to determine whether to continue, wait for agents, or complete.
 */

import type { AgentFlow, FlowDecision } from '../types/agent-flows'
import type { DecisionContext } from '../types/decision-engine'

export class DecisionEngine {
  /**
   * Make a decision about what to do next in the flow
   */
  async makeDecision(context: DecisionContext): Promise<FlowDecision> {
    const { flow, agent } = context

    // Build context for AI
    const prompt = await this.buildDecisionPrompt(flow, agent)

    // Call AI to make decision
    try {
      console.log(`[DecisionEngine] Requesting decision from AI for flow ${flow.id}`)
      const decision = await this.callAI(prompt, agent)

      // Validate decision
      this.validateDecision(decision)

      // Log the decision details
      console.log(`[DecisionEngine] ✓ Decision made: ${decision.type.toUpperCase()}`)
      console.log(`[DecisionEngine]   Reasoning: ${decision.reasoning}`)
      console.log(`[DecisionEngine]   Confidence: ${(decision.confidence * 100).toFixed(0)}%`)

      if (decision.type === 'wait_for_agent' && decision.targetAgent) {
        console.log(
          `[DecisionEngine]   → Will contact agent: ${decision.targetAgent.agentEmail || decision.targetAgent.agentId}`
        )
        console.log(`[DecisionEngine]   → Subject: ${decision.targetAgent.messageSubject}`)
        console.log(`[DecisionEngine]   → Question: ${decision.targetAgent.question}`)
      } else if (decision.type === 'complete' && decision.finalResponse) {
        console.log(
          `[DecisionEngine]   → Will send final response to user (${decision.finalResponse.length} chars)`
        )
      } else if (decision.type === 'wait_for_mcp' && decision.mcpCall) {
        console.log(`[DecisionEngine]   → Will call MCP: ${decision.mcpCall.serverId}`)
      } else if (decision.type === 'fail') {
        console.log('[DecisionEngine]   ✗ Flow will fail')
      }

      return decision
    } catch (error) {
      console.error('[DecisionEngine] ✗ Error making decision:', error)
      console.error('[DecisionEngine] Error details:', {
        flowId: flow.id,
        agentId: agent.id,
        currentRound: flow.currentRound,
        error: error instanceof Error ? error.message : String(error)
      })

      // Fallback: try to complete with what we have
      return {
        type: 'fail',
        reasoning: `Decision engine error: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 0,
        finalResponse:
          'I apologize, but I encountered an error processing your request. Please try again.'
      }
    }
  }

  /**
   * Build decision prompt for AI
   */
  private async buildDecisionPrompt(
    flow: AgentFlow,
    agent: DecisionContext['agent']
  ): Promise<string> {
    const originalRequest = flow.trigger.body
    const originalSubject = flow.trigger.subject
    const currentRound = flow.currentRound
    const maxRounds = flow.maxRounds

    // Summarize actions taken
    const actionsSummary = this.summarizeActions(flow)

    // Summarize information gathered
    const informationSummary = this.summarizeInformation(flow)

    // Get available agents
    const availableAgents = await this.getAvailableAgents(agent)

    const systemPrompt = agent.prompt || 'You are a helpful AI assistant.'

    return `${systemPrompt}

CURRENT SITUATION:
You are processing a request in a multi-round flow.

Original Request From: ${flow.requester.name} (${flow.requester.email})
Subject: ${originalSubject}
Body: ${originalRequest}

Current Progress:
- Round: ${currentRound}/${maxRounds}
- Actions Taken: ${actionsSummary}
- Information Gathered: ${informationSummary}

Available Actions:
1. CONTINUE - Take another action in this flow (gather more info, process data, etc.)
2. WAIT_FOR_AGENT - Need information from another agent
3. COMPLETE - You have enough information to respond to the user
4. FAIL - Cannot fulfill the user's request

${availableAgents ? `Available Agents You Can Contact:\n${availableAgents}` : ''}

TASK:
Analyze the situation and decide what to do next. Consider:
1. Do you have all the information needed to answer the user's original request?
2. If not, what information is missing and where can you get it?
3. Is the request even possible to fulfill?

IMPORTANT: When you choose COMPLETE:
- The "final_response" field should be YOUR response TO THE ORIGINAL USER (${flow.requester.name} - ${flow.requester.email})
- DO NOT forward what other agents told you - synthesize the information into YOUR OWN response
- Address the original user directly (${flow.requester.name}) - NOT other agents you consulted
- Answer their original question based on the information you gathered
- Remember: You are responding TO ${flow.requester.name}, not to the agents who helped you
- If other agents said things like "Hallo Christian", ignore that - they were talking to you, but your response goes to ${flow.requester.name}

Respond ONLY with valid JSON in this exact format:
{
  "decision": "CONTINUE" | "WAIT_FOR_AGENT" | "COMPLETE" | "FAIL",
  "reasoning": "detailed explanation of why you chose this action",
  "confidence": 0.0 to 1.0,
  "target_agent": {
    "agent_email": "agent-b@koompl.local",
    "question": "what specific information do you need",
    "message_subject": "subject line for the email",
    "message_body": "full email body to send"
  },
  "final_response": "your complete response to the original user ${flow.requester.name}"
}

Notes:
- Include "target_agent" ONLY if decision is "WAIT_FOR_AGENT"
- Include "final_response" ONLY if decision is "COMPLETE"
- Be specific in your reasoning
- Confidence should reflect how certain you are`
  }

  /**
   * Call AI to get decision
   */
  private async callAI(prompt: string, _agent: DecisionContext['agent']): Promise<FlowDecision> {
    const openaiKey = await this.getOpenAiKey()
    const response = await this.callOpenAiApi(prompt, openaiKey)
    const content = this.extractResponseContent(response)
    const parsed = this.parseJsonResponse(content)

    return this.buildDecisionFromParsed(parsed)
  }

  private async getOpenAiKey(): Promise<string> {
    const settingsStorage = useStorage('settings')
    const settings = (await settingsStorage.getItem<Record<string, unknown>>('settings.json')) || {}

    const envKey = (process.env as Record<string, unknown>)['OPENAI_API_KEY']
    const settingsKey = (settings as Record<string, unknown>)['openaiApiKey']
    const openaiKey = String(envKey || settingsKey || '').trim()

    if (!openaiKey) {
      throw new Error('OpenAI API key not configured')
    }

    return openaiKey
  }

  private async callOpenAiApi(prompt: string, openaiKey: string) {
    return await $fetch<{
      choices?: Array<{ message?: { content?: string } }>
    }>('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000
      })
    })
  }

  private extractResponseContent(response: any): string {
    const content = response?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('No response from AI')
    }
    return content
  }

  private parseJsonResponse(content: string) {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AI response is not valid JSON')
    }

    return JSON.parse(jsonMatch[0])
  }

  private buildDecisionFromParsed(parsed: any): FlowDecision {
    const decision: FlowDecision = {
      type: this.mapDecisionType(parsed.decision),
      reasoning: String(parsed.reasoning || 'No reasoning provided'),
      confidence: Number(parsed.confidence || 0.5)
    }

    // Add optional fields based on decision type
    if (decision.type === 'wait_for_agent' && parsed.target_agent) {
      decision.targetAgent = {
        agentId: String(parsed.target_agent.agent_id || ''),
        agentEmail: String(parsed.target_agent.agent_email || ''),
        question: String(parsed.target_agent.question || ''),
        messageSubject: String(parsed.target_agent.message_subject || 'Request for information'),
        messageBody: String(parsed.target_agent.message_body || '')
      }
    }

    if (decision.type === 'complete' && parsed.final_response) {
      decision.finalResponse = String(parsed.final_response)
    }

    return decision
  }

  /**
   * Map string decision to type
   */
  private mapDecisionType(decision: string): FlowDecision['type'] {
    const normalized = decision.toUpperCase()

    switch (normalized) {
      case 'CONTINUE':
        return 'continue'
      case 'WAIT_FOR_AGENT':
        return 'wait_for_agent'
      case 'WAIT_FOR_MCP':
        return 'wait_for_mcp'
      case 'COMPLETE':
        return 'complete'
      case 'FAIL':
        return 'fail'
      default:
        console.warn(`[DecisionEngine] Unknown decision type: ${decision}, defaulting to continue`)
        return 'continue'
    }
  }

  /**
   * Validate decision structure
   */
  private validateDecision(decision: FlowDecision): void {
    if (!decision.type) {
      throw new Error('Decision must have a type')
    }

    if (!decision.reasoning) {
      throw new Error('Decision must have reasoning')
    }

    if (
      typeof decision.confidence !== 'number' ||
      decision.confidence < 0 ||
      decision.confidence > 1
    ) {
      throw new Error('Decision confidence must be between 0 and 1')
    }

    if (decision.type === 'wait_for_agent' && !decision.targetAgent) {
      throw new Error('WAIT_FOR_AGENT decision must include targetAgent')
    }

    if (decision.type === 'complete' && !decision.finalResponse) {
      throw new Error('COMPLETE decision must include finalResponse')
    }
  }

  /**
   * Summarize actions taken in previous rounds
   */
  private summarizeActions(flow: AgentFlow): string {
    if (flow.rounds.length === 0) {
      return 'This is the first round, no actions taken yet.'
    }

    const actions: string[] = []

    for (const round of flow.rounds) {
      const decision = round.decision

      if (decision.type === 'wait_for_agent') {
        actions.push(`Round ${round.roundNumber}: Requested information from another agent`)
      } else if (decision.type === 'wait_for_mcp') {
        actions.push(`Round ${round.roundNumber}: Called MCP server`)
      } else {
        actions.push(`Round ${round.roundNumber}: ${decision.reasoning}`)
      }
    }

    return actions.join('\n')
  }

  /**
   * Summarize information gathered
   */
  private summarizeInformation(flow: AgentFlow): string {
    const information: string[] = []

    for (const round of flow.rounds) {
      // Check for received messages
      const receivedMessages = round.messages.filter((m) => m.direction === 'received')

      for (const msg of receivedMessages) {
        // Extract the core information, removing greeting/salutation parts
        const cleanBody = msg.body
          .replace(/^(Hallo|Hello|Hi|Liebe|Dear)\s+\w+,?\s*/i, '')
          .replace(/^(Viele Grüße|Best regards|Thanks|Thank you),?\s*$/i, '')
          .trim()

        information.push(
          `Agent ${msg.from} provided: ${cleanBody.substring(0, 300)}${cleanBody.length > 300 ? '...' : ''}`
        )
      }

      // Check for MCP results
      if (round.mcpCalls.length > 0) {
        information.push(`MCP data retrieved: ${round.mcpCalls.length} calls`)
      }
    }

    if (information.length === 0) {
      return 'No additional information gathered yet (first round).'
    }

    return information.join('\n\n')
  }

  /**
   * Get list of available agents
   */
  private async getAvailableAgents(agent: DecisionContext['agent']): Promise<string | null> {
    const multiRoundConfig = agent.multiRoundConfig

    if (!multiRoundConfig?.canCommunicateWithAgents) {
      return null
    }

    // Get allowed emails (with migration support from old allowedAgentIds)
    let allowedEmails = multiRoundConfig.allowedAgentEmails || []

    // Migration: if allowedAgentEmails is empty but allowedAgentIds exists, convert IDs to emails
    if (
      allowedEmails.length === 0 &&
      (multiRoundConfig as Record<string, unknown>).allowedAgentIds
    ) {
      const agentsStorage = useStorage('agents')
      const allAgents =
        (await agentsStorage.getItem<
          Array<{
            id?: string
            email?: string
          }>
        >('agents.json')) || []

      const oldIds = (multiRoundConfig as Record<string, unknown>).allowedAgentIds as string[]
      allowedEmails = oldIds
        .map((id) => {
          const foundAgent = allAgents.find((a) => a?.id === id)
          return foundAgent?.email
        })
        .filter((email): email is string => !!email)

      console.log(
        `[DecisionEngine Migration] Converted ${oldIds.length} agent IDs to ${allowedEmails.length} emails`
      )
    }

    if (allowedEmails.length === 0) {
      // If no specific agents configured, load all agents except current one
      const agentsStorage = useStorage('agents')
      const allAgents =
        (await agentsStorage.getItem<
          Array<{
            id?: string
            name?: string
            email?: string
            role?: string
          }>
        >('agents.json')) || []

      const otherAgents = allAgents.filter(
        (a) => a?.email && a.email.toLowerCase() !== agent.email.toLowerCase()
      )

      if (otherAgents.length === 0) {
        return 'You can communicate with other agents, but no other agents are available.'
      }

      return otherAgents.map((a) => `- ${a.email} (${a.name} - ${a.role || 'Agent'})`).join('\n')
    }

    // Load details for allowed agents
    const agentsStorage = useStorage('agents')
    const allAgents =
      (await agentsStorage.getItem<
        Array<{
          id?: string
          name?: string
          email?: string
          role?: string
        }>
      >('agents.json')) || []

    const allowedAgents = allAgents.filter(
      (a) => a?.email && allowedEmails.includes(a.email.toLowerCase())
    )

    if (allowedAgents.length === 0) {
      return 'Configured agents not found.'
    }

    return allowedAgents.map((a) => `- ${a.email} (${a.name} - ${a.role || 'Agent'})`).join('\n')
  }
}
