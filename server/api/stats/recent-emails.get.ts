import { mailStorage } from '../../features/mail/storage'

export default defineEventHandler(async (_event) => {
  const query = getQuery(_event)
  const limit = Number.parseInt((query.limit as string) || '5')
  // Get date range from query parameters
  const rangeStart = query.rangeStart ? new Date(query.rangeStart as string) : undefined
  const rangeEnd = query.rangeEnd ? new Date(query.rangeEnd as string) : undefined
  const direction = String(query.direction || 'both') as 'received' | 'sent' | 'both'

  try {
    // Get recent emails (both inbound and outbound) from unified storage
    let recentEmails = await mailStorage.getRecentEmails(limit * 2)

    // Filter by date range if provided
    if (rangeStart && rangeEnd) {
      const startDate = new Date(rangeStart)
      startDate.setHours(0, 0, 0, 0) // Start of day

      const endDate = new Date(rangeEnd)
      endDate.setHours(23, 59, 59, 999) // End of day

      recentEmails = recentEmails.filter((log) => {
        const logDate = new Date(log.timestamp)
        return logDate >= startDate && logDate <= endDate
      })
    }

    // Apply limit if no date range
    const shouldLimit = !(rangeStart && rangeEnd)
    if (shouldLimit) {
      recentEmails = recentEmails.slice(0, limit)
    }

    // De-duplicate by messageId+direction (first occurrence wins) to avoid double entries
    const seen = new Set<string>()
    let processedEmails = recentEmails
      .map((log) => {
        // Determine direction
        const direction = log.type === 'outgoing' ? 'outbound' : 'inbound'

        // Determine status based on log data
        let status = direction === 'inbound' ? 'received' : 'sent'
        if (log.domainFiltered) {
          status = 'blocked'
        } else if (log.usedOpenAI && log.mailgunSent) {
          status = 'responded'
        } else if (log.usedOpenAI && direction === 'outbound' && !log.mailgunSent) {
          status = 'failed'
        } else if (!log.agentId && direction === 'inbound') {
          status = 'no-agent'
        }

        const item = {
          id: log.messageId || log.storageKey || `email-${log.timestamp}`,
          date: log.timestamp,
          status,
          direction,
          from: log.from || 'unknown@example.com',
          to: log.to || '',
          subject: log.subject || 'No Subject'
        }
        const key = `${direction}:${log.messageId || log.storageKey || item.id}`
        if (seen.has(key)) return null
        seen.add(key)
        return item
      })
      .filter(
        (
          v
        ): v is {
          id: string
          date: string
          status: string
          direction: string
          from: string
          to: string
          subject: string
        } => Boolean(v)
      )

    // Apply direction filter if requested
    if (direction !== 'both') {
      processedEmails = processedEmails.filter((e) =>
        direction === 'received' ? e.direction === 'inbound' : e.direction === 'outbound'
      )
    }

    return processedEmails
  } catch (error) {
    console.error('Error fetching recent emails:', error)
    return []
  }
})
