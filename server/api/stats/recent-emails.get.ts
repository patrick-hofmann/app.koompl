export default defineEventHandler(async (_event) => {
  const query = getQuery(_event)
  const limit = Number.parseInt((query.limit as string) || '5')
  // Get date range from query parameters
  const rangeStart = query.rangeStart ? new Date(query.rangeStart as string) : undefined
  const rangeEnd = query.rangeEnd ? new Date(query.rangeEnd as string) : undefined

  try {
    const agentsStorage = useStorage('agents')

    // Get the email activity log from agent storage
    const emailLog = await agentsStorage.getItem<Array<{
      timestamp: string
      type: string
      messageId?: string
      to: string
      from: string
      subject: string
      agentId?: string
      usedOpenAI: boolean
      mailgunSent: boolean
      domainFiltered: boolean
      storageInboundKey?: string
    }>>('email:log.json')

    if (!Array.isArray(emailLog) || emailLog.length === 0) {
      return []
    }

    // Filter emails by date range if provided
    let filteredEmails = emailLog.filter(log => log.type === 'inbound_processed')

    if (rangeStart && rangeEnd) {
      const startDate = new Date(rangeStart)
      startDate.setHours(0, 0, 0, 0) // Start of day

      const endDate = new Date(rangeEnd)
      endDate.setHours(23, 59, 59, 999) // End of day

      filteredEmails = filteredEmails.filter((log) => {
        const logDate = new Date(log.timestamp)
        return logDate >= startDate && logDate <= endDate
      })
    }

    // Sort by timestamp (newest first)
    // If date range is provided, show all emails in that range (no limit)
    // Otherwise, respect the default limit for general queries
    const shouldLimit = !(rangeStart && rangeEnd)
    const emailsToProcess = shouldLimit
      ? filteredEmails
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, limit)
      : filteredEmails
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const recentEmails = emailsToProcess.map((log) => {
      // Determine the status based on the log data
      let status = 'received'
      if (log.domainFiltered) {
        status = 'blocked'
      } else if (log.usedOpenAI && log.mailgunSent) {
        status = 'responded'
      } else if (log.usedOpenAI && !log.mailgunSent) {
        status = 'failed'
      } else if (!log.usedOpenAI || !log.agentId) {
        status = 'no-agent'
      }

      return {
        id: log.messageId || log.storageInboundKey || `email-${log.timestamp}`,
        date: log.timestamp,
        status,
        email: log.from || 'unknown@example.com',
        agent: log.agentId || 'No Agent',
        subject: log.subject || 'No Subject'
      }
    })

    return recentEmails
  } catch (error) {
    console.error('Error fetching recent emails:', error)
    return []
  }
})
