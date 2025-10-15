// Public API for HR feature
export * from './storage'

export interface HRApi {
  // Candidate management
  createCandidate: typeof import('./storage').createCandidate
  updateCandidate: typeof import('./storage').updateCandidate
  listCandidates: typeof import('./storage').listCandidates

  // Interview management
  createInterview: typeof import('./storage').createInterview
  listInterviews: typeof import('./storage').listInterviews

  // Employee management
  createEmployee: typeof import('./storage').createEmployee
  listEmployees: typeof import('./storage').listEmployees
}

// Re-export all storage functions for easy access
export {
  createCandidate,
  updateCandidate,
  listCandidates,
  createInterview,
  listInterviews,
  createEmployee,
  listEmployees
} from './storage'
