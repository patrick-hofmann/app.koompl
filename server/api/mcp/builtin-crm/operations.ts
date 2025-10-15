import type { CrmMcpContext } from './context'
import {
  createLead,
  updateLead,
  getLead,
  listLeads,
  createOpportunity,
  updateOpportunity,
  listOpportunities,
  getPipelineData,
  createContact,
  listContacts,
  getContact
} from '../../../features/crm'

export async function createCrmLead(
  context: CrmMcpContext,
  leadData: {
    name: string
    email: string
    company?: string
    phone?: string
    source: string
    status?: 'new' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost'
    value?: number
    probability?: number
    expectedCloseDate?: string
    notes?: string
  }
) {
  return await createLead(context.teamId, {
    ...leadData,
    status: leadData.status || 'new'
  })
}

export async function updateCrmLead(
  context: CrmMcpContext,
  leadId: string,
  updates: {
    name?: string
    email?: string
    company?: string
    phone?: string
    source?: string
    status?: 'new' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost'
    value?: number
    probability?: number
    expectedCloseDate?: string
    notes?: string
  }
) {
  return await updateLead(context.teamId, leadId, updates)
}

export async function getCrmLead(context: CrmMcpContext, leadId: string) {
  return await getLead(context.teamId, leadId)
}

export async function listCrmLeads(
  context: CrmMcpContext,
  status?: 'new' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost'
) {
  return await listLeads(context.teamId, status)
}

export async function createCrmOpportunity(
  context: CrmMcpContext,
  opportunityData: {
    leadId: string
    name: string
    description?: string
    value: number
    probability: number
    stage:
      | 'prospecting'
      | 'qualification'
      | 'proposal'
      | 'negotiation'
      | 'closed-won'
      | 'closed-lost'
    expectedCloseDate: string
    actualCloseDate?: string
    notes?: string
  }
) {
  return await createOpportunity(context.teamId, opportunityData)
}

export async function updateCrmOpportunity(
  context: CrmMcpContext,
  opportunityId: string,
  updates: {
    name?: string
    description?: string
    value?: number
    probability?: number
    stage?:
      | 'prospecting'
      | 'qualification'
      | 'proposal'
      | 'negotiation'
      | 'closed-won'
      | 'closed-lost'
    expectedCloseDate?: string
    actualCloseDate?: string
    notes?: string
  }
) {
  return await updateOpportunity(context.teamId, opportunityId, updates)
}

export async function listCrmOpportunities(
  context: CrmMcpContext,
  stage?:
    | 'prospecting'
    | 'qualification'
    | 'proposal'
    | 'negotiation'
    | 'closed-won'
    | 'closed-lost'
) {
  return await listOpportunities(context.teamId, stage)
}

export async function getCrmPipeline(context: CrmMcpContext) {
  return await getPipelineData(context.teamId)
}

export async function createCrmContact(
  context: CrmMcpContext,
  contactData: {
    name: string
    email: string
    company?: string
    phone?: string
    title?: string
    notes?: string
  }
) {
  return await createContact(context.teamId, contactData)
}

export async function listCrmContacts(context: CrmMcpContext) {
  return await listContacts(context.teamId)
}

export async function getCrmContact(context: CrmMcpContext, contactId: string) {
  return await getContact(context.teamId, contactId)
}
