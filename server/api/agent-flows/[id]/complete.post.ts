/**
 * POST /api/agent-flows/{id}/complete
 * Complete a flow
 */

import { agentFlowEngine } from '../../../utils/agentFlowEngine'

export default defineEventHandler(async event => {
  const flowId = getRouterParam(event, 'id')
  const body = await readBody<{
    finalResponse?: string;
    agentId?: string
  }>(event)

  if (!flowId) {
    throw createError({ statusCode: 400, statusMessage: 'flowId is required' })
  }

  if (!body.finalResponse) {
    throw createError({ statusCode: 400, statusMessage: 'finalResponse is required' })
  }

  if (!body.agentId) {
    throw createError({ statusCode: 400, statusMessage: 'agentId is required' })
  }

  await agentFlowEngine.completeFlow(flowId, body.finalResponse, body.agentId)

  return { ok: true }
})
