import { generateAgentResponse } from '../../../utils/agentResponder'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing id' })
    }

    const body = await readBody<{
      subject?: string
      text?: string
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
    }>(event)

    const subject = String(body?.subject || '')
    const text = String(body?.text || '')
    const from = String(body?.from || '')
    const includeQuote = Boolean(body?.includeQuote ?? true)
    const maxTokens = Number(body?.maxTokens || 700)
    const temperature = Number(body?.temperature || 0.4)
    const mcpContexts = Array.isArray(body?.mcpContexts)
      ? body?.mcpContexts
          .map((entry) => ({
            serverId: String(entry?.serverId || '').trim(),
            serverName: String(entry?.serverName || '').trim(),
            provider: String(entry?.provider || '').trim(),
            category: String(entry?.category || '').trim(),
            summary: String(entry?.summary || '').trim()
          }))
          .filter((entry) => entry.summary.length > 0)
      : []

    return await generateAgentResponse({
      agentId: id,
      subject,
      text,
      from,
      includeQuote,
      maxTokens,
      temperature,
      mcpContexts
    })
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})
