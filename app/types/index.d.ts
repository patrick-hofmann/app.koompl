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
  role: 'member' | 'owner'
  avatar: AvatarProps
}

export interface Stat {
  title: string
  icon: string
  value: number | string
  variation: number
  formatter?: (value: number) => string
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

export interface Agent {
  id: string
  name: string
  email: string
  role: string
  prompt: string
  avatar?: AvatarProps | { src?: string; text?: string; alt?: string }
}

export interface Team {
  id: string
  name: string
  description: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  password: string
}

export interface TeamMembership {
  id: string
  userId: string
  teamId: string
  role: 'admin' | 'user'
}

export interface UserTeamData {
  user: AuthUser
  team: Team
  role: 'admin' | 'user'
}
