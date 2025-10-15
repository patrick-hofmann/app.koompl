import * as research from '../../../features/research'
import type { ResearchMcpContext } from './context'

export async function saveResearchQuery(
  context: ResearchMcpContext,
  args: Parameters<typeof research.saveResearchQuery>[1]
) {
  return research.saveResearchQuery(context.teamId, args)
}

export async function listResearchQueries(context: ResearchMcpContext) {
  return research.listResearchQueries(context.teamId)
}

export async function createCompetitorAnalysis(
  context: ResearchMcpContext,
  args: Parameters<typeof research.createCompetitorAnalysis>[1]
) {
  return research.createCompetitorAnalysis(context.teamId, args)
}

export async function listCompetitorAnalyses(context: ResearchMcpContext) {
  return research.listCompetitorAnalyses(context.teamId)
}

export async function createMarketInsight(
  context: ResearchMcpContext,
  args: Parameters<typeof research.createMarketInsight>[1]
) {
  return research.createMarketInsight(context.teamId, args)
}

export async function listMarketInsights(context: ResearchMcpContext) {
  return research.listMarketInsights(context.teamId)
}
