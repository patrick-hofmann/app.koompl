/**
 * Decision Engine - AI-Powered Decision Making
 *
 * This engine analyzes flow state and makes intelligent decisions about next actions.
 * It uses AI to determine whether to continue, wait for agents, or complete.
 */

import type { AgentFlow, FlowDecision } from '../types/agent-flows'
import type { DecisionContext } from '../types/decision-engine'
import type { Agent } from '~/types'
import {
  getKanbanTools,
  executeKanbanTool,
  getCalendarTools,
  getAgentsDirectoryTools,
  executeAgentsDirectoryTool,
  getDatasafeTools,
  executeDatasafeTool
} from './builtinMcpTools'
import { executeCalendarTool } from './builtinCalendarTools'
import { normalizeMailPolicy, formatMailPolicySummary } from './mailPolicy'

export class DecisionEngine {
  /**
   * Make a decision about what to do next in the flow
   */
  async makeDecision(context: DecisionContext): Promise<FlowDecision> {
    const { flow, agent } = context

    // Check if agent has builtin MCP servers that support direct tool execution
    const builtinServers = await this.getBuiltinServers(agent)
    const hasBuiltinTools =
      builtinServers.kanban ||
      builtinServers.calendar ||
      builtinServers.agents ||
      builtinServers.datasafe

    // Build context for AI (overlay predefined agent properties at runtime)
    const { withPredefinedOverride } = await import('./predefinedKoompls')
    const effectiveAgent = withPredefinedOverride(agent as Agent)

    const prompt = await this.buildDecisionPrompt(flow, effectiveAgent)

    // Call AI to make decision
    try {
      console.log(`[DecisionEngine] Requesting decision from AI for flow ${flow.id}`)

      let decision: FlowDecision

      // Use function calling if builtin tools are available and flow has context
      if (hasBuiltinTools && flow.teamId && flow.userId) {
        console.log(`[DecisionEngine] Using direct tool execution (builtin servers available)`)
        decision = await this.callAIWithTools(prompt, effectiveAgent, flow, builtinServers)
      } else {
        decision = await this.callAI(prompt, effectiveAgent)
      }

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

    // Add current date/time context
    const now = new Date()
    const currentDateTime = now.toISOString()
    const currentDate = now.toISOString().split('T')[0]
    const currentTime = now.toTimeString().split(' ')[0]
    const dayOfWeek = now.toLocaleDateString('de-DE', { weekday: 'long' })

    // Summarize actions taken
    const actionsSummary = this.summarizeActions(flow)

    // Summarize information gathered
    const informationSummary = this.summarizeInformation(flow)

    // Get available agents (pass teamId for proper email construction)
    const availableAgents = await this.getAvailableAgents(agent, flow.teamId)

    const systemPrompt = agent.prompt || 'You are a helpful AI assistant.'

    // Check if this is the first round (encourage immediate completion if possible)
    const isFirstRound = currentRound === 0 || flow.rounds.length === 0
    const efficiencyGuidance = isFirstRound
      ? '\n⚡ EFFICIENCY FIRST: This is the first round. If you can fully answer the request with available tools or information, COMPLETE immediately. Multi-round processing is only for complex scenarios requiring agent coordination.\n'
      : ''

    return `${systemPrompt}

CURRENT CONTEXT:
- Current Date: ${currentDate} (${dayOfWeek})
- Current Time: ${currentTime}
- Current DateTime (ISO): ${currentDateTime}
${flow.userId ? `- User ID: ${flow.userId}` : ''}
${flow.teamId ? `- Team ID: ${flow.teamId}` : ''}
${efficiencyGuidance}
CURRENT SITUATION:
You are processing a request in a multi-round flow system.

Original Request From: ${flow.requester.name} (${flow.requester.email})
Subject: ${originalSubject}
Body: ${originalRequest}
${
  flow.trigger.attachments && flow.trigger.attachments.length > 0
    ? `
Attachments received:
${flow.trigger.attachments
  .map((att) => `- ${att.filename} (${att.mimeType}, ${att.size} bytes) - stored at: ${att.path}`)
  .join('\n')}
`
    : ''
}

Current Progress:
- Round: ${currentRound + 1}/${maxRounds}
- Actions Taken: ${actionsSummary}
- Information Gathered: ${informationSummary}

Available Actions:
1. COMPLETE - ⭐ You have enough information to respond (PREFERRED for simple requests)
2. WAIT_FOR_AGENT - Need information from another agent
3. CONTINUE - Need to gather more info or process data in another round
4. FAIL - Cannot fulfill the user's request

${availableAgents ? `Available Agents You Can Contact:\n${availableAgents}` : ''}

DECISION GUIDELINES:
✅ COMPLETE if:
   - You can answer the request with current information
   - You have successfully executed all required actions
   - Simple requests (calendar events, status checks, etc.) should complete in round 1
   - You have everything needed for a helpful response

🛡️ MAIL POLICY:
   - You may only communicate with recipients permitted by the mail policy shown above.
   - Never attempt to email or loop in addresses outside the allowed set.

⏸️ WAIT_FOR_AGENT if:
   - You genuinely need information only another agent has
   - The request explicitly mentions coordination with others
   - You cannot proceed without external input

🔄 CONTINUE if:
   - You need to process data or make calculations
   - You need to check multiple sources sequentially
   - NOT for simple tool calls (use function calling instead)

❌ FAIL if:
   - The request is impossible or unclear after clarification
   - You lack the necessary tools or permissions

TEMPORAL CONTEXT:
- "heute" / "today" = ${currentDate}
- "morgen" / "tomorrow" = ${new Date(now.getTime() + 86400000).toISOString().split('T')[0]}
- "gestern" / "yesterday" = ${new Date(now.getTime() - 86400000).toISOString().split('T')[0]}
- "Mittag" = 12:00, "Vormittag" = 09:00-12:00, "Nachmittag" = 13:00-17:00, "Abend" = 18:00-22:00
- Always use ISO 8601 format for dates: YYYY-MM-DDTHH:MM:SS

IMPORTANT: When you choose COMPLETE:
- The "final_response" field is YOUR response TO THE ORIGINAL USER (${flow.requester.name})
- Write naturally and directly to the user
- DO NOT forward messages from other agents - synthesize the information
- Do NOT mention internal processes (tools, agents, rounds)
- Keep it concise and helpful
- Respond in the same language as the request (German/English)

Respond ONLY with valid JSON in this exact format:
{
  "decision": "COMPLETE" | "WAIT_FOR_AGENT" | "CONTINUE" | "FAIL",
  "reasoning": "brief explanation of why you chose this action",
  "confidence": 0.0 to 1.0,
  "target_agent": {
    "agent_email": "agent-username@domain.tld (use EXACT email from available agents list)",
    "question": "what specific information do you need",
    "message_subject": "subject line for the email",
    "message_body": "full email body to send"
  },
  "final_response": "your complete response to ${flow.requester.name}"
}

Notes:
- Include "target_agent" ONLY if decision is "WAIT_FOR_AGENT"
- Include "final_response" ONLY if decision is "COMPLETE"
- Confidence should reflect how certain you are (0.8+ for clear requests)
- Keep reasoning concise but informative`
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

  /**
   * Call AI with function calling support for builtin tools
   */
  private async callAIWithTools(
    prompt: string,
    agent: DecisionContext['agent'],
    flow: AgentFlow,
    builtinServers: { kanban: boolean; calendar: boolean; agents: boolean; datasafe: boolean }
  ): Promise<FlowDecision> {
    const openaiKey = await this.getOpenAiKey()

    // Collect tools from builtin servers
    const tools: any[] = []

    const kanbanTools = builtinServers.kanban ? getKanbanTools() : []
    const calendarTools = builtinServers.calendar ? getCalendarTools() : []
    const agentDirectoryTools = builtinServers.agents ? getAgentsDirectoryTools() : []
    const datasafeTools = builtinServers.datasafe ? getDatasafeTools() : []

    const kanbanToolNames = new Set(kanbanTools.map((tool) => tool.name))
    const calendarToolNames = new Set(calendarTools.map((tool) => tool.name))
    const agentDirectoryToolNames = new Set(agentDirectoryTools.map((tool) => tool.name))
    const datasafeToolNames = new Set(datasafeTools.map((tool) => tool.name))

    if (kanbanTools.length > 0) {
      tools.push(
        ...kanbanTools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }
        }))
      )
    }

    if (calendarTools.length > 0) {
      tools.push(
        ...calendarTools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }
        }))
      )
    }

    if (agentDirectoryTools.length > 0) {
      tools.push(
        ...agentDirectoryTools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }
        }))
      )
    }

    if (datasafeTools.length > 0) {
      tools.push(
        ...datasafeTools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }
        }))
      )
    }

    console.log(`[DecisionEngine] Loaded ${tools.length} builtin tools`)

    // Create context for tool execution
    const context = {
      teamId: flow.teamId!,
      userId: flow.userId!,
      agentId: agent.id
    }

    // Track downloaded files for potential email attachments
    const downloadedFiles: Array<{
      filename: string
      content: string
      mimeType: string
      size: number
    }> = []

    // Include original email attachments
    if (flow.trigger.attachments && flow.trigger.attachments.length > 0) {
      console.log(
        `[DecisionEngine] Including ${flow.trigger.attachments.length} original email attachments`
      )
      for (const attachment of flow.trigger.attachments) {
        // We need to read the file from datasafe to get the base64 content
        try {
          const datasafeContext = {
            teamId: flow.teamId!,
            userId: flow.userId!,
            agentId: agent.id
          }
          const downloadResult = await executeDatasafeTool(datasafeContext, 'download_file', {
            path: attachment.path
          })
          if (downloadResult && !downloadResult.isError) {
            const resultData = JSON.parse(downloadResult.content[0]?.text || '{}')
            if (resultData.success && resultData.data?.base64) {
              downloadedFiles.push({
                filename: attachment.filename,
                content: resultData.data.base64,
                mimeType: attachment.mimeType,
                size: attachment.size
              })
              console.log(`[DecisionEngine] Included original attachment: ${attachment.filename}`)
            }
          }
        } catch (error) {
          console.warn(
            `[DecisionEngine] Failed to include original attachment ${attachment.filename}:`,
            error
          )
        }
      }
    }

    // Enhanced prompt with current date/time
    const now = new Date()
    const currentDateTime = now.toISOString()
    const currentDate = now.toISOString().split('T')[0]
    const currentTime = now.toTimeString().split(' ')[0]
    const dayOfWeek = now.toLocaleDateString('de-DE', { weekday: 'long' })

    // Check if first round for efficiency guidance
    const isFirstRound = flow.currentRound === 0 || flow.rounds.length === 0

    const enhancedPrompt = `${prompt}

CURRENT CONTEXT:
- Current Date: ${currentDate} (${dayOfWeek})
- Current Time: ${currentTime}
- Current DateTime (ISO): ${currentDateTime}
- User ID: ${flow.userId}
- Team ID: ${flow.teamId}
- Mail Policy:
  ${formatMailPolicySummary(normalizeMailPolicy(agent as Agent)).replace(/\n/g, '\n  ')}

${isFirstRound ? '⚡ EFFICIENCY: This is round 1. Use tools to complete the request immediately if possible.\n' : ''}
TEMPORAL CONTEXT:
- "heute" / "today" = ${currentDate}
- "morgen" / "tomorrow" = ${new Date(now.getTime() + 86400000).toISOString().split('T')[0]}
- "gestern" / "yesterday" = ${new Date(now.getTime() - 86400000).toISOString().split('T')[0]}
- "Mittag" = 12:00, "Vormittag" = 09:00-12:00, "Nachmittag" = 13:00-17:00, "Abend" = 18:00-22:00

TOOL USAGE GUIDELINES:
- Always use ISO 8601 format for dates: YYYY-MM-DDTHH:MM:SS
- When calling list_events, list_boards, etc., use the User ID shown above
- Use tools multiple times if needed (e.g., list then modify)
- After tool execution, evaluate if you have enough information

FILE ATTACHMENTS:
- Original email attachments are available and will be included in your response
- If you download additional files using datasafe tools, they will be automatically attached to your email response
- Downloaded files are captured when you use the 'download_file' tool
- You can mention the attached files in your response text

AFTER USING TOOLS:
1. If the request is fulfilled → Choose "COMPLETE" with a natural response
2. If you need to contact another agent → Choose "WAIT_FOR_AGENT"  
3. If you need more processing → Choose "CONTINUE" (rare)
4. If it's impossible → Choose "FAIL" with explanation

⭐ Single-round completion is ENCOURAGED for simple requests (create event, list items, etc.)`

    const messages: Array<{
      role: string
      content: string
      tool_calls?: any
      tool_call_id?: string
      name?: string
    }> = [{ role: 'user', content: enhancedPrompt }]

    let iterations = 0
    const maxIterations = 5

    while (iterations < maxIterations) {
      iterations++

      const response: any = await $fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          tools,
          temperature: 0.3,
          max_tokens: 1500
        })
      })

      const choice = response.choices?.[0]
      if (!choice) break

      const message = choice.message
      messages.push(message)

      // If AI wants to use tools, execute them
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`[DecisionEngine] AI is calling ${message.tool_calls.length} tools`)

        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name
          const args = JSON.parse(toolCall.function.arguments || '{}')

          console.log(`[DecisionEngine] Executing tool: ${functionName}`, args)

          let resultContent: string
          try {
            // Determine which tool executor to use
            let mcpResult: any

            if (calendarToolNames.has(functionName)) {
              mcpResult = await executeCalendarTool(context, functionName, args)
            } else if (kanbanToolNames.has(functionName)) {
              mcpResult = await executeKanbanTool(context, functionName, args)
            } else if (agentDirectoryToolNames.has(functionName)) {
              mcpResult = await executeAgentsDirectoryTool(
                { teamId: context.teamId },
                functionName,
                args
              )
            } else if (datasafeToolNames.has(functionName)) {
              mcpResult = await executeDatasafeTool(context, functionName, args)

              // If this is a download_file tool, capture the file for potential attachment
              if (functionName === 'download_file' && mcpResult && !mcpResult.isError) {
                try {
                  const resultData = JSON.parse(mcpResult.content[0]?.text || '{}')
                  if (resultData.success && resultData.data?.base64) {
                    const filePath = args.path as string
                    const filename = filePath.split('/').pop() || 'downloaded_file'
                    const mimeType = this.guessMimeType(filename)

                    downloadedFiles.push({
                      filename,
                      content: resultData.data.base64,
                      mimeType,
                      size:
                        resultData.data.node?.size ||
                        Buffer.from(resultData.data.base64, 'base64').length
                    })

                    console.log(
                      `[DecisionEngine] Captured downloaded file: ${filename} (${mimeType})`
                    )
                  }
                } catch (error) {
                  console.warn('[DecisionEngine] Failed to capture downloaded file:', error)
                }
              }
            } else {
              throw new Error(`Unknown tool: ${functionName}`)
            }

            if (mcpResult.isError) {
              resultContent =
                mcpResult.content[0]?.text || JSON.stringify({ error: 'Tool execution failed' })
            } else {
              resultContent = mcpResult.content[0]?.text || JSON.stringify({ success: true })
            }
          } catch (error) {
            resultContent = JSON.stringify({
              error: error instanceof Error ? error.message : String(error)
            })
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: functionName,
            content: resultContent
          })
        }

        // Continue loop to let AI process tool results
        continue
      }

      // No more tool calls - AI should provide final decision
      const content = message.content || ''

      // Try to parse as decision JSON
      try {
        const parsed = this.parseJsonResponse(content)
        const decision = this.buildDecisionFromParsed(parsed)

        // Include downloaded files as attachments if completing
        if (decision.type === 'complete' && downloadedFiles.length > 0) {
          decision.attachments = downloadedFiles
          console.log(`[DecisionEngine] Including ${downloadedFiles.length} file(s) as attachments`)
        }

        return decision
      } catch {
        // If not JSON, treat as a complete response
        console.log('[DecisionEngine] AI response is not JSON, treating as completion')
        const decision: FlowDecision = {
          type: 'complete',
          reasoning: 'AI provided natural language response after tool execution',
          confidence: 0.8,
          finalResponse: content
        }

        // Include downloaded files as attachments
        if (downloadedFiles.length > 0) {
          decision.attachments = downloadedFiles
          console.log(`[DecisionEngine] Including ${downloadedFiles.length} file(s) as attachments`)
        }

        return decision
      }
    }

    // Max iterations reached
    console.warn('[DecisionEngine] Max iterations reached in tool execution')
    return {
      type: 'fail',
      reasoning: 'Maximum tool execution iterations reached',
      confidence: 0.5,
      finalResponse:
        'I apologize, but I was unable to complete your request after multiple attempts. Please try rephrasing your request.'
    }
  }

  /**
   * Detect which builtin MCP servers the agent has access to
   */
  private async getBuiltinServers(agent: DecisionContext['agent']): Promise<{
    kanban: boolean
    calendar: boolean
    agents: boolean
    datasafe: boolean
  }> {
    if (!agent.mcpServerIds || agent.mcpServerIds.length === 0) {
      return { kanban: false, calendar: false, agents: false, datasafe: false }
    }

    // Load MCP server configurations
    const mcpStorage = useStorage('mcp')
    const servers =
      (await mcpStorage.getItem<
        Array<{
          id: string
          provider: string
        }>
      >('servers.json')) || []

    let hasKanban = false
    let hasCalendar = false
    let hasAgents = false
    let hasDatasafe = false

    for (const serverId of agent.mcpServerIds) {
      const server = servers.find((s) => s.id === serverId)
      if (server) {
        if (server.provider === 'builtin-kanban') hasKanban = true
        if (server.provider === 'builtin-calendar') hasCalendar = true
        if (server.provider === 'builtin-agents') hasAgents = true
        if (server.provider === 'builtin-datasafe') hasDatasafe = true
      }
    }

    console.log(
      `[DecisionEngine] Builtin servers detected: kanban=${hasKanban}, calendar=${hasCalendar}, agents=${hasAgents}, datasafe=${hasDatasafe}`
    )

    return { kanban: hasKanban, calendar: hasCalendar, agents: hasAgents, datasafe: hasDatasafe }
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

  /**
   * Guess MIME type from filename extension
   */
  private guessMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop()
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      csv: 'text/csv',
      zip: 'application/zip',
      mp3: 'audio/mpeg',
      mp4: 'video/mp4',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      wav: 'audio/wav'
    }
    return mimeTypes[ext || ''] || 'application/octet-stream'
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
  private async getAvailableAgents(
    agent: DecisionContext['agent'],
    teamId?: string
  ): Promise<string | null> {
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

    // Helper to construct full email with team domain
    const { getAgentFullEmail } = await import('./agentEmailHelpers')

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
            teamId?: string
          }>
        >('agents.json')) || []

      const otherAgents = allAgents.filter(
        (a) => a?.email && a.email.toLowerCase() !== agent.email.toLowerCase()
      )

      if (otherAgents.length === 0) {
        return 'You can communicate with other agents, but no other agents are available.'
      }

      // Construct full emails with team domain
      const agentListPromises = otherAgents.map(async (a) => {
        const fullEmail = await getAgentFullEmail(a.email || '', teamId || a.teamId)
        return `- ${fullEmail} (${a.name} - ${a.role || 'Agent'})`
      })
      const agentList = await Promise.all(agentListPromises)
      return agentList.join('\n')
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
          teamId?: string
        }>
      >('agents.json')) || []

    const allowedAgents = allAgents.filter(
      (a) => a?.email && allowedEmails.includes(a.email.toLowerCase())
    )

    if (allowedAgents.length === 0) {
      return 'Configured agents not found.'
    }

    // Construct full emails with team domain
    const agentListPromises = allowedAgents.map(async (a) => {
      const fullEmail = await getAgentFullEmail(a.email || '', teamId || a.teamId)
      return `- ${fullEmail} (${a.name} - ${a.role || 'Agent'})`
    })
    const agentList = await Promise.all(agentListPromises)
    return agentList.join('\n')
  }
}
