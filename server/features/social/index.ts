// Public API for Social feature
export * from './storage'

export interface SocialApi {
  // Post management
  createPost: typeof import('./storage').createPost
  listPosts: typeof import('./storage').listPosts

  // Campaign management
  createCampaign: typeof import('./storage').createCampaign
  listCampaigns: typeof import('./storage').listCampaigns
}

// Re-export all storage functions for easy access
export { createPost, listPosts, createCampaign, listCampaigns } from './storage'
