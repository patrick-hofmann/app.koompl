// Public API for Research feature
export * from './storage'

export interface ResearchApi {
  // Research Query management
  saveResearchQuery: typeof import('./storage').saveResearchQuery
  listResearchQueries: typeof import('./storage').listResearchQueries

  // Competitor Analysis
  createCompetitorAnalysis: typeof import('./storage').createCompetitorAnalysis
  listCompetitorAnalyses: typeof import('./storage').listCompetitorAnalyses

  // Market Insights
  createMarketInsight: typeof import('./storage').createMarketInsight
  listMarketInsights: typeof import('./storage').listMarketInsights
}

// Re-export all storage functions for easy access
export {
  saveResearchQuery,
  listResearchQueries,
  createCompetitorAnalysis,
  listCompetitorAnalyses,
  createMarketInsight,
  listMarketInsights
} from './storage'
