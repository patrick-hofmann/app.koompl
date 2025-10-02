// Multi-round flow support
import { mailStorage } from '../../utils/mailStorage'
import { agentLogger } from '../../utils/agentLogging'
import { agentFlowEngine } from '../../utils/agentFlowEngine'
import { MessageRouter } from '../../utils/messageRouter'
import type { Agent } from '~/types'

export default defineEventHandler(async (event) => {
  // Always return ok to Mailgun no matter what happens.
  try {
    const agentsStorage = useStorage('agents')

    let payload: Record<string, unknown> | null = null
    const contentType = getHeader(event, 'content-type') || ''

    if (contentType.includes('application/json')) {
      payload = await readBody(event)
    } else {
      // Parse form data for typical Mailgun POSTs
      const body = await readBody<Record<string, string>>(event)
      payload = body
    }

    // Basic shape we care about
    function getPath(source: unknown, path: Array<string>): unknown {
      let current: unknown = source
      for (const key of path) {
        if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[key]
        } else {
          return undefined
        }
      }
      return current
    }
    function firstString(...values: Array<unknown>): string | undefined {
      for (const v of values) {
        if (v === undefined || v === null) continue
        const s = String(v)
        if (s.length > 0) return s
      }
      return undefined
    }
    const _receivedAt = new Date().toISOString()
    const messageId = String(
      firstString(
        payload ? (payload as Record<string, unknown>)['Message-Id'] : undefined,
        payload ? (payload as Record<string, unknown>)['message-id'] : undefined,
        getPath(payload, ['message', 'headers', 'message-id']),
        (
          globalThis as unknown as { crypto?: { randomUUID?: () => string } }
        ).crypto?.randomUUID?.(),
        Math.random().toString(36).slice(2)
      )
    )
    const from = firstString(
      payload ? (payload as Record<string, unknown>)['from'] : undefined,
      payload ? (payload as Record<string, unknown>)['sender'] : undefined,
      payload ? (payload as Record<string, unknown>)['From'] : undefined,
      getPath(payload, ['headers', 'from'])
    )
    const to = firstString(
      payload ? (payload as Record<string, unknown>)['recipient'] : undefined,
      payload ? (payload as Record<string, unknown>)['to'] : undefined,
      payload ? (payload as Record<string, unknown>)['To'] : undefined,
      getPath(payload, ['headers', 'to'])
    )
    const subject = firstString(
      payload ? (payload as Record<string, unknown>)['subject'] : undefined,
      payload ? (payload as Record<string, unknown>)['Subject'] : undefined,
      getPath(payload, ['headers', 'subject'])
    )
    const text = firstString(
      payload ? (payload as Record<string, unknown>)['stripped-text'] : undefined,
      payload ? (payload as Record<string, unknown>)['text'] : undefined,
      payload ? (payload as Record<string, unknown>)['body-plain'] : undefined,
      payload ? (payload as Record<string, unknown>)['body'] : undefined
    )
    const html = firstString(
      payload ? (payload as Record<string, unknown>)['stripped-html'] : undefined,
      payload ? (payload as Record<string, unknown>)['html'] : undefined,
      payload ? (payload as Record<string, unknown>)['body-html'] : undefined
    )

    // Store in unified mail storage system
    const _inboundEmail = await mailStorage.storeInboundEmail({
      messageId: String(messageId || ''),
      from: String(from || ''),
      to: String(to || ''),
      subject: String(subject || ''),
      body: String(text || ''),
      html: String(html || ''),
      agentId: undefined, // Will be set below after agent resolution
      agentEmail: undefined,
      mcpContexts: [],
      rawPayload: payload
    })

    // Use shared helper to extract bare email address from header-like strings
    const { extractEmail } = await import('../../utils/mailgunHelpers')
    const toEmail = extractEmail(to)
    const fromEmail = extractEmail(from)

    // Load agents and try to resolve the agent by recipient address
    const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
    const agent = toEmail
      ? agents.find((a) => String(a?.email || '').toLowerCase() === toEmail)
      : undefined

    if (!agent) {
      console.log('[Inbound] No agent found for email:', toEmail)
      return { ok: true, error: 'Agent not found' }
    }

    // Log inbound email activity EARLY (before any outbound processing)
    try {
      await agentLogger.logEmailActivity({
        agentId: agent.id,
        agentEmail: agent.email,
        direction: 'inbound',
        email: {
          messageId: String(messageId || ''),
          from: String(from || ''),
          to: String(to || ''),
          subject: String(subject || ''),
          body: String(text || '')
        },
        metadata: {
          mailgunSent: false,
          isAutomatic: false,
          mcpContextCount: 0
        }
      })
    } catch (logErr) {
      console.error('Failed to log inbound email activity:', logErr)
    }

    // Check if this is a response to THIS AGENT's existing flow
    console.log('\n[Inbound] ════════════════════════════════════════════')
    console.log('[Inbound] 📨 PROCESSING INBOUND EMAIL')
    console.log(`[Inbound] Agent: ${agent.name} (${agent.email})`)
    console.log(`[Inbound] From: ${fromEmail || from}`)
    console.log(`[Inbound] Subject: ${subject}`)
    console.log(`[Inbound] Multi-round enabled: ${agent.multiRoundConfig?.enabled ? 'YES' : 'NO'}`)
    console.log('[Inbound] ════════════════════════════════════════════')

    const messageRouter = new MessageRouter()
    const routingResult = await messageRouter.routeInboundEmail(
      {
        messageId: String(messageId || ''),
        from: String(fromEmail || from || ''),
        to: String(toEmail || to || ''),
        subject: String(subject || ''),
        body: String(text || ''),
        receivedAt: new Date().toISOString()
      },
      agent.id
    )

    console.log(
      `[Inbound] Routing result: isFlowResponse=${routingResult.isFlowResponse}, flowId=${routingResult.flow?.id}`
    )

    if (routingResult.isFlowResponse && routingResult.flow) {
      // This is a response to one of this agent's flows - resume it
      console.log(`[Inbound] ✓ This is a RESPONSE to existing flow ${routingResult.flow.id}`)
      console.log('[Inbound] → Resuming flow...')

      await agentFlowEngine.resumeFlow(
        routingResult.flow.id,
        {
          type: 'email_response',
          email: {
            messageId: String(messageId || ''),
            from: String(fromEmail || from || ''),
            subject: String(subject || ''),
            body: String(text || '')
          }
        },
        agent.id
      )
      console.log('[Inbound] ✓ Flow resumed successfully')
      return { ok: true, flowId: routingResult.flow.id, resumed: true }
    }

    // This is a NEW request for this agent
    console.log(`[Inbound] ✓ This is a NEW REQUEST for agent ${agent.name}`)

    // Look up user by email to get userId for MCP context (calendar, kanban, etc.)
    let userId: string | undefined
    if (fromEmail) {
      try {
        const { getIdentity } = await import('../../utils/identityStorage')
        const identity = await getIdentity()
        const user = identity.users.find(
          (u) => u.email.toLowerCase().trim() === fromEmail.toLowerCase().trim()
        )
        if (user) {
          userId = user.id
          console.log(`[Inbound] Found user ID for ${fromEmail}: ${userId}`)
        } else {
          console.log(`[Inbound] No user found for email: ${fromEmail}`)

          // Check if sender is an agent (agent-to-agent delegation)
          const senderAgent = agents.find(
            (a) => String(a?.email || '').toLowerCase() === fromEmail.toLowerCase()
          )
          if (senderAgent) {
            console.log(`[Inbound] Sender is an agent: ${senderAgent.name} (${senderAgent.email})`)
            console.log('[Inbound] → Looking for delegating flow to extract user context...')

            // Find the sender agent's active flows to extract original user context
            const senderFlows = await agentFlowEngine.listAgentFlows(senderAgent.id, {
              status: ['waiting', 'active']
            })

            // Look for a flow that has this request ID in its wait state
            const requestId = messageRouter.extractRequestId(subject || '')
            if (requestId) {
              console.log(`[Inbound] Extracted request ID: ${requestId}`)
              const delegatingFlow = senderFlows.find(
                (f) =>
                  f.waitingFor?.type === 'agent_response' && f.waitingFor?.requestId === requestId
              )

              if (delegatingFlow && delegatingFlow.userId) {
                userId = delegatingFlow.userId
                console.log(
                  `[Inbound] ✓ Found user context from delegating flow ${delegatingFlow.id}`
                )
                console.log(`[Inbound] ✓ Using userId: ${userId}`)
              } else if (delegatingFlow) {
                console.log(
                  `[Inbound] ⚠ Delegating flow found but has no userId: ${delegatingFlow.id}`
                )
              } else {
                console.log('[Inbound] ⚠ No delegating flow found for request ID')
              }
            }
          }
        }
      } catch (err) {
        console.error('[Inbound] Error looking up user:', err)
      }
    }

    // ALL agents now use multi-round flow processing (single-round is just maxRounds=1)
    const maxRounds = agent.multiRoundConfig?.maxRounds || 1
    const timeoutMinutes = agent.multiRoundConfig?.timeoutMinutes || 30

    console.log('[Inbound] → Starting flow...')
    console.log(`[Inbound]   Max rounds: ${maxRounds}`)
    console.log(`[Inbound]   Timeout: ${timeoutMinutes} minutes`)
    console.log(`[Inbound]   Context: teamId=${agent.teamId || 'none'}, userId=${userId || 'none'}`)

    const flow = await agentFlowEngine.startFlow({
      agentId: agent.id,
      trigger: {
        type: 'email',
        messageId: String(messageId || ''),
        from: String(fromEmail || from || ''),
        to: String(toEmail || to || ''),
        subject: String(subject || ''),
        body: String(text || ''),
        receivedAt: new Date().toISOString()
      },
      maxRounds,
      timeoutMinutes,
      teamId: agent.teamId,
      userId
    })

    console.log(`[Inbound] ✓ Flow created: ${flow.id}`)
    console.log('[Inbound] → Executing first round...')

    // Execute first round
    await agentFlowEngine.executeRound(flow.id, agent.id)

    console.log('[Inbound] ✓ First round executed')
    console.log('[Inbound] ════════════════════════════════════════════\n')

    return { ok: true, flowId: flow.id, newFlow: true }
  } catch {
    // Even on error, Mailgun should receive ok
    return { ok: true }
  }
})

// Helper function no longer used in unified multi-round flow
// Kept for potential future use
// function formatEmailAddress(name: string | undefined, email: string): string {
//   const safeEmail = email.trim()
//   const safeName = (name || 'Agent').replace(/["<>]/g, '').trim()
//   return safeName ? `${safeName} <${safeEmail}>` : safeEmail
// }
