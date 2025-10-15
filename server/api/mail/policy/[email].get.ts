import type { MailPolicyConfig } from '~/types'

export default defineEventHandler(async (event): Promise<MailPolicyConfig> => {
  const email = getRouterParam(event, 'email')
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Missing email parameter' })
  }

  const [username, domain] = String(email).toLowerCase().split('@')
  if (!username || !domain) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email format' })
  }

  // Resolve team by domain
  const { getIdentity } = await import('../../../features/team/storage')
  const identity = await getIdentity()
  const team = identity.teams.find((t) => t.domain?.toLowerCase() === domain)
  if (!team) {
    throw createError({ statusCode: 404, statusMessage: `No team found for domain: ${domain}` })
  }

  // Resolve agent by email username within team
  const { getAgentByEmail } = await import('../../../features/agent')
  const agent = await getAgentByEmail(username, team.id)
  if (!agent) {
    throw createError({ statusCode: 404, statusMessage: `No agent found with email: ${email}` })
  }

  // Fetch policy from mail feature
  const { getAgentMailPolicy } = await import('../../../features/mail/policy')
  const policy = await getAgentMailPolicy(agent)
  return policy
})
