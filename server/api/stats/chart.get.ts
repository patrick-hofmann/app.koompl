export default defineEventHandler(async (_event) => {
  const query = getQuery(_event)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const period = (query.period as string) || 'daily'
  // Begin/end calculations for requested range
  const rangeStart = query.rangeStart ? new Date(query.rangeStart as string) : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const rangeEnd = query.rangeEnd ? new Date(query.rangeEnd as string) : new Date()

  try {
    // Get real email data from the agent email log (same source as recent emails)
    let totalEmailsReceived = 0
    let totalEmailsResponded = 0

    try {
      const agentsStorage = useStorage('agents')
      const emailLog = await agentsStorage.getItem<Array<{
        timestamp: string
        type: string
        usedOpenAI: boolean
        mailgunSent: boolean
        domainFiltered: boolean
        from?: string
        to?: string
      }>>('email:log.json')

      if (Array.isArray(emailLog)) {
        // Filter for emails within the date range with inclusive boundaries
        const startDate = new Date(rangeStart)
        startDate.setHours(0, 0, 0, 0) // Start of day

        const endDate = new Date(rangeEnd)
        endDate.setHours(23, 59, 59, 999) // End of day

        const filteredEmails = emailLog.filter((log) => {
          if (log.type !== 'inbound_processed') return false

          const logDate = new Date(log.timestamp)
          return logDate >= startDate && logDate <= endDate
        })

        totalEmailsReceived = filteredEmails.length

        // Count all emails as "received" (including blocked, failed, no-agent),
        // only count successful AI responses as "responded"
        totalEmailsResponded = filteredEmails.filter(
          email => email.usedOpenAI && email.mailgunSent && !email.domainFiltered
        ).length

        // Return the actual emails filtered for date range
        return {
          emails: {
            received: filteredEmails.length,
            responded: totalEmailsResponded
          },
          emailData: filteredEmails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
          timestamp: Date.now()
        }
      }

      // Fallback: try old inbound storage method if no agent log
      if (totalEmailsReceived === 0) {
        const inboundStorage = useStorage('inbound')
        const inboundData = await inboundStorage.getItem<Record<string, unknown>>('inbound.json')
        const recentActivity = await inboundStorage.getItem<Array<Record<string, unknown>>>('recent.json')

        if (Array.isArray(recentActivity)) {
          totalEmailsReceived = recentActivity.length
          totalEmailsResponded = recentActivity.filter(
            (item: Record<string, unknown>) =>
              item.success !== false
              && (item.answerId || item.outboundId)
          ).length
        } else if (inboundData) {
          totalEmailsReceived = 1
          if (inboundData.success !== false || inboundData.answerId || inboundData.outboundId) {
            totalEmailsResponded = 1
          }
        }
      }
    } catch {
      // If all storage methods fail, use zero values
    }

    // Return exact email counts without any multiplication or fudging
    return {
      emails: {
        received: totalEmailsReceived,
        responded: totalEmailsResponded
      },
      emailData: [], // No email data available
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
