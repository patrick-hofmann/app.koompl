import { createStorage } from '../../utils/storage'

export interface ResearchQuery {
  id: string
  query: string
  results: Array<{
    title: string
    url: string
    snippet: string
    source: string
    date: string
  }>
  searchedAt: string
  teamId: string
}

export interface CompetitorAnalysis {
  id: string
  competitorName: string
  analysisType: 'pricing' | 'features' | 'market-share' | 'strategy'
  findings: string[]
  recommendations: string[]
  timeframe: string
  analyzedAt: string
  teamId: string
}

export interface MarketInsight {
  id: string
  title: string
  category: string
  summary: string
  insights: string[]
  sources: string[]
  confidence: 'low' | 'medium' | 'high'
  createdAt: string
  teamId: string
}

export interface ResearchData {
  queries: ResearchQuery[]
  competitorAnalyses: CompetitorAnalysis[]
  marketInsights: MarketInsight[]
}

const defaultResearchData: ResearchData = {
  queries: [],
  competitorAnalyses: [],
  marketInsights: []
}

export function createResearchStorage(teamId: string) {
  return createStorage<ResearchData>('research', teamId, defaultResearchData)
}

export async function saveResearchQuery(
  teamId: string,
  queryData: Omit<ResearchQuery, 'id' | 'teamId'>
): Promise<ResearchQuery> {
  const storage = createResearchStorage(teamId)
  const data = await storage.read()

  const query: ResearchQuery = {
    id: `query_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...queryData,
    teamId
  }

  data.queries.push(query)
  await storage.write(data)

  return query
}

export async function createCompetitorAnalysis(
  teamId: string,
  analysisData: Omit<CompetitorAnalysis, 'id' | 'teamId'>
): Promise<CompetitorAnalysis> {
  const storage = createResearchStorage(teamId)
  const data = await storage.read()

  const analysis: CompetitorAnalysis = {
    id: `analysis_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...analysisData,
    teamId
  }

  data.competitorAnalyses.push(analysis)
  await storage.write(data)

  return analysis
}

export async function createMarketInsight(
  teamId: string,
  insightData: Omit<MarketInsight, 'id' | 'teamId'>
): Promise<MarketInsight> {
  const storage = createResearchStorage(teamId)
  const data = await storage.read()

  const insight: MarketInsight = {
    id: `insight_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...insightData,
    teamId
  }

  data.marketInsights.push(insight)
  await storage.write(data)

  return insight
}

export async function listResearchQueries(teamId: string): Promise<ResearchQuery[]> {
  const storage = createResearchStorage(teamId)
  const data = await storage.read()
  return data.queries
}

export async function listCompetitorAnalyses(teamId: string): Promise<CompetitorAnalysis[]> {
  const storage = createResearchStorage(teamId)
  const data = await storage.read()
  return data.competitorAnalyses
}

export async function listMarketInsights(teamId: string): Promise<MarketInsight[]> {
  const storage = createResearchStorage(teamId)
  const data = await storage.read()
  return data.marketInsights
}
