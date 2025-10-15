import type { BuiltinMcpDefinition } from '../shared'
import type { CrmMcpContext } from './context'
import {
  createCrmLead,
  updateCrmLead,
  getCrmLead,
  listCrmLeads,
  createCrmOpportunity,
  updateCrmOpportunity,
  listCrmOpportunities,
  getCrmPipeline,
  createCrmContact,
  listCrmContacts,
  getCrmContact
} from './operations'

export const crmDefinition: BuiltinMcpDefinition<CrmMcpContext> = {
  id: 'builtin-crm',
  serverName: 'builtin-crm-server',
  logPrefix: '[BuiltinCrmMCP]',
  context: {
    spec: {
      teamIdEnv: 'CRM_TEAM_ID',
      userIdEnv: 'CRM_USER_ID',
      agentIdEnv: 'CRM_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.CRM_TEAM_ID as string,
      userId: env.CRM_USER_ID as string,
      agentId: env.CRM_AGENT_ID || undefined
    })
  },
  tools: [
    {
      name: 'create_lead',
      description: 'Create a new sales lead in the CRM system',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Full name of the lead'
          },
          email: {
            type: 'string',
            description: 'Email address of the lead'
          },
          company: {
            type: 'string',
            description: 'Company name (optional)'
          },
          phone: {
            type: 'string',
            description: 'Phone number (optional)'
          },
          source: {
            type: 'string',
            description: 'Lead source (e.g., website, referral, cold call)'
          },
          status: {
            type: 'string',
            enum: ['new', 'qualified', 'proposal', 'negotiation', 'closed-won', 'closed-lost'],
            description: 'Current status of the lead'
          },
          value: {
            type: 'number',
            description: 'Estimated deal value in USD'
          },
          probability: {
            type: 'number',
            description: 'Probability of closing (0-100)'
          },
          expectedCloseDate: {
            type: 'string',
            description: 'Expected close date (ISO format)'
          },
          notes: {
            type: 'string',
            description: 'Additional notes about the lead'
          }
        },
        required: ['name', 'email', 'source'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinCrmMCP] Tool called: create_lead', { args })

        try {
          const lead = await createCrmLead(context, args as any)
          console.log('[BuiltinCrmMCP] Tool result: create_lead', { leadId: lead.id })

          return {
            success: true,
            data: lead,
            summary: `Created lead "${lead.name}" with ID ${lead.id}`
          }
        } catch (error) {
          console.error('[BuiltinCrmMCP] Error creating lead:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'update_lead',
      description: 'Update an existing sales lead',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: {
            type: 'string',
            description: 'ID of the lead to update'
          },
          name: {
            type: 'string',
            description: 'Full name of the lead'
          },
          email: {
            type: 'string',
            description: 'Email address of the lead'
          },
          company: {
            type: 'string',
            description: 'Company name'
          },
          phone: {
            type: 'string',
            description: 'Phone number'
          },
          source: {
            type: 'string',
            description: 'Lead source'
          },
          status: {
            type: 'string',
            enum: ['new', 'qualified', 'proposal', 'negotiation', 'closed-won', 'closed-lost'],
            description: 'Current status of the lead'
          },
          value: {
            type: 'number',
            description: 'Estimated deal value in USD'
          },
          probability: {
            type: 'number',
            description: 'Probability of closing (0-100)'
          },
          expectedCloseDate: {
            type: 'string',
            description: 'Expected close date (ISO format)'
          },
          notes: {
            type: 'string',
            description: 'Additional notes about the lead'
          }
        },
        required: ['leadId'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinCrmMCP] Tool called: update_lead', { args })

        try {
          const { leadId, ...updates } = args as any
          const lead = await updateCrmLead(context, leadId, updates)

          if (!lead) {
            return {
              success: false,
              error: `Lead with ID ${leadId} not found`
            }
          }

          console.log('[BuiltinCrmMCP] Tool result: update_lead', { leadId })

          return {
            success: true,
            data: lead,
            summary: `Updated lead "${lead.name}" with ID ${lead.id}`
          }
        } catch (error) {
          console.error('[BuiltinCrmMCP] Error updating lead:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'get_lead',
      description: 'Get details of a specific lead',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: {
            type: 'string',
            description: 'ID of the lead to retrieve'
          }
        },
        required: ['leadId'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinCrmMCP] Tool called: get_lead', { args })

        try {
          const { leadId } = args as { leadId: string }
          const lead = await getCrmLead(context, leadId)

          if (!lead) {
            return {
              success: false,
              error: `Lead with ID ${leadId} not found`
            }
          }

          console.log('[BuiltinCrmMCP] Tool result: get_lead', { leadId })

          return {
            success: true,
            data: lead,
            summary: `Retrieved lead "${lead.name}"`
          }
        } catch (error) {
          console.error('[BuiltinCrmMCP] Error getting lead:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'list_leads',
      description: 'List all leads, optionally filtered by status',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['new', 'qualified', 'proposal', 'negotiation', 'closed-won', 'closed-lost'],
            description: 'Filter leads by status (optional)'
          }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinCrmMCP] Tool called: list_leads', { args })

        try {
          const { status } = args as { status?: string }
          const leads = await listCrmLeads(context, status as any)

          console.log('[BuiltinCrmMCP] Tool result: list_leads', { count: leads.length })

          return {
            success: true,
            data: leads,
            summary: `Found ${leads.length} leads${status ? ` with status "${status}"` : ''}`
          }
        } catch (error) {
          console.error('[BuiltinCrmMCP] Error listing leads:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'create_opportunity',
      description: 'Create a new sales opportunity',
      inputSchema: {
        type: 'object',
        properties: {
          leadId: {
            type: 'string',
            description: 'ID of the associated lead'
          },
          name: {
            type: 'string',
            description: 'Name of the opportunity'
          },
          description: {
            type: 'string',
            description: 'Description of the opportunity'
          },
          value: {
            type: 'number',
            description: 'Deal value in USD'
          },
          probability: {
            type: 'number',
            description: 'Probability of closing (0-100)'
          },
          stage: {
            type: 'string',
            enum: [
              'prospecting',
              'qualification',
              'proposal',
              'negotiation',
              'closed-won',
              'closed-lost'
            ],
            description: 'Current stage of the opportunity'
          },
          expectedCloseDate: {
            type: 'string',
            description: 'Expected close date (ISO format)'
          },
          actualCloseDate: {
            type: 'string',
            description: 'Actual close date (ISO format, optional)'
          },
          notes: {
            type: 'string',
            description: 'Additional notes about the opportunity'
          }
        },
        required: ['leadId', 'name', 'value', 'probability', 'stage', 'expectedCloseDate'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinCrmMCP] Tool called: create_opportunity', { args })

        try {
          const opportunity = await createCrmOpportunity(context, args as any)
          console.log('[BuiltinCrmMCP] Tool result: create_opportunity', {
            opportunityId: opportunity.id
          })

          return {
            success: true,
            data: opportunity,
            summary: `Created opportunity "${opportunity.name}" with ID ${opportunity.id}`
          }
        } catch (error) {
          console.error('[BuiltinCrmMCP] Error creating opportunity:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'update_opportunity',
      description: 'Update an existing sales opportunity',
      inputSchema: {
        type: 'object',
        properties: {
          opportunityId: {
            type: 'string',
            description: 'ID of the opportunity to update'
          },
          name: {
            type: 'string',
            description: 'Name of the opportunity'
          },
          description: {
            type: 'string',
            description: 'Description of the opportunity'
          },
          value: {
            type: 'number',
            description: 'Deal value in USD'
          },
          probability: {
            type: 'number',
            description: 'Probability of closing (0-100)'
          },
          stage: {
            type: 'string',
            enum: [
              'prospecting',
              'qualification',
              'proposal',
              'negotiation',
              'closed-won',
              'closed-lost'
            ],
            description: 'Current stage of the opportunity'
          },
          expectedCloseDate: {
            type: 'string',
            description: 'Expected close date (ISO format)'
          },
          actualCloseDate: {
            type: 'string',
            description: 'Actual close date (ISO format)'
          },
          notes: {
            type: 'string',
            description: 'Additional notes about the opportunity'
          }
        },
        required: ['opportunityId'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinCrmMCP] Tool called: update_opportunity', { args })

        try {
          const { opportunityId, ...updates } = args as any
          const opportunity = await updateCrmOpportunity(context, opportunityId, updates)

          if (!opportunity) {
            return {
              success: false,
              error: `Opportunity with ID ${opportunityId} not found`
            }
          }

          console.log('[BuiltinCrmMCP] Tool result: update_opportunity', { opportunityId })

          return {
            success: true,
            data: opportunity,
            summary: `Updated opportunity "${opportunity.name}" with ID ${opportunity.id}`
          }
        } catch (error) {
          console.error('[BuiltinCrmMCP] Error updating opportunity:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'list_opportunities',
      description: 'List all opportunities, optionally filtered by stage',
      inputSchema: {
        type: 'object',
        properties: {
          stage: {
            type: 'string',
            enum: [
              'prospecting',
              'qualification',
              'proposal',
              'negotiation',
              'closed-won',
              'closed-lost'
            ],
            description: 'Filter opportunities by stage (optional)'
          }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinCrmMCP] Tool called: list_opportunities', { args })

        try {
          const { stage } = args as { stage?: string }
          const opportunities = await listCrmOpportunities(context, stage as any)

          console.log('[BuiltinCrmMCP] Tool result: list_opportunities', {
            count: opportunities.length
          })

          return {
            success: true,
            data: opportunities,
            summary: `Found ${opportunities.length} opportunities${stage ? ` with stage "${stage}"` : ''}`
          }
        } catch (error) {
          console.error('[BuiltinCrmMCP] Error listing opportunities:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'get_pipeline',
      description: 'Get sales pipeline data with stage breakdown',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async ({ context }) => {
        console.log('[BuiltinCrmMCP] Tool called: get_pipeline')

        try {
          const pipeline = await getCrmPipeline(context)

          console.log('[BuiltinCrmMCP] Tool result: get_pipeline', { stages: pipeline.length })

          return {
            success: true,
            data: pipeline,
            summary: `Retrieved pipeline data with ${pipeline.length} stages`
          }
        } catch (error) {
          console.error('[BuiltinCrmMCP] Error getting pipeline:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'create_contact',
      description: 'Create a new contact',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Full name of the contact'
          },
          email: {
            type: 'string',
            description: 'Email address of the contact'
          },
          company: {
            type: 'string',
            description: 'Company name (optional)'
          },
          phone: {
            type: 'string',
            description: 'Phone number (optional)'
          },
          title: {
            type: 'string',
            description: 'Job title (optional)'
          },
          notes: {
            type: 'string',
            description: 'Additional notes about the contact'
          }
        },
        required: ['name', 'email'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinCrmMCP] Tool called: create_contact', { args })

        try {
          const contact = await createCrmContact(context, args as any)
          console.log('[BuiltinCrmMCP] Tool result: create_contact', { contactId: contact.id })

          return {
            success: true,
            data: contact,
            summary: `Created contact "${contact.name}" with ID ${contact.id}`
          }
        } catch (error) {
          console.error('[BuiltinCrmMCP] Error creating contact:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'list_contacts',
      description: 'List all contacts',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async ({ context }) => {
        console.log('[BuiltinCrmMCP] Tool called: list_contacts')

        try {
          const contacts = await listCrmContacts(context)

          console.log('[BuiltinCrmMCP] Tool result: list_contacts', { count: contacts.length })

          return {
            success: true,
            data: contacts,
            summary: `Found ${contacts.length} contacts`
          }
        } catch (error) {
          console.error('[BuiltinCrmMCP] Error listing contacts:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'get_contact',
      description: 'Get details of a specific contact',
      inputSchema: {
        type: 'object',
        properties: {
          contactId: {
            type: 'string',
            description: 'ID of the contact to retrieve'
          }
        },
        required: ['contactId'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinCrmMCP] Tool called: get_contact', { args })

        try {
          const { contactId } = args as { contactId: string }
          const contact = await getCrmContact(context, contactId)

          if (!contact) {
            return {
              success: false,
              error: `Contact with ID ${contactId} not found`
            }
          }

          console.log('[BuiltinCrmMCP] Tool result: get_contact', { contactId })

          return {
            success: true,
            data: contact,
            summary: `Retrieved contact "${contact.name}"`
          }
        } catch (error) {
          console.error('[BuiltinCrmMCP] Error getting contact:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    }
  ]
}
