/**
 * POST /api/agent-flows/{id}/fail
 * Fail a flow
 */

import { agentFlowEngine } from '../../../utils/agentFlowEngine'

export default defineEventHandler(async event => {
  const flowId = getRouterParam(event, 'id')
  const body = await readBody<{
    reason?: string;
    agentId?: string
  }>(event)

  if (!flowId) {
    throw createError({ statusCode: 400, statusMessage: 'flowId is required' })
  }

  if (!body.reason) {
    throw createError({ statusCode: 400, statusMessage: 'reason is required' })
  }

  if (!body.agentId) {
    throw createError({ statusCode: 400, statusMessage: 'agentId is required' })
  }

  await agentFlowEngine.failFlow(flowId, body.reason, body.agentId)

  return { ok: true }
})
