/**
 * POST /api/agent-flows/{id}/resume
 * Resume a flow
 */

import { agentFlowEngine } from '../../../utils/agentFlowEngine'
import type { ResumeInput } from '../../../types/agent-flows'

export default defineEventHandler(async event => {
  const flowId = getRouterParam(event, 'id')
  const body = await readBody<{
    input?: ResumeInput;
    agentId?: string
  }>(event)

  if (!flowId) {
    throw createError({ statusCode: 400, statusMessage: 'flowId is required' })
  }

  if (!body.input) {
    throw createError({ statusCode: 400, statusMessage: 'input is required' })
  }

  if (!body.agentId) {
    throw createError({ statusCode: 400, statusMessage: 'agentId is required' })
  }

  await agentFlowEngine.resumeFlow(flowId, body.input, body.agentId)

  return { ok: true }
})
