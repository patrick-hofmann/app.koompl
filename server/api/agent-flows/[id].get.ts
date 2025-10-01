/**
 * GET /api/agent-flows/{id}?agentId=x
 * Get flow details
 */

import { agentFlowEngine } from '../../utils/agentFlowEngine'

export default defineEventHandler(async event => {
  const flowId = getRouterParam(event, 'id')
  const query = getQuery(event)

  if (!flowId) {
    throw createError({ statusCode: 400, statusMessage: 'flowId is required' })
  }

  const agentId = String(query.agentId || '')

  if (!agentId) {
    throw createError({ statusCode: 400, statusMessage: 'agentId is required' })
  }

  const flow = await agentFlowEngine.getFlow(flowId, agentId)

  if (!flow) {
    throw createError({ statusCode: 404, statusMessage: 'Flow not found' })
  }

  return { ok: true, flow }
})
