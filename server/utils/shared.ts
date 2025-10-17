/**
 * Shared utilities for server API endpoints
 */

import { nanoid } from 'nanoid'
// import { createHash } from 'crypto' // Removed for build compatibility
import type { Agent } from '~/types'

/**
 * Normalize MCP server IDs from various input types
 */
export function normalizeMcpServerIds(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback
  const ids = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
  return Array.from(new Set(ids))
}

/**
 * Generate avatar for agent based on name, email, and id
 */
export function generateAvatar(name: string, email: string | undefined, id: string) {
  const basis = email || name || id
  // Simple hash function for deterministic avatar generation
  let hash = 0
  for (let i = 0; i < basis.length; i++) {
    const char = basis.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  const seed = encodeURIComponent(Math.abs(hash).toString(36))
  // Use Pravatar for person-like avatars, deterministic via seed
  const src = `https://i.pravatar.cc/256?u=${seed}`
  const text = (
    name
      .split(' ')
      .filter((w) => w)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'AG'
  ).padEnd(2, (name[0] || 'A').toUpperCase())
  return { src, alt: name, text }
}

/**
 * Generate a unique agent ID from name
 */
export function generateAgentId(name: string, existingIds: string[]): string {
  const baseSlug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'agent'
  let id = baseSlug
  if (existingIds.includes(id)) {
    id = `${baseSlug}-${nanoid(4)}`
  }
  return id
}

/**
 * Generic storage helper for collections
 */
export class CollectionStorage<T> {
  constructor(
    private storage: ReturnType<typeof useStorage>,
    private collectionKey: string
  ) {}

  async read(): Promise<T[]> {
    const list = await this.storage.getItem<T[]>(this.collectionKey)
    return Array.isArray(list) ? list : []
  }

  async write(items: T[]): Promise<void> {
    await this.storage.setItem(this.collectionKey, items)
  }

  async findById(id: string): Promise<T | null> {
    const items = await this.read()
    return items.find((item: any) => item?.id === id) || null
  }

  async findIndexById(id: string): Promise<number> {
    const items = await this.read()
    return items.findIndex((item: any) => item?.id === id)
  }

  async create(item: T): Promise<T> {
    const items = await this.read()
    const updatedItems = [...items, item]
    await this.write(updatedItems)
    return item
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    const items = await this.read()
    const index = await this.findIndexById(id)
    if (index === -1) return null
    const existing = items[index]
    const updated = { ...existing, ...updates, id } as T
    items.splice(index, 1, updated)
    await this.write(items)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    const items = await this.read()
    const filtered = items.filter((item: any) => item?.id !== id)
    if (filtered.length === items.length) return false
    await this.write(filtered)
    return true
  }
}

/**
 * Agent-specific storage operations
 */
export function createAgentStorage() {
  const storage = useStorage('agents')
  const collectionKey = 'agents.json'
  return new CollectionStorage<Agent>(storage, collectionKey)
}

/**
 * Extract username from email (username@domain -> username)
 */
export function extractUsername(email: string): string {
  return email.split('@')[0].toLowerCase().trim()
}

/**
 * Validate username format
 */
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_-]+$/i.test(username)
}

/**
 * Create a complete agent object with defaults
 * Note: email field now stores only the username part
 */
export function createAgentObject(body: Partial<Agent>, existingIds: string[]): Agent {
  const name = body.name || 'Unnamed'
  const id = generateAgentId(name, existingIds)

  // Extract username from email if provided (may include @domain)
  const username = body.email ? extractUsername(body.email) : id

  return {
    id,
    name,
    email: username, // Store only username, not full email
    role: body.role || 'Agent',
    prompt: body.prompt || '',
    avatar: body.avatar || generateAvatar(name, username, id),
    mcpServerIds: normalizeMcpServerIds(body.mcpServerIds)
  }
}

/**
 * Update agent with proper normalization
 * Note: email field now stores only the username part
 */
export function updateAgentObject(existing: Agent, updates: Partial<Agent>): Agent {
  const name = updates.name || existing.name

  // Extract username from email if it's being updated
  const username = updates.email ? extractUsername(updates.email) : existing.email

  return {
    ...existing,
    ...updates,
    id: existing.id, // Never change the ID
    email: username, // Store only username
    avatar: updates.avatar || generateAvatar(name, username, existing.id),
    mcpServerIds: normalizeMcpServerIds(updates.mcpServerIds, existing.mcpServerIds || [])
  }
}
