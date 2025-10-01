import { mailStorage } from '../../utils/mailStorage'

export default defineEventHandler(async (_event) => {
  const query = getQuery(_event)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const period = (query.period as string) || 'daily'
  // Begin/end calculations for requested range
  const rangeStart = query.rangeStart ? new Date(query.rangeStart as string) : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const rangeEnd = query.rangeEnd ? new Date(query.rangeEnd as string) : new Date()
  const direction = String(query.direction || 'both') as 'received' | 'sent' | 'both'

  try {
    // Use unified mail storage, identical source to Recent Email Activity, with same dedupe
    const startDate = new Date(rangeStart)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(rangeEnd)
    endDate.setHours(23, 59, 59, 999)

    const logs = await mailStorage.getRecentEmails(1000) // large buffer, we'll filter by date
    const seen = new Set<string>()
    const filtered = logs
      .map((log) => {
        const direction = log.type === 'outgoing' ? 'outbound' : 'inbound'
        const logDate = new Date(log.timestamp)
        if (!(logDate >= startDate && logDate <= endDate)) return null
        const key = `${direction}:${log.messageId || log.storageKey || log.timestamp}`
        if (seen.has(key)) return null
        seen.add(key)
        return { ...log, direction }
      })
      .filter((v): v is (typeof logs)[number] & { direction: 'inbound' | 'outbound' } => Boolean(v))

    let received = filtered.filter(e => e.direction === 'inbound')
    let responded = filtered.filter(e => e.direction === 'outbound' && e.mailgunSent)

    if (direction === 'received') {
      responded = []
    } else if (direction === 'sent') {
      received = []
    }

    return {
      emails: {
        received: received.length,
        responded: responded.length
      },
      emailData: filtered
        .map(e => ({
          timestamp: e.timestamp,
          usedOpenAI: Boolean(e.usedOpenAI),
          mailgunSent: Boolean(e.mailgunSent),
          domainFiltered: Boolean(e.domainFiltered)
        }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      timestamp: Date.now()
    }
  } catch (exception) {
    // Gracefully return minimal value in case of errors
    console.log('Dashboard chart data failed:', exception)
    return {
      emails: {
        received: 0,
        responded: 0
      },
      emailData: [],
      timestamp: Date.now()
    }
  }
})
