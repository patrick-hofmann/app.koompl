import type { BuiltinMcpDefinition } from '../../shared'
import type { AnalyticsMcpContext } from './context'
import { getWebsiteTraffic, getSalesReport } from './operations'

export const analyticsDefinition: BuiltinMcpDefinition<AnalyticsMcpContext> = {
  id: 'builtin-analytics',
  serverName: 'builtin-analytics-server',
  logPrefix: '[BuiltinAnalyticsMCP]',
  context: {
    spec: {
      teamIdEnv: 'ANALYTICS_TEAM_ID',
      userIdEnv: 'ANALYTICS_USER_ID',
      agentIdEnv: 'ANALYTICS_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.ANALYTICS_TEAM_ID as string,
      userId: env.ANALYTICS_USER_ID as string,
      agentId: env.ANALYTICS_AGENT_ID || undefined
    })
  },
  tools: [
    {
      name: 'get_website_traffic',
      description: 'Get website traffic data',
      inputSchema: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            default: '30d',
            description: 'Time period (e.g., "7d", "30d", "90d")'
          }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const traffic = await getWebsiteTraffic(context, args as any)
        return {
          success: true,
          data: traffic,
          summary: `Retrieved website traffic for ${(args as any).period}`
        }
      }
    },
    {
      name: 'get_sales_report',
      description: 'Get a sales performance report',
      inputSchema: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            default: 'month',
            description: 'Time period (e.g., "day", "week", "month", "quarter")'
          }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const sales = await getSalesReport(context, args as any)
        return {
          success: true,
          data: sales,
          summary: `Retrieved sales report for ${(args as any).period}`
        }
      }
    }
  ]
}
