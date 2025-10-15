import type { BuiltinMcpDefinition } from '../../shared'
import type { MonitoringMcpContext } from './context'
import { getSystemStatus, getMetric, listAlerts } from './operations'

export const monitoringDefinition: BuiltinMcpDefinition<MonitoringMcpContext> = {
  id: 'builtin-monitoring',
  serverName: 'builtin-monitoring-server',
  logPrefix: '[BuiltinMonitoringMCP]',
  context: {
    spec: {
      teamIdEnv: 'MONITORING_TEAM_ID',
      userIdEnv: 'MONITORING_USER_ID',
      agentIdEnv: 'MONITORING_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.MONITORING_TEAM_ID as string,
      userId: env.MONITORING_USER_ID as string,
      agentId: env.MONITORING_AGENT_ID || undefined
    })
  },
  tools: [
    {
      name: 'get_system_status',
      description: 'Get the current status of key systems',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async ({ context }) => {
        const status = await getSystemStatus(context)
        return { success: true, data: status, summary: 'Retrieved system status' }
      }
    },
    {
      name: 'get_metric',
      description: 'Get a specific system metric',
      inputSchema: {
        type: 'object',
        properties: {
          metricName: {
            type: 'string',
            description: 'Name of the metric (e.g., "cpu_usage", "memory_utilization")'
          },
          timeframe: {
            type: 'string',
            default: '1h',
            description: 'Timeframe for the metric (e.g., "1h", "24h", "7d")'
          }
        },
        required: ['metricName'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const metric = await getMetric(context, args as any)
        return {
          success: true,
          data: metric,
          summary: `Retrieved metric ${(args as any).metricName}`
        }
      }
    },
    {
      name: 'list_alerts',
      description: 'List active system alerts',
      inputSchema: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['info', 'warning', 'critical'], default: 'critical' }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const alerts = await listAlerts(context, args as any)
        return {
          success: true,
          data: alerts,
          summary: `Found ${alerts.length} ${(args as any).severity} alerts`
        }
      }
    }
  ]
}
