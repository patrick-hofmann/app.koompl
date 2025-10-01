export interface MailLogEntry {
  id: string
  timestamp: string
  type: 'inbound' | 'outgoing' | 'agent_respond' | 'inbound_processed'
  messageId: string
  from: string
  to: string
  subject: string
  body: string
  agentId?: string
  agentEmail?: string
  usedOpenAI?: boolean
  mailgunSent?: boolean
  domainFiltered?: boolean
  mcpServerIds?: string[]
  mcpContextCount?: number
  storageKey?: string
  metadata?: Record<string, unknown>
}

export interface InboundEmail {
  id: string
  timestamp: string
  messageId: string
  from: string
  to: string
  subject: string
  body: string
  html?: string
  agentId?: string
  agentEmail?: string
  mcpContexts?: unknown[]
  rawPayload?: Record<string, unknown>
}

export interface OutboundEmail {
  id: string
  timestamp: string
  messageId: string
  from: string
  to: string
  subject: string
  body: string
  agentId: string
  agentEmail: string
  usedOpenAI: boolean
  mailgunSent: boolean
  mcpServerIds?: string[]
  mcpContextCount?: number
  isAutomatic?: boolean
}


