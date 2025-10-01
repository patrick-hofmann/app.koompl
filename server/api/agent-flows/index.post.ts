/**
 * POST /api/agent-flows
 * Start a new agent flow
 */

import { agentFlowEngine } from '../../utils/agentFlowEngine'
import type { EmailTrigger } from '../../types/agent-flows'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    agentId?: string
    trigger?: EmailTrigger
    maxRounds?: number
    timeoutMinutes?: number
  }>(event)
  
  if (!body.agentId) {
    throw createError({ statusCode: 400, statusMessage: 'agentId is required' })
  }
  
  if (!body.trigger) {
    throw createError({ statusCode: 400, statusMessage: 'trigger is required' })
  }
  
  const flow = await agentFlowEngine.startFlow({
    agentId: body.agentId,
    trigger: body.trigger,
    maxRounds: body.maxRounds,
    timeoutMinutes: body.timeoutMinutes
  })
  
  return { ok: true, flowId: flow.id, flow }
})

