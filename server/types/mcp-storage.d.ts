import type { McpServer, McpProvider, McpCategory } from '~/types'

export type StoredMcpServer = McpServer & {
  createdAt: string
  updatedAt: string
  lastStatus?: 'ok' | 'error' | 'unknown'
  lastCheckedAt?: string | null
}

export interface McpServerTemplate {
  id: string
  name: string
  description: string
  provider: McpProvider
  category: McpCategory
  icon: string
  color: string
  defaultConfig: Partial<McpServer>
}


