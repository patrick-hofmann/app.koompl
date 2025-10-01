import { mailStorage } from '../../utils/mailStorage'

export default defineEventHandler(async _event => {
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

    // Use unified mail storage with dedupe to compute counts (same as chart/list)
    let emailsReceived = 0
    let emailsResponded = 0
    try {
      const logs = await mailStorage.getRecentEmails(1000)
      const seen = new Set<string>()
      const filtered = logs
        .map(log => {
          const direction = log.type === 'outgoing' ? 'outbound' : 'inbound'
          const key = `${direction}:${log.messageId || log.storageKey || log.timestamp}`
          if (seen.has(key)) return null
          seen.add(key)
          return { ...log, direction }
        })
        .filter((v): v is (typeof logs)[number] & { direction: 'inbound' | 'outbound' } => Boolean(v))

      emailsReceived = filtered.filter(e => e.direction === 'inbound').length
      emailsResponded = filtered.filter(e => e.direction === 'outbound' && e.mailgunSent).length
    } catch {
      // ignore errors and leave counts at zero
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
