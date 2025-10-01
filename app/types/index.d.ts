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

export type McpCategory = 'calendar' | 'todo' | 'project' | 'documentation' | 'custom'

export type McpProvider =
  | 'google-calendar'
  | 'microsoft-outlook'
  | 'todoist'
  | 'trello'
  | 'nuxt-ui'
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

export interface MultiRoundConfig {
  enabled: boolean
  maxRounds: number
  timeoutMinutes: number
  canCommunicateWithAgents: boolean
  allowedAgentEmails?: string[]
  autoResumeOnResponse: boolean
}

export interface Agent {
  id: string
  name: string
  email: string
  role: string
  prompt: string
  avatar?: AvatarProps | { src?: string; text?: string; alt?: string }
  mcpServerIds?: string[]
  multiRoundConfig?: MultiRoundConfig
}

export interface Team {
  id: string
  name: string
  description?: string
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
