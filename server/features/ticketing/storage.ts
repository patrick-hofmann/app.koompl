import { createStorage } from '../../utils/storage'

export interface Ticket {
  id: string
  ticketNumber: string
  title: string
  description: string
  status: 'open' | 'in-progress' | 'pending-customer' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  category: string
  customerEmail: string
  customerName?: string
  assignedTo?: string
  assignedAgent?: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  closedAt?: string
  teamId: string
}

export interface TicketComment {
  id: string
  ticketId: string
  content: string
  author: string
  authorType: 'agent' | 'customer' | 'system'
  createdAt: string
  isInternal: boolean
  teamId: string
}

export interface TicketingData {
  tickets: Ticket[]
  comments: TicketComment[]
}

const defaultTicketingData: TicketingData = {
  tickets: [],
  comments: []
}

export function createTicketingStorage(teamId: string) {
  return createStorage<TicketingData>('ticketing', teamId, defaultTicketingData)
}

export async function createTicket(
  teamId: string,
  ticketData: Omit<Ticket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<Ticket> {
  const storage = createTicketingStorage(teamId)
  const data = await storage.read()

  // Generate ticket number
  const ticketCount = data.tickets.length
  const ticketNumber = `TICKET-${String(ticketCount + 1).padStart(6, '0')}`

  const ticket: Ticket = {
    id: `ticket_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ticketNumber,
    ...ticketData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.tickets.push(ticket)
  await storage.write(data)

  return ticket
}

export async function updateTicket(
  teamId: string,
  ticketId: string,
  updates: Partial<Omit<Ticket, 'id' | 'ticketNumber' | 'createdAt' | 'teamId'>>
): Promise<Ticket | null> {
  const storage = createTicketingStorage(teamId)
  const data = await storage.read()

  const ticketIndex = data.tickets.findIndex((t) => t.id === ticketId)
  if (ticketIndex === -1) return null

  const updatedTicket = {
    ...data.tickets[ticketIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  // Set resolved/closed timestamps when status changes
  if (updates.status === 'resolved' && !updatedTicket.resolvedAt) {
    updatedTicket.resolvedAt = new Date().toISOString()
  }
  if (updates.status === 'closed' && !updatedTicket.closedAt) {
    updatedTicket.closedAt = new Date().toISOString()
  }

  data.tickets[ticketIndex] = updatedTicket
  await storage.write(data)

  return updatedTicket
}

export async function getTicket(teamId: string, ticketId: string): Promise<Ticket | null> {
  const storage = createTicketingStorage(teamId)
  const data = await storage.read()
  return data.tickets.find((t) => t.id === ticketId) || null
}

export async function listTickets(
  teamId: string,
  status?: Ticket['status'],
  priority?: Ticket['priority'],
  assignedTo?: string
): Promise<Ticket[]> {
  const storage = createTicketingStorage(teamId)
  const data = await storage.read()

  let tickets = data.tickets

  if (status) {
    tickets = tickets.filter((t) => t.status === status)
  }

  if (priority) {
    tickets = tickets.filter((t) => t.priority === priority)
  }

  if (assignedTo) {
    tickets = tickets.filter((t) => t.assignedTo === assignedTo)
  }

  return tickets
}

export async function addTicketComment(
  teamId: string,
  commentData: Omit<TicketComment, 'id' | 'createdAt' | 'teamId'>
): Promise<TicketComment> {
  const storage = createTicketingStorage(teamId)
  const data = await storage.read()

  const comment: TicketComment = {
    id: `comment_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...commentData,
    createdAt: new Date().toISOString(),
    teamId
  }

  data.comments.push(comment)
  await storage.write(data)

  return comment
}

export async function getTicketComments(
  teamId: string,
  ticketId: string
): Promise<TicketComment[]> {
  const storage = createTicketingStorage(teamId)
  const data = await storage.read()
  return data.comments
    .filter((c) => c.ticketId === ticketId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export async function getTicketStats(teamId: string): Promise<{
  total: number
  open: number
  inProgress: number
  pendingCustomer: number
  resolved: number
  closed: number
  avgResolutionTime?: number
}> {
  const storage = createTicketingStorage(teamId)
  const data = await storage.read()

  const stats = {
    total: data.tickets.length,
    open: 0,
    inProgress: 0,
    pendingCustomer: 0,
    resolved: 0,
    closed: 0
  }

  let totalResolutionTime = 0
  let resolvedCount = 0

  data.tickets.forEach((ticket) => {
    stats[ticket.status]++

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      if (ticket.resolvedAt) {
        const createdAt = new Date(ticket.createdAt)
        const resolvedAt = new Date(ticket.resolvedAt)
        totalResolutionTime += resolvedAt.getTime() - createdAt.getTime()
        resolvedCount++
      }
    }
  })

  return {
    ...stats,
    avgResolutionTime:
      resolvedCount > 0 ? totalResolutionTime / resolvedCount / (1000 * 60 * 60) : undefined // in hours
  }
}
