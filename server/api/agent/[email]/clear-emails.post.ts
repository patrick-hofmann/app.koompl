import { clearAgentEmails } from '../../../features/mail'
import { getAgentByEmail } from '../../../features/agent'

export default defineEventHandler(async (event) => {
  const email = getRouterParam(event, 'email') as string
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Agent email is required' })
  }

  const agent = await getAgentByEmail(email)
  if (!agent) {
    throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
  }

  const result = await clearAgentEmails({ agentId: agent.id })
  return {
    ok: true,
    message: `Cleared ${result.deletedCount} emails for agent ${email}`,
    deletedCount: result.deletedCount
  }
})
