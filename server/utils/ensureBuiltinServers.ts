/**
 * Utility to ensure builtin MCP servers (Kanban and Calendar) are registered
 * These are automatically created if they don't exist
 */

import type { StoredMcpServer } from '../types/mcp-storage'

export async function ensureBuiltinServers(): Promise<void> {
  const mcpStorage = useStorage('mcp')
  const servers = (await mcpStorage.getItem<StoredMcpServer[]>('servers.json')) || []

  let modified = false

  // Ensure builtin-kanban exists
  if (!servers.find((s) => s.id === 'builtin-kanban')) {
    console.log('[EnsureBuiltinServers] Creating builtin-kanban server')
    servers.push({
      id: 'builtin-kanban',
      name: 'Team Kanban Board',
      provider: 'builtin-kanban',
      category: 'productivity',
      description:
        'Built-in Kanban board for task management. Access and manage team boards, cards, and workflows.',
      auth: {
        type: 'bearer',
        token: 'builtin'
      },
      metadata: {
        builtin: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    modified = true
  }

  // Ensure builtin-calendar exists
  if (!servers.find((s) => s.id === 'builtin-calendar')) {
    console.log('[EnsureBuiltinServers] Creating builtin-calendar server')
    servers.push({
      id: 'builtin-calendar',
      name: 'Team Calendar',
      provider: 'builtin-calendar',
      category: 'calendar',
      description:
        'Built-in team calendar for event management. View and manage calendar events for all team members.',
      auth: {
        type: 'bearer',
        token: 'builtin'
      },
      metadata: {
        builtin: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    modified = true
  }

  // Ensure builtin-agents exists
  if (!servers.find((s) => s.id === 'builtin-agents')) {
    console.log('[EnsureBuiltinServers] Creating builtin-agents server')
    servers.push({
      id: 'builtin-agents',
      name: 'Agents Directory',
      provider: 'builtin-agents',
      category: 'directory',
      description:
        'Built-in directory of available agents, their roles, and capabilities to support intelligent delegation.',
      auth: {
        type: 'bearer',
        token: 'builtin'
      },
      metadata: {
        builtin: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    modified = true
  }

  if (modified) {
    await mcpStorage.setItem('servers.json', servers)
    console.log('[EnsureBuiltinServers] Builtin servers initialized')
  }
}
