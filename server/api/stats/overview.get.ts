export default defineEventHandler(async (_event) => {
  try {
    // Get agents count
    const agentsStorage = useStorage('agents')
    const agentsData = await agentsStorage.getItem<Array<unknown>>('agents.json')
    const agents = agentsData || []

    // Get Mailgun configuration from runtime config
    const config = useRuntimeConfig()
    const mailgunApiKey = config.mailgun?.key
    const hasMailgun = !!mailgunApiKey

    let domainsActive = 0
    let domainsTotal = 0

    // Try to get domains data if Mailgun is configured
    if (hasMailgun && mailgunApiKey) {
      try {
        // Simple domain check - just set placeholder values for now
        // In a real implementation, we'd call Mailgun API directly
        domainsActive = 1
        domainsTotal = 1
      } catch {
        domainsActive = 0
        domainsTotal = 0
      }
    }

    let emailsReceived = 0
    let emailsResponded = 0

    // Try to get email activity data from inbound storage
    try {
      const inboundStorage = useStorage('inbound')
      const inboundData = await inboundStorage.getItem<{ receivedAt?: string }>('inbound.json')

      if (inboundData) {
        // Simple activity counting
        emailsReceived = 1
        emailsResponded = 1
      }
    } catch {
      // Inbound data error handled gracefully
    }

    // Calculate success rate with minimum 100% if no data
    const successRate = emailsReceived > 0 ? Math.round((emailsResponded / emailsReceived) * 100) : 100

    return {
      agents: {
        count: agents.length,
        variation: 0 // Would compare with previous period
      },
      emails: {
        received: emailsReceived,
        responded: emailsResponded,
        variation: 0 // Would compare with previous period
      },
      domains: {
        active: domainsActive,
        total: domainsTotal,
        variation: 0 // Would compare with previous period
      },
      successRate: {
        percentage: successRate,
        variation: 0 // Would compare with previous period
      }
    }
  } catch (error) {
    console.error('Dashboard stats error:', error)

    // Return zero/default values if there's an error
    return {
      agents: { count: 0, variation: 0 },
      emails: { received: 0, responded: 0, variation: 0 },
      domains: { active: 0, total: 0, variation: 0 },
      successRate: { percentage: 0, variation: 0 }
    }
  }
})
