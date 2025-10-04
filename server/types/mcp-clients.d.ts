import type { McpProvider, McpCategory } from '~/types'

export type McpEmailContext = {
  subject: string
  text: string
  from?: string | null
  receivedAt: string
  attachments?: Array<{
    filename: string
    path: string // Path in datasafe
    mimeType: string
    size: number
  }>
}

export type McpContextResult = {
  serverId: string
  serverName: string
  provider: McpProvider
  category: McpCategory
  summary: string
  details?: unknown
}
