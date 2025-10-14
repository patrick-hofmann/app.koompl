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
  inReplyTo?: string[]
  references?: string[]
  agentId?: string
  agentEmail?: string
  teamId?: string
  conversationId?: string
  mcpContexts?: unknown[]
  rawPayload?: Record<string, unknown>
  attachments?: EmailAttachment[]
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
  teamId?: string
  conversationId?: string
  inReplyTo?: string
  references?: string[]
  usedOpenAI: boolean
  mailgunSent: boolean
  mcpServerIds?: string[]
  mcpContextCount?: number
  isAutomatic?: boolean
  attachments?: EmailAttachment[]
}

export interface EmailAttachment {
  id: string
  filename: string
  mimeType: string
  size: number
  storageKey?: string
  datasafePath?: string
  inline?: boolean
  contentId?: string
  base64?: string
}

export interface EmailConversation {
  id: string
  agentId: string
  teamId: string
  subject: string
  participants: string[]
  messageIds: string[]
  lastMessageDate: string
  messageCount: number
  hasUnread: boolean
  excerpt: string
}

export interface AgentEmailIndex {
  agentId: string
  teamId: string
  conversations: Record<string, EmailConversation>
  lastUpdated: string
}
