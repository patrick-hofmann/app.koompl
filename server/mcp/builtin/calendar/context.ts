import type { McpContextResult } from '../../../types/mcp-clients'
import type { CalendarEvent } from '../../../types/calendar'
import { getCalendarEventsByDateRange } from '../../../utils/calendarStorage'

export interface CalendarMcpContext {
  teamId: string
  userId: string
  agentId?: string
}

export async function fetchCalendarContext(
  context: CalendarMcpContext,
  limit: number = 10
): Promise<McpContextResult | null> {
  const now = new Date()
  const futureDate = new Date()
  futureDate.setDate(now.getDate() + 30)

  const events = await getCalendarEventsByDateRange(
    context.teamId,
    now.toISOString(),
    futureDate.toISOString()
  )

  if (!events.length) {
    return {
      serverId: 'builtin-calendar',
      serverName: 'Team Calendar',
      provider: 'builtin',
      category: 'calendar',
      summary: 'No upcoming calendar events found for this team.',
      details: []
    }
  }

  const sortedEvents = events
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, limit)

  const eventSummaries = sortedEvents.map((event) => {
    const startDate = new Date(event.startDate).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    return `• ${event.title} - ${startDate}`
  })

  return {
    serverId: 'builtin-calendar',
    serverName: 'Team Calendar',
    provider: 'builtin',
    category: 'calendar',
    summary: `Upcoming Events (next 30 days):\n${eventSummaries.join('\n')}`,
    details: sortedEvents as CalendarEvent[]
  }
}
