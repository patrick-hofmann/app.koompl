import type { BuiltinMcpDefinition } from '../../shared'
import type { ResearchMcpContext } from './context'
import {
  saveResearchQuery,
  listResearchQueries,
  createCompetitorAnalysis,
  listCompetitorAnalyses,
  createMarketInsight,
  listMarketInsights
} from './operations'

export const researchDefinition: BuiltinMcpDefinition<ResearchMcpContext> = {
  id: 'builtin-research',
  serverName: 'builtin-research-server',
  logPrefix: '[BuiltinResearchMCP]',
  context: {
    spec: {
      teamIdEnv: 'RESEARCH_TEAM_ID',
      userIdEnv: 'RESEARCH_USER_ID',
      agentIdEnv: 'RESEARCH_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.RESEARCH_TEAM_ID as string,
      userId: env.RESEARCH_USER_ID as string,
      agentId: env.RESEARCH_AGENT_ID || undefined
    })
  },
  tools: [
    {
      name: 'save_research_query',
      description: 'Save a research query and its results',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The research query' },
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
                snippet: { type: 'string' },
                source: { type: 'string' },
                date: { type: 'string' }
              },
              required: ['title', 'url', 'snippet', 'source', 'date']
            }
          },
          searchedAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the search was performed'
          }
        },
        required: ['query', 'results', 'searchedAt'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const query = await saveResearchQuery(context, args as any)
        return { success: true, data: query, summary: `Saved research query: ${query.query}` }
      }
    },
    {
      name: 'list_research_queries',
      description: 'List all saved research queries',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async ({ context }) => {
        const queries = await listResearchQueries(context)
        return { success: true, data: queries, summary: `Found ${queries.length} research queries` }
      }
    },
    {
      name: 'create_competitor_analysis',
      description: 'Create a competitor analysis report',
      inputSchema: {
        type: 'object',
        properties: {
          competitorName: { type: 'string', description: 'Name of the competitor' },
          analysisType: {
            type: 'string',
            enum: ['pricing', 'features', 'market-share', 'strategy'],
            description: 'Type of analysis'
          },
          findings: { type: 'array', items: { type: 'string' }, description: 'Key findings' },
          recommendations: {
            type: 'array',
            items: { type: 'string' },
            description: 'Recommendations based on analysis'
          },
          timeframe: { type: 'string', description: 'Time period analyzed' },
          analyzedAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the analysis was performed'
          }
        },
        required: [
          'competitorName',
          'analysisType',
          'findings',
          'recommendations',
          'timeframe',
          'analyzedAt'
        ],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const analysis = await createCompetitorAnalysis(context, args as any)
        return {
          success: true,
          data: analysis,
          summary: `Created competitor analysis for ${analysis.competitorName}`
        }
      }
    },
    {
      name: 'list_competitor_analyses',
      description: 'List all competitor analyses',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async ({ context }) => {
        const analyses = await listCompetitorAnalyses(context)
        return {
          success: true,
          data: analyses,
          summary: `Found ${analyses.length} competitor analyses`
        }
      }
    },
    {
      name: 'create_market_insight',
      description: 'Create a market insight report',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title of the insight' },
          category: { type: 'string', description: 'Category of the insight' },
          summary: { type: 'string', description: 'Summary of the insight' },
          insights: { type: 'array', items: { type: 'string' }, description: 'Key insights' },
          sources: {
            type: 'array',
            items: { type: 'string' },
            description: 'Sources of information'
          },
          confidence: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Confidence level'
          }
        },
        required: ['title', 'category', 'summary', 'insights', 'sources', 'confidence'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const insight = await createMarketInsight(context, args as any)
        return { success: true, data: insight, summary: `Created market insight: ${insight.title}` }
      }
    },
    {
      name: 'list_market_insights',
      description: 'List all market insights',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async ({ context }) => {
        const insights = await listMarketInsights(context)
        return {
          success: true,
          data: insights,
          summary: `Found ${insights.length} market insights`
        }
      }
    }
  ]
}
