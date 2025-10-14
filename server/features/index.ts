/**
 * Server Features - Centralized Business Logic
 *
 * This module exports all feature-based functionality that can be used
 * anywhere in the application: REST endpoints, MCP servers, utilities, etc.
 *
 * @example
 * ```typescript
 * // Import specific features
 * import { listBoards, createCard } from '~/server/features/kanban'
 *
 * // Or import from index
 * import * as Kanban from '~/server/features'
 * const boards = await Kanban.kanban.listBoards({ teamId: '...' })
 * ```
 */

// Datasafe - Secure file vault
export * as datasafe from './datasafe'
export type { DatasafeContext, DatasafeStats } from './datasafe'

// Kanban - Task board management
export * as kanban from './kanban'
export type { KanbanContext } from './kanban'

// Calendar - Event management
export * as calendar from './calendar'
export type { CalendarContext } from './calendar'

// Agent - AI agent management
export * as agent from './agent'
export type { AgentContext } from './agent'

// Agent Directory - Agent queries and capabilities
export * as agentDirectory from './agent/directory'
export type { AgentDirectoryEntry } from './agent/directory'

// Team - Team and user management
export * as team from './team'
export type { TeamContext } from './team'

// Koompl - Predefined templates and custom koompls
export * as koompl from './koompl'
export type {
  PredefinedKoomplTemplate,
  PredefinedKoomplStatus,
  PredefinedKoomplContext,
  CustomKoomplContext
} from './koompl'
