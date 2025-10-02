import { generateAgentResponse } from '../../../utils/agentResponder'

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing id' })
    }

    // Get session for team/user context (for MCP servers like Kanban)
    let teamId: string | undefined
    let userId: string | undefined
    try {
      const body = await readBody(event)
      const session = await getUserSession(event)
      teamId = body.teamId || session.team?.id
      userId = body.userId || session.user?.id
      console.log('[AgentAPI] Session found:', { teamId, userId })
    } catch (error) {
      console.log('[AgentAPI] No session available (likely inbound email):', error)
      // Session not available (e.g., when called from inbound handler)
    }

    const body = await readBody<{
      subject?: string
      text?: string
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

    // Prefer explicit IDs from body (e.g., TestAgentModal), fallback to session-derived IDs
    const effectiveTeamId = String(body?.teamId || teamId || '').trim() || undefined
    const effectiveUserId = String(body?.userId || userId || '').trim() || undefined

    return await generateAgentResponse({
      agentId: id,
      subject,
      text,
      from,
      includeQuote,
      maxTokens,
      temperature,
      teamId: effectiveTeamId,
      userId: effectiveUserId,
      mcpContexts
    })
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})
