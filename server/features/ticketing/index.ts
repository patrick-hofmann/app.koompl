// Public API for Ticketing feature
export * from './storage'

export interface TicketingApi {
  // Ticket management
  createTicket: typeof import('./storage').createTicket
  updateTicket: typeof import('./storage').updateTicket
  getTicket: typeof import('./storage').getTicket
  listTickets: typeof import('./storage').listTickets

  // Comment management
  addTicketComment: typeof import('./storage').addTicketComment
  getTicketComments: typeof import('./storage').getTicketComments

  // Analytics
  getTicketStats: typeof import('./storage').getTicketStats
}

// Re-export all storage functions for easy access
export {
  createTicket,
  updateTicket,
  getTicket,
  listTickets,
  addTicketComment,
  getTicketComments,
  getTicketStats
} from './storage'
