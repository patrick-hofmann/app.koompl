import { createStorage } from '../../utils/storage'

export interface Lead {
  id: string
  name: string
  email: string
  company?: string
  phone?: string
  source: string
  status: 'new' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost'
  value?: number
  probability?: number
  expectedCloseDate?: string
  notes?: string
  createdAt: string
  updatedAt: string
  teamId: string
}

export interface Opportunity {
  id: string
  leadId: string
  name: string
  description?: string
  value: number
  probability: number
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost'
  expectedCloseDate: string
  actualCloseDate?: string
  notes?: string
  createdAt: string
  updatedAt: string
  teamId: string
}

export interface Contact {
  id: string
  name: string
  email: string
  company?: string
  phone?: string
  title?: string
  notes?: string
  createdAt: string
  updatedAt: string
  teamId: string
}

export interface CRMData {
  leads: Lead[]
  opportunities: Opportunity[]
  contacts: Contact[]
}

const defaultCRMData: CRMData = {
  leads: [],
  opportunities: [],
  contacts: []
}

export function createCRMStorage(teamId: string) {
  return createStorage<CRMData>('crm', teamId, defaultCRMData)
}

export async function createLead(
  teamId: string,
  leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<Lead> {
  const storage = createCRMStorage(teamId)
  const data = await storage.read()

  const lead: Lead = {
    id: `lead_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...leadData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.leads.push(lead)
  await storage.write(data)

  return lead
}

export async function updateLead(
  teamId: string,
  leadId: string,
  updates: Partial<Omit<Lead, 'id' | 'createdAt' | 'teamId'>>
): Promise<Lead | null> {
  const storage = createCRMStorage(teamId)
  const data = await storage.read()

  const leadIndex = data.leads.findIndex((l) => l.id === leadId)
  if (leadIndex === -1) return null

  data.leads[leadIndex] = {
    ...data.leads[leadIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  await storage.write(data)
  return data.leads[leadIndex]
}

export async function getLead(teamId: string, leadId: string): Promise<Lead | null> {
  const storage = createCRMStorage(teamId)
  const data = await storage.read()
  return data.leads.find((l) => l.id === leadId) || null
}

export async function listLeads(teamId: string, status?: Lead['status']): Promise<Lead[]> {
  const storage = createCRMStorage(teamId)
  const data = await storage.read()

  if (status) {
    return data.leads.filter((l) => l.status === status)
  }

  return data.leads
}

export async function createOpportunity(
  teamId: string,
  opportunityData: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<Opportunity> {
  const storage = createCRMStorage(teamId)
  const data = await storage.read()

  const opportunity: Opportunity = {
    id: `opp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...opportunityData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.opportunities.push(opportunity)
  await storage.write(data)

  return opportunity
}

export async function updateOpportunity(
  teamId: string,
  opportunityId: string,
  updates: Partial<Omit<Opportunity, 'id' | 'createdAt' | 'teamId'>>
): Promise<Opportunity | null> {
  const storage = createCRMStorage(teamId)
  const data = await storage.read()

  const oppIndex = data.opportunities.findIndex((o) => o.id === opportunityId)
  if (oppIndex === -1) return null

  data.opportunities[oppIndex] = {
    ...data.opportunities[oppIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  await storage.write(data)
  return data.opportunities[oppIndex]
}

export async function listOpportunities(
  teamId: string,
  stage?: Opportunity['stage']
): Promise<Opportunity[]> {
  const storage = createCRMStorage(teamId)
  const data = await storage.read()

  if (stage) {
    return data.opportunities.filter((o) => o.stage === stage)
  }

  return data.opportunities
}

export async function getPipelineData(
  teamId: string
): Promise<{ stage: string; count: number; value: number }[]> {
  const storage = createCRMStorage(teamId)
  const data = await storage.read()

  const stages = [
    'prospecting',
    'qualification',
    'proposal',
    'negotiation',
    'closed-won',
    'closed-lost'
  ]

  return stages.map((stage) => {
    const opportunities = data.opportunities.filter((o) => o.stage === stage)
    return {
      stage,
      count: opportunities.length,
      value: opportunities.reduce((sum, o) => sum + (o.value * o.probability) / 100, 0)
    }
  })
}

export async function createContact(
  teamId: string,
  contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<Contact> {
  const storage = createCRMStorage(teamId)
  const data = await storage.read()

  const contact: Contact = {
    id: `contact_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...contactData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.contacts.push(contact)
  await storage.write(data)

  return contact
}

export async function listContacts(teamId: string): Promise<Contact[]> {
  const storage = createCRMStorage(teamId)
  const data = await storage.read()
  return data.contacts
}

export async function getContact(teamId: string, contactId: string): Promise<Contact | null> {
  const storage = createCRMStorage(teamId)
  const data = await storage.read()
  return data.contacts.find((c) => c.id === contactId) || null
}
