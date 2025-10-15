// Public API for CRM feature
export * from './storage'

export interface CRMApi {
  // Lead management
  createLead: typeof import('./storage').createLead
  updateLead: typeof import('./storage').updateLead
  getLead: typeof import('./storage').getLead
  listLeads: typeof import('./storage').listLeads

  // Opportunity management
  createOpportunity: typeof import('./storage').createOpportunity
  updateOpportunity: typeof import('./storage').updateOpportunity
  listOpportunities: typeof import('./storage').listOpportunities
  getPipelineData: typeof import('./storage').getPipelineData

  // Contact management
  createContact: typeof import('./storage').createContact
  listContacts: typeof import('./storage').listContacts
  getContact: typeof import('./storage').getContact
}

// Re-export all storage functions for easy access
export {
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
} from './storage'
