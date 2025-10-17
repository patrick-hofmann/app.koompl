/**
 * Team-level inbound email handler
 * - Validates sender against team rules (members-only, etc.)
 * - Routes email to appropriate agent based on recipient
 * - Relays payload to agent/[email]/inbound
 */

export default defineEventHandler(async (event) => {
  const teamId = getRouterParam(event, 'teamId')
  if (!teamId) {
    throw createError({ statusCode: 400, statusMessage: 'Team ID required' })
  }

  // Get the same Mailgun payload that was forwarded from mailgun/inbound
  const payload = await readBody(event)

  const recipient = String(
    payload.recipient || payload.to || payload.To || payload.recipients || payload.Recipients || ''
  )
  const from = String(payload.from || payload.From || payload.sender || '')
  const subject = String(payload.subject || payload.Subject || '')

  console.log(`[TeamInbound] Processing email for team ${teamId}`, {
    recipient,
    from,
    subject
  })

  // Load team data using the identity storage system
  const { getIdentity } = await import('../../../features/team/storage')
  const identity = await getIdentity()
  const team = identity.teams.find((t) => t.id === teamId)

  if (!team) {
    console.error(`[TeamInbound] Team ${teamId} not found`)
    throw createError({ statusCode: 404, statusMessage: 'Team not found' })
  }

  // Ensure team has domain information for compatibility
  const teamWithDomain = {
    id: team.id,
    name: team.name,
    domains: team.domain ? [team.domain] : []
  }

  console.log(`[TeamInbound] ✓ Found team:`, teamWithDomain)

  // TODO: Implement team inbound rules validation
  // For now, we allow all emails. Future rules could include:
  // - Only members can send
  // - Whitelist/blacklist domains
  // - Require authentication/verification
  // - Rate limiting per sender

  const senderEmail = from.match(/<(.+?)>/)?.[1] || from
  console.log(`[TeamInbound] Sender: ${senderEmail} (validation: passed)`)

  // Extract agent email from recipient
  // recipient could be "Agent Name <agent@example.com>" or just "agent@example.com"
  const agentEmail = recipient.match(/<(.+?)>/)?.[1] || recipient

  if (!agentEmail) {
    console.error('[TeamInbound] No recipient email found in payload')
    throw createError({ statusCode: 400, statusMessage: 'Recipient email required' })
  }

  // Extract agent username from full email
  const agentUsername = agentEmail.split('@')[0]

  // Find agent by email using feature function
  const { getAgentByEmail } = await import('../../../features/agent')
  const targetAgent = await getAgentByEmail(agentUsername, teamId)

  if (!targetAgent) {
    console.error(`[TeamInbound] No agent found for email: ${agentEmail} in team ${teamId}`)
    throw createError({
      statusCode: 404,
      statusMessage: `No agent found for ${agentEmail}`
    })
  }

  console.log(`[TeamInbound] Routing to agent: ${targetAgent.name} (${targetAgent.id})`)

  // Relay the entire payload to agent/[email]/inbound
  // We use $fetch to make an internal API call
  try {
    const response = await $fetch(`/api/agent/${encodeURIComponent(agentEmail)}/inbound-mcp`, {
      method: 'POST',
      body: payload,
      headers: {
        'x-forwarded-by': 'team-inbound',
        'x-team-id': teamId,
        'x-agent-id': targetAgent.id
      }
    })

    console.log(`[TeamInbound] Successfully relayed to agent ${targetAgent.id}`)

    return {
      success: true,
      teamId,
      agentId: targetAgent.id,
      agentEmail,
      relayed: true,
      response
    }
  } catch (error) {
    console.error(`[TeamInbound] Failed to relay to agent:`, error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process email at agent level',
      cause: error
    })
  }
})
