export interface CalendarEvent {
  id: string
  teamId: string
  userId: string
  title: string
  description?: string
  startDate: string // ISO 8601 date-time
  endDate: string // ISO 8601 date-time
  allDay?: boolean
  location?: string
  attendees?: string[] // User IDs or email addresses
  color?: string
  tags?: string[]
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
    interval?: number
    endDate?: string
    count?: number
  }
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface TeamCalendar {
  teamId: string
  events: CalendarEvent[]
  createdAt: string
  updatedAt: string
}

export interface CalendarEventList {
  [eventId: string]: CalendarEvent
}
