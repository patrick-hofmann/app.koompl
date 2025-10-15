import type { MonitoringMcpContext } from './context'

// Mock monitoring operations
export async function getSystemStatus() {
  const mockStatus = {
    webServer: 'operational',
    database: 'operational',
    apiGateway: 'operational',
    lastCheck: new Date().toISOString()
  }
  return mockStatus
}

export async function getMetric(
  context: MonitoringMcpContext,
  args: { metricName: string; timeframe: string }
) {
  const { metricName, timeframe } = args
  const mockData = {
    metricName,
    timeframe,
    value: Math.random() * 100,
    unit: metricName.includes('usage') || metricName.includes('utilization') ? '%' : 'count',
    timestamp: new Date().toISOString()
  }
  return mockData
}

export async function listAlerts(context: MonitoringMcpContext, args: { severity: string }) {
  const { severity } = args
  const mockAlerts = [
    {
      id: 'alert-1',
      message: 'High CPU usage on web server',
      severity: 'warning',
      timestamp: new Date().toISOString()
    },
    {
      id: 'alert-2',
      message: 'Database connection error',
      severity: 'critical',
      timestamp: new Date().toISOString()
    }
  ]
  const filteredAlerts = mockAlerts.filter((alert) => alert.severity === severity)
  return filteredAlerts
}
