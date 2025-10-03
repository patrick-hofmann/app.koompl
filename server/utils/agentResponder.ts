import type { Agent } from '~/types'
import { listMcpServers } from './mcpStorage'
import { fetchMcpContext, type McpContextResult } from './mcpClients'
import { agentLogger } from './agentLogging'
import { createGeneralAgent } from './mcpAgent'
import { getKanbanTools, executeKanbanTool, getCalendarTools } from './builtinMcpTools'
import { executeCalendarTool } from './builtinCalendarTools'

export interface AgentRespondRequest {
  agentId: string
  subject?: string
  text: string
  from?: string
  includeQuote?: boolean
  maxTokens?: number
  temperature?: number
  teamId?: string
  userId?: string
  mcpContexts?: Array<{
    serverId?: string
    serverName?: string
    provider?: string
    category?: string
    summary?: string
  }>
}

export interface AgentRespondResult {
  ok: boolean
  result?: string
  error?: string
}

export async function generateAgentResponse(
  payload: AgentRespondRequest
): Promise<AgentRespondResult> {
  try {
    const {
      agentId,
      subject = '',
      text,
      from = '',
      includeQuote = true,
      maxTokens = 700,
      temperature = 0.4,
      teamId,
      userId,
      mcpContexts = []
    } = payload

    if (!text.trim()) {
      return { ok: false, error: 'email_text_required' }
    }

    // Ensure builtin MCP servers exist
    const { ensureBuiltinServers } = await import('./ensureBuiltinServers')
    await ensureBuiltinServers()

    const agentsStorage = useStorage('agents')
    const settingsStorage = useStorage('settings')

    const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
    const agent = agents.find((a) => a?.id === agentId)
    if (!agent) {
      return { ok: false, error: 'agent_not_found' }
    }

    const settings = (await settingsStorage.getItem<Record<string, unknown>>('settings.json')) || {}

    const openaiKey = getOpenAIKey(settings)
    if (!openaiKey) {
      return { ok: false, error: 'missing_openai_key' }
    }

    // Overlay predefined agent properties at runtime (prompt, role, servers, config)
    const { withPredefinedOverride } = await import('./predefinedKoompls')
    const effectiveAgent = withPredefinedOverride(agent)

    const normalizedContexts = Array.isArray(mcpContexts)
      ? mcpContexts
          .map((entry) => ({
            serverId: String(entry?.serverId || '').trim(),
            serverName: String(entry?.serverName || '').trim(),
            provider: String(entry?.provider || '').trim(),
            category: String(entry?.category || '').trim(),
            summary: String(entry?.summary || '').trim()
          }))
          .filter((entry) => entry.summary.length > 0)
      : []

    let userContent = ''
    if (subject) {
      userContent += `Subject: ${subject}\n`
    }
    if (from) {
      userContent += `From: ${from}\n`
    }
    userContent += '\nEmail body:\n' + text

    userContent += includeQuote
      ? '\n\nTask: Write a concise, helpful reply. Do not include the original message or signatures.'
      : '\n\nTask: Write a concise, helpful reply.'

    if (normalizedContexts.length) {
      userContent += '\n\nAdditional context from connected services:'
      for (const context of normalizedContexts) {
        const label = context.serverName || context.serverId || context.provider || 'MCP Server'
        userContent += `\n- [${label}] ${context.summary}`
      }
      userContent += "\n\nUse the context when it is relevant to the user's request."
    }

    // Check if agent has MCP servers configured
    const allServers = await listMcpServers()
    const selectedServers = Array.isArray(effectiveAgent.mcpServerIds)
      ? allServers.filter((s) => effectiveAgent.mcpServerIds!.includes(s.id))
      : []

    // If agent has MCP servers and teamId/userId are available, use KoomplMcpAgent for tool execution
    // Note: Currently only non-builtin servers support full MCP agent execution
    const externalServers = selectedServers.filter(
      (s) =>
        s.provider !== 'builtin-kanban' &&
        s.provider !== 'builtin-calendar' &&
        s.provider !== 'builtin-agents'
    )
    const hasBuiltinKanban = selectedServers.some((s) => s.provider === 'builtin-kanban')
    const hasBuiltinCalendar = selectedServers.some((s) => s.provider === 'builtin-calendar')
    const hasBuiltinAgents = selectedServers.some((s) => s.provider === 'builtin-agents')

    if (hasBuiltinAgents) {
      console.log('[AgentResponder] Built-in Agents directory available for context')
    }

    if (externalServers.length > 0 && teamId && userId) {
      console.log(
        '[AgentResponder] Using MCP agent with tool execution for',
        externalServers.length,
        'external servers'
      )

      const mcpAgent = createGeneralAgent({
        llmProvider: 'openai',
        model: 'gpt-4o',
        maxTokens: maxTokens || 1000,
        temperature: temperature || 0.4
      })

      const emailContext = {
        subject,
        text,
        from,
        receivedAt: new Date().toISOString()
      }

      const kanbanContext = { teamId, userId, agentId: effectiveAgent.id }

      try {
        const response = await mcpAgent.processEmail(
          emailContext,
          effectiveAgent.prompt || 'You are a helpful AI assistant.',
          externalServers,
          kanbanContext
        )

        await mcpAgent.cleanup()

        if (!response.success) {
          return { ok: false, error: response.error || 'MCP agent failed' }
        }

        return { ok: true, result: response.result || '' }
      } catch (error) {
        await mcpAgent.cleanup()
        console.error('[AgentResponder] MCP agent error:', error)
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    }

    // For builtin-kanban only: use direct function calls (no HTTP, production-ready)
    if (hasBuiltinKanban && teamId && userId && externalServers.length === 0) {
      console.log('[AgentResponder] Using direct Kanban tool executor (production-ready)')
      return await handleBuiltinKanbanWithFunctionCalling({
        agent: effectiveAgent,
        subject,
        text,
        from,
        maxTokens,
        temperature,
        openaiKey,
        teamId,
        userId
      })
    }

    // For builtin-calendar only: use direct function calls (no HTTP, production-ready)
    if (hasBuiltinCalendar && teamId && userId && externalServers.length === 0) {
      console.log('[AgentResponder] Using direct Calendar tool executor (production-ready)')
      return await handleBuiltinCalendarWithFunctionCalling({
        agent: effectiveAgent,
        subject,
        text,
        from,
        maxTokens,
        temperature,
        openaiKey,
        teamId,
        userId
      })
    }

    // Fallback: Fetch MCP context (read-only) for agents without full tool execution capability
    const fetchedMcpContexts: McpContextResult[] = []
    try {
      if (selectedServers.length) {
        const emailContext = {
          subject,
          text,
          from,
          receivedAt: new Date().toISOString()
        }
        const results = await Promise.allSettled(
          selectedServers.map((server) =>
            fetchMcpContext(server, emailContext, {
              limit: 5,
              agentId: agent.id,
              agentEmail: agent.email,
              teamId,
              userId
            })
          )
        )
        fetchedMcpContexts.push(
          ...results
            .filter(
              (r): r is PromiseFulfilledResult<McpContextResult | null> => r.status === 'fulfilled'
            )
            .map((r) => r.value)
            .filter((v): v is McpContextResult => Boolean(v))
        )
      }
    } catch (error) {
      console.warn('[AgentResponder] Failed to fetch MCP context:', error)
    }

    if (fetchedMcpContexts.length) {
      userContent += '\n\nFetched context from connected services:'
      for (const context of fetchedMcpContexts) {
        userContent += `\n- [${context.serverName || context.serverId}] ${context.summary}`
      }
      userContent += '\n\nIncorporate the fetched context when relevant.'
    }

    const messages = [
      effectiveAgent.prompt ? { role: 'system', content: String(effectiveAgent.prompt) } : null,
      { role: 'user', content: userContent }
    ].filter(Boolean) as Array<{ role: string; content: string }>

    const aiStartTime = Date.now()
    let aiResult = ''
    let aiTokens: { prompt?: number; completion?: number; total?: number } | undefined
    let aiError: string | undefined

    try {
      const res: {
        choices?: Array<{ message?: { content?: string } }>
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      } = await $fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          temperature,
          max_tokens: maxTokens
        })
      })

      aiResult = String(res?.choices?.[0]?.message?.content || '').trim()
      aiTokens = res?.usage
        ? {
            prompt: res.usage.prompt_tokens,
            completion: res.usage.completion_tokens,
            total: res.usage.total_tokens
          }
        : undefined
    } catch (error) {
      aiError = error instanceof Error ? error.message : String(error)
      console.error('[AgentResponder] OpenAI request failed:', error)
      return { ok: false, error: aiError || 'openai_error' }
    } finally {
      try {
        await agentLogger.logAiUsage({
          agentId: agent.id,
          agentEmail: agent.email,
          provider: 'openai',
          model: 'gpt-4o-mini',
          input: {
            messages,
            temperature,
            maxTokens
          },
          output: {
            result: aiResult,
            success: !aiError,
            error: aiError,
            tokens: aiTokens
          },
          metadata: {
            responseTime: Date.now() - aiStartTime,
            promptLength: userContent.length,
            responseLength: aiResult.length
          }
        })
      } catch (logError) {
        console.error('[AgentResponder] Failed to log AI usage:', logError)
      }
    }

    return { ok: true, result: aiResult }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Handle builtin Kanban with OpenAI function calling (direct tool execution, production-ready)
 */
async function handleBuiltinKanbanWithFunctionCalling(params: {
  agent: Agent
  subject: string
  text: string
  from: string
  maxTokens: number
  temperature: number
  openaiKey: string
  teamId: string
  userId: string
}): Promise<AgentRespondResult> {
  const { agent, subject, text, from, maxTokens, temperature, openaiKey, teamId, userId } = params

  // Get Kanban tools (no HTTP, direct discovery)
  const mcpTools = getKanbanTools()
  console.log(`[BuiltinKanban] Loaded ${mcpTools.length} tools`)

  // Convert MCP tools to OpenAI function calling format
  const tools = mcpTools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }))

  const context = { teamId, userId, agentId: agent.id }

  let userContent = ''
  if (subject) userContent += `Subject: ${subject}\n`
  if (from) userContent += `From: ${from}\n`
  userContent += '\nEmail body:\n' + text
  userContent +=
    '\n\nTask: Process the request and use the available Kanban tools if needed. Provide a helpful response.'

  const messages: Array<{
    role: string
    content: string
    tool_calls?: any
    tool_call_id?: string
    name?: string
  }> = [
    agent.prompt ? { role: 'system', content: String(agent.prompt) } : null,
    { role: 'user', content: userContent }
  ].filter(Boolean) as any

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
        temperature,
        max_tokens: maxTokens
      })
    })

    const choice = response.choices?.[0]
    if (!choice) break

    const message = choice.message
    messages.push(message)

    // If no tool calls, we're done
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { ok: true, result: message.content || '' }
    }

    // Execute tool calls directly (no HTTP)
    for (const toolCall of message.tool_calls) {
      const functionName = toolCall.function.name
      const args = JSON.parse(toolCall.function.arguments || '{}')

      console.log(`[BuiltinKanban] Executing tool: ${functionName}`, args)

      let resultContent: string
      try {
        const mcpResult = await executeKanbanTool(context, functionName, args)

        // Extract text from result
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
  }

  // If we exhausted iterations, return the last message
  const lastMessage = messages[messages.length - 1]
  return { ok: true, result: lastMessage.content || 'Maximum iterations reached' }
}

/**
 * Handle builtin Calendar with OpenAI function calling (direct tool execution, production-ready)
 */
async function handleBuiltinCalendarWithFunctionCalling(params: {
  agent: Agent
  subject: string
  text: string
  from: string
  maxTokens: number
  temperature: number
  openaiKey: string
  teamId: string
  userId: string
}): Promise<AgentRespondResult> {
  const { agent, subject, text, from, maxTokens, temperature, openaiKey, teamId, userId } = params

  // Get Calendar tools (no HTTP, direct discovery)
  const mcpTools = getCalendarTools()
  console.log(`[BuiltinCalendar] Loaded ${mcpTools.length} tools`)

  // Convert MCP tools to OpenAI function calling format
  const tools = mcpTools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }))

  const context = { teamId, userId, agentId: agent.id }

  // Provide current date/time context for calendar operations
  const now = new Date()
  const currentDateTime = now.toISOString()
  const currentDate = now.toISOString().split('T')[0]
  const currentTime = now.toTimeString().split(' ')[0]

  let userContent = ''
  userContent += `Current Date: ${currentDate}\n`
  userContent += `Current Time: ${currentTime}\n`
  userContent += `Current DateTime (ISO): ${currentDateTime}\n`
  userContent += `User ID: ${userId}\n\n`
  if (subject) userContent += `Subject: ${subject}\n`
  if (from) userContent += `From: ${from}\n`
  userContent += '\nEmail body:\n' + text
  userContent += '\n\nTask: Process the calendar request using the available tools.'
  userContent += '\n\nImportant guidelines:'
  userContent += '\n- Use ISO 8601 format for dates (YYYY-MM-DDTHH:MM:SS)'
  userContent += '\n- When calling list_events, use the User ID shown above as the userId parameter'
  userContent +=
    '\n- When asked to delete/modify events, FIRST use list_events to see what events exist for that user and time period'
  userContent +=
    '\n- "heute" = today, "morgen" = tomorrow, "Mittag" = noon (12:00), "Vormittag" = morning (9-12), "Nachmittag" = afternoon (13-17), "Abend" = evening (18-22)'
  userContent +=
    '\n- After listing events, identify the correct event by time/title and use its ID for delete/modify operations'
  userContent +=
    '\n- Always confirm what action was taken with specific details (event title, date/time)'

  const messages: Array<{
    role: string
    content: string
    tool_calls?: any
    tool_call_id?: string
    name?: string
  }> = [
    agent.prompt ? { role: 'system', content: String(agent.prompt) } : null,
    { role: 'user', content: userContent }
  ].filter(Boolean) as any

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
        temperature,
        max_tokens: maxTokens
      })
    })

    const choice = response.choices?.[0]
    if (!choice) break

    const message = choice.message
    messages.push(message)

    // If no tool calls, we're done
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { ok: true, result: message.content || '' }
    }

    // Execute tool calls directly (no HTTP)
    for (const toolCall of message.tool_calls) {
      const functionName = toolCall.function.name
      const args = JSON.parse(toolCall.function.arguments || '{}')

      console.log(`[BuiltinCalendar] Executing tool: ${functionName}`, args)

      let resultContent: string
      try {
        const mcpResult = await executeCalendarTool(context, functionName, args)

        // Extract text from result
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
  }

  // If we exhausted iterations, return the last message
  const lastMessage = messages[messages.length - 1]
  return { ok: true, result: lastMessage.content || 'Maximum iterations reached' }
}

function getOpenAIKey(settings: Record<string, unknown>): string | null {
  const envKey = (process.env as Record<string, unknown>)['OPENAI_API_KEY']
  const settingsKey = (settings as Record<string, unknown>)['openaiApiKey']
  const settingsKey2 = (settings as Record<string, unknown>)['OPENAI_API_KEY']
  const nestedKey = (
    (settings as Record<string, unknown>)['openai'] &&
    ((settings as Record<string, unknown>)['openai'] as { apiKey?: string })
  )?.apiKey

  return String(envKey || settingsKey || settingsKey2 || nestedKey || '').trim() || null
}
