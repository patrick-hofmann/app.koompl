import type { AvatarProps } from '@nuxt/ui'

export type UserStatus = 'subscribed' | 'unsubscribed' | 'bounced'
export type SaleStatus = 'paid' | 'failed' | 'refunded'

export interface User {
  id: number
  name: string
  email: string
  avatar?: AvatarProps
  status: UserStatus
  location: string
}

export interface Mail {
  id: number
  unread?: boolean
  from: User
  subject: string
  body: string
  date: string
}

export interface Member {
  name: string
  username: string
  role: 'member' | 'owner' | 'admin' | 'user'
  avatar: AvatarProps
}

export interface Stat {
  title: string
  icon: string
  value: number | string
  variation: number
  formatter?: (value: number) => string
  status?: 'good' | 'warning' | 'error'
  showTrend?: boolean
}

export interface Sale {
  id: string
  date: string
  status: SaleStatus
  email: string
  amount: number
}

export interface Notification {
  id: number
  unread?: boolean
  sender: User
  body: string
  date: string
}

export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
  start: Date
  end: Date
}

export type McpCategory =
  | 'calendar'
  | 'todo'
  | 'project'
  | 'documentation'
  | 'productivity'
  | 'directory'
  | 'storage'
  | 'custom'

export type McpProvider =
  | 'google-calendar'
  | 'microsoft-outlook'
  | 'todoist'
  | 'trello'
  | 'nuxt-ui'
  | 'builtin-kanban'
  | 'builtin-calendar'
  | 'builtin-agents'
  | 'builtin-datasafe'
  | 'custom'

export interface McpServer {
  id: string
  name: string
  provider: McpProvider
  category: McpCategory
  url?: string
  description?: string
  auth: {
    type: 'oauth2' | 'apiKey' | 'basic' | 'bearer'
    clientId?: string
    clientSecret?: string
    token?: string
    apiKey?: string
    username?: string
    password?: string
    scope?: string[]
  }
  metadata?: Record<string, unknown>
  lastStatus?: 'ok' | 'error' | 'unknown'
  lastCheckedAt?: string | null
}

export type MailPolicyRule = 'team_and_agents' | 'team_only' | 'agents_only' | 'any'

export interface MailPolicyConfig {
  inbound?: MailPolicyRule
  outbound?: MailPolicyRule
  allowedInboundAddresses?: string[]
  allowedOutboundAddresses?: string[]
}

export interface MultiRoundConfig {
  mailPolicy?: MailPolicyConfig
}

export interface Agent {
  id: string
  name: string
  email: string // Stores username only (e.g., "chris-coordinator"), domain is derived from teamId
  role: string
  prompt: string
  avatar?: AvatarProps | { src?: string; text?: string; alt?: string }
  mcpServerIds?: string[]
  multiRoundConfig?: MultiRoundConfig
  teamId?: string // Team this agent belongs to
  isPredefined?: boolean // Whether this is a predefined Koompl
  createdAt?: string
  updatedAt?: string
}

export interface Team {
  id: string
  name: string
  description?: string
  domain?: string // Team's unique domain (e.g., "company.com")
  createdAt?: string
  updatedAt?: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  password: string
  createdAt?: string
  updatedAt?: string
}

export interface TeamMembership {
  id: string
  userId: string
  teamId: string
  role: 'admin' | 'user'
  createdAt?: string
  updatedAt?: string
}

export interface UserTeamData {
  user: AuthUser
  team: Team
  role: 'admin' | 'user'
}

export interface IdentityData {
  users: AuthUser[]
  teams: Team[]
  memberships: TeamMembership[]
  superAdminIds: string[]
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

export interface EmailMessage {
  id: string
  messageId: string
  conversationId: string
  from: string
  to: string
  subject: string
  body: string
  html?: string
  timestamp: string
  direction: 'inbound' | 'outbound'
  isUnread?: boolean
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

export type ComposeMode = 'new' | 'reply' | 'forward'

export interface ComposeData {
  mode: ComposeMode
  to?: string
  subject?: string
  body?: string
  inReplyTo?: string
  originalMessageId?: string
}
