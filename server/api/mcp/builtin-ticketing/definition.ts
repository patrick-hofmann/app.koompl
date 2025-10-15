import type { BuiltinMcpDefinition } from '../../shared'
import type { TicketingMcpContext } from './context'
import {
  createTicket,
  getTicket,
  updateTicket,
  listTickets,
  addTicketComment
} from '../../../features/ticketing'

export const ticketingDefinition: BuiltinMcpDefinition<TicketingMcpContext> = {
  id: 'builtin-ticketing',
  serverName: 'builtin-ticketing-server',
  logPrefix: '[BuiltinTicketingMCP]',
  context: {
    spec: {
      teamIdEnv: 'TICKETING_TEAM_ID',
      userIdEnv: 'TICKETING_USER_ID',
      agentIdEnv: 'TICKETING_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.TICKETING_TEAM_ID as string,
      userId: env.TICKETING_USER_ID as string,
      agentId: env.TICKETING_AGENT_ID || undefined
    })
  },
  tools: [
    {
      name: 'create_ticket',
      description: 'Create a new support ticket',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          category: { type: 'string' },
          customerEmail: { type: 'string' },
          customerName: { type: 'string' }
        },
        required: ['title', 'description', 'priority', 'category', 'customerEmail'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const ticket = await createTicket(context.teamId, args as any)
        return {
          success: true,
          data: ticket,
          summary: `Created ticket ${ticket.id}: ${ticket.title}`
        }
      }
    },
    {
      name: 'get_ticket',
      description: 'Get details of a specific support ticket by ID',
      inputSchema: {
        type: 'object',
        properties: {
          ticketId: { type: 'string' }
        },
        required: ['ticketId'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const ticket = await getTicket(context.teamId, (args as { ticketId: string }).ticketId)
        return {
          success: true,
          data: ticket,
          summary: ticket ? `Found ticket ${ticket.id}: ${ticket.title}` : 'Ticket not found'
        }
      }
    },
    {
      name: 'update_ticket',
      description: 'Update a support ticket',
      inputSchema: {
        type: 'object',
        properties: {
          ticketId: { type: 'string' },
          updates: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['open', 'in-progress', 'pending-customer', 'resolved', 'closed']
              },
              priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
              assignedTo: { type: 'string' },
              assignedAgent: { type: 'string' }
            },
            additionalProperties: false
          }
        },
        required: ['ticketId', 'updates'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const { ticketId, updates } = args as { ticketId: string; updates: any }
        const ticket = await updateTicket(context.teamId, ticketId, updates)
        return {
          success: true,
          data: ticket,
          summary: ticket ? `Updated ticket ${ticket.id}` : 'Ticket not found'
        }
      }
    },
    {
      name: 'assign_ticket',
      description: 'Assign a support ticket to an agent',
      inputSchema: {
        type: 'object',
        properties: {
          ticketId: { type: 'string' },
          assignedTo: { type: 'string', description: 'ID of the agent to assign the ticket to' },
          assignedAgent: { type: 'string', description: 'Name of the assigned agent' }
        },
        required: ['ticketId', 'assignedTo'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const { ticketId, assignedTo, assignedAgent } = args as {
          ticketId: string
          assignedTo: string
          assignedAgent?: string
        }
        const updates = { assignedTo, assignedAgent }
        const ticket = await updateTicket(context.teamId, ticketId, updates)
        return {
          success: true,
          data: ticket,
          summary: ticket
            ? `Assigned ticket ${ticket.id} to ${ticket.assignedTo}`
            : 'Ticket not found'
        }
      }
    },
    {
      name: 'add_ticket_comment',
      description: 'Add a comment to a support ticket',
      inputSchema: {
        type: 'object',
        properties: {
          ticketId: { type: 'string' },
          content: { type: 'string', description: 'Comment content' },
          author: { type: 'string', description: 'Comment author' },
          authorType: {
            type: 'string',
            enum: ['agent', 'customer', 'system'],
            description: 'Type of author'
          },
          isInternal: {
            type: 'boolean',
            description: 'Whether this is an internal comment',
            default: false
          }
        },
        required: ['ticketId', 'content', 'author', 'authorType'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const comment = await addTicketComment(context.teamId, args as any)
        return {
          success: true,
          data: comment,
          summary: `Added comment to ticket ${comment.ticketId}`
        }
      }
    },
    {
      name: 'list_tickets',
      description: 'List all support tickets, optionally filtered by status',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'in-progress', 'resolved', 'closed'],
            description: 'Optional status to filter tickets by'
          }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const { status, priority, assignedTo } = args as {
          status?: string
          priority?: string
          assignedTo?: string
        }
        const tickets = await listTickets(
          context.teamId,
          status as any,
          priority as any,
          assignedTo
        )
        return { success: true, data: tickets, summary: `Found ${tickets.length} tickets` }
      }
    }
  ]
}
