/**
 * GET /api/agent-flows?agentId=x&status=active
 * List flows for an agent
 */

import { agentFlowEngine } from '../../utils/agentFlowEngine'
import type { FlowStatus } from '../../types/agent-flows'

export default defineEventHandler(async event => {
  const query = getQuery(event)

  const agentId = String(query.agentId || '')

  if (!agentId) {
    throw createError({ statusCode: 400, statusMessage: 'agentId is required' })
  }

  const statusParam = query.status
  let status: FlowStatus[] | undefined

  if (statusParam) {
    if (typeof statusParam === 'string') {
      status = [statusParam as FlowStatus]
    } else if (Array.isArray(statusParam)) {
      status = statusParam as FlowStatus[]
    }
  }

  const limit = query.limit ? Number(query.limit) : undefined

  const flows = await agentFlowEngine.listAgentFlows(agentId, {
    status,
    limit
  })

  return { ok: true, flows }
})
