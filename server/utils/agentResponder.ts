import type { Agent } from '~/types'
import { listMcpServers } from './mcpStorage'
import { fetchMcpContext, type McpContextResult } from './mcpClients'
import { agentLogger } from './agentLogging'

export interface AgentRespondRequest {
  agentId: string
  subject?: string
  text: string
  from?: string
  includeQuote?: boolean
  maxTokens?: number
  temperature?: number
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
      mcpContexts = []
    } = payload

    if (!text.trim()) {
      return { ok: false, error: 'email_text_required' }
    }

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

    // Fetch MCP context server-side
    const fetchedMcpContexts: McpContextResult[] = []
    try {
      const allServers = await listMcpServers()
      const selectedServers = Array.isArray(agent.mcpServerIds)
        ? allServers.filter((s) => agent.mcpServerIds!.includes(s.id))
        : []
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
              agentEmail: agent.email
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
      agent.prompt ? { role: 'system', content: String(agent.prompt) } : null,
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
