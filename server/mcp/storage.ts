import { nanoid } from 'nanoid'
import { createError } from 'h3'
import type { McpServer, McpProvider, McpCategory } from '~/types'
import type { StoredMcpServer, McpServerTemplate } from '../types/mcp-storage'

const STORAGE_NAMESPACE = 'mcp'
const STORAGE_KEY = 'servers.json'

const VALID_PROVIDERS: McpProvider[] = [
  'google-calendar',
  'microsoft-outlook',
  'todoist',
  'trello',
  'nuxt-ui',
  'builtin-kanban',
  'builtin-calendar',
  'builtin-agents',
  'builtin-datasafe',
  'custom'
]
const VALID_CATEGORIES: McpCategory[] = [
  'calendar',
  'todo',
  'project',
  'documentation',
  'productivity',
  'directory',
  'storage',
  'custom'
]

const PROVIDER_PRESETS: Record<
  McpProvider,
  {
    category: McpCategory
    defaultName: string
    defaultDescription: string
    defaultUrl?: string
    defaultAuthType: McpServer['auth']['type']
  }
> = {
  'google-calendar': {
    category: 'calendar',
    defaultName: 'Google Calendar',
    defaultDescription: 'Sync upcoming events from Google Calendar using the official API.',
    defaultUrl: 'https://www.googleapis.com/calendar/v3',
    defaultAuthType: 'oauth2'
  },
  'microsoft-outlook': {
    category: 'calendar',
    defaultName: 'Microsoft 365 Calendar',
    defaultDescription: 'Access Outlook calendar availability via Microsoft Graph.',
    defaultUrl: 'https://graph.microsoft.com/v1.0',
    defaultAuthType: 'oauth2'
  },
  todoist: {
    category: 'todo',
    defaultName: 'Todoist Tasks',
    defaultDescription: 'List and manage tasks from Todoist.',
    defaultUrl: 'https://api.todoist.com/rest/v2',
    defaultAuthType: 'bearer'
  },
  trello: {
    category: 'project',
    defaultName: 'Trello Boards',
    defaultDescription: 'Surface Trello cards and due dates.',
    defaultUrl: 'https://api.trello.com/1',
    defaultAuthType: 'apiKey'
  },
  'nuxt-ui': {
    category: 'documentation',
    defaultName: 'Nuxt UI Documentation',
    defaultDescription: 'Access Nuxt UI component documentation, examples, and guidance.',
    defaultUrl: 'https://ui.nuxt.com',
    defaultAuthType: 'bearer'
  },
  'builtin-kanban': {
    category: 'productivity',
    defaultName: 'Team Kanban Board',
    defaultDescription:
      'Built-in Kanban board for task management. Access and manage team boards, cards, and workflows.',
    defaultAuthType: 'bearer'
  },
  'builtin-calendar': {
    category: 'calendar',
    defaultName: 'Team Calendar',
    defaultDescription:
      'Built-in team calendar for event management. View and manage calendar events for all team members.',
    defaultAuthType: 'bearer'
  },
  'builtin-agents': {
    category: 'directory',
    defaultName: 'Agents Directory',
    defaultDescription:
      'Built-in directory of active agents, their specialties, and capabilities for intelligent delegation.',
    defaultAuthType: 'bearer'
  },
  'builtin-datasafe': {
    category: 'storage',
    defaultName: 'Team Datasafe',
    defaultDescription:
      'Secure team files vault with hierarchy rules, attachment capture, and MCP access to upload or organize documents.',
    defaultAuthType: 'bearer'
  },
  custom: {
    category: 'custom',
    defaultName: 'Custom MCP Server',
    defaultDescription: 'Custom Model Context Protocol server integration.',
    defaultAuthType: 'bearer'
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function useMcpStorage() {
  return useStorage(STORAGE_NAMESPACE)
}

export async function listMcpServers(): Promise<StoredMcpServer[]> {
  // Primary: read from dedicated 'mcp' storage
  const servers = await useMcpStorage().getItem<StoredMcpServer[]>(STORAGE_KEY)
  if (Array.isArray(servers) && servers.length > 0) return servers

  // Fallback/migration: if empty, try reading legacy location in 'settings'
  try {
    const settingsStorage = useStorage('settings')
    const legacy = await settingsStorage.getItem<StoredMcpServer[]>(STORAGE_KEY)
    if (Array.isArray(legacy) && legacy.length > 0) {
      // Migrate to 'mcp' storage for future reads
      await writeMcpServers(legacy)
      return legacy
    }
  } catch {
    // ignore fallback errors
  }

  return []
}

async function writeMcpServers(servers: StoredMcpServer[]): Promise<void> {
  await useMcpStorage().setItem(STORAGE_KEY, servers)
}

export async function findMcpServer(id: string): Promise<StoredMcpServer | undefined> {
  if (!id) return undefined
  const servers = await listMcpServers()
  return servers.find((server) => server?.id === id)
}

export async function removeMcpServer(id: string): Promise<void> {
  if (!id) return
  const servers = await listMcpServers()
  const next = servers.filter((server) => server?.id !== id)
  await writeMcpServers(next)
}

export async function setMcpServerStatus(
  id: string,
  status: 'ok' | 'error',
  timestamp: string = nowIso()
): Promise<void> {
  if (!id) return
  const servers = await listMcpServers()
  const index = servers.findIndex((server) => server?.id === id)
  if (index === -1) return
  const target = servers[index]
  servers[index] = { ...target, lastStatus: status, lastCheckedAt: timestamp, updatedAt: timestamp }
  await writeMcpServers(servers)
}

function slugify(value: unknown): string {
  if (!value) return ''
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
  return slug
}

function ensureUniqueId(candidate: string, servers: StoredMcpServer[]): string {
  let base = candidate || `mcp-${nanoid(6)}`
  if (!base) {
    base = `mcp-${nanoid(6)}`
  }
  let unique = base
  let counter = 1
  while (servers.some((server) => server?.id === unique)) {
    unique = `${base}-${counter}`
    counter += 1
  }
  return unique
}

function resolveProvider(input: unknown): McpProvider {
  if (typeof input === 'string' && VALID_PROVIDERS.includes(input as McpProvider)) {
    return input as McpProvider
  }
  return 'custom'
}

function resolveCategory(input: unknown, fallback: McpCategory): McpCategory {
  if (typeof input === 'string' && VALID_CATEGORIES.includes(input as McpCategory)) {
    return input as McpCategory
  }
  return fallback
}

function normalizeMetadata(
  metadata: unknown,
  existing?: Record<string, unknown>
): Record<string, unknown> {
  if (metadata === undefined) {
    return existing || {}
  }
  const result: Record<string, unknown> = {}
  const entries = Object.entries((metadata as Record<string, unknown>) ?? {})
  for (const [key, value] of entries) {
    if (!key) continue
    if (value === undefined || value === null || value === '') continue
    result[key] = value
  }
  return result
}

function normalizeAuth(
  auth: unknown,
  fallbackType: McpServer['auth']['type'],
  existing?: McpServer['auth']
): McpServer['auth'] {
  const allowedTypes: McpServer['auth']['type'][] = ['oauth2', 'apiKey', 'basic', 'bearer']
  const authInput = auth as Partial<McpServer['auth']> | undefined
  const typeCandidate = authInput?.type || existing?.type || fallbackType
  const type = allowedTypes.includes(typeCandidate as McpServer['auth']['type'])
    ? (typeCandidate as McpServer['auth']['type'])
    : fallbackType

  const next: McpServer['auth'] = { type }

  const mergeSource = authInput || existing || {}

  if (mergeSource.clientId && String(mergeSource.clientId).trim()) {
    next.clientId = String(mergeSource.clientId).trim()
  }
  if (mergeSource.clientSecret && String(mergeSource.clientSecret).trim()) {
    next.clientSecret = String(mergeSource.clientSecret).trim()
  }
  if (mergeSource.token && String(mergeSource.token).trim()) {
    next.token = String(mergeSource.token).trim()
  }
  if (mergeSource.apiKey && String(mergeSource.apiKey).trim()) {
    next.apiKey = String(mergeSource.apiKey).trim()
  }
  if (mergeSource.username && String(mergeSource.username).trim()) {
    next.username = String(mergeSource.username).trim()
  }
  if (mergeSource.password && String(mergeSource.password).trim()) {
    next.password = String(mergeSource.password).trim()
  }

  if (Array.isArray(mergeSource.scope)) {
    const scope = mergeSource.scope
      .map((item: unknown) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item: string) => item.length > 0)
    if (scope.length) {
      next.scope = scope
    }
  } else if (typeof mergeSource.scope === 'string') {
    const scope = mergeSource.scope
      .split(',')
      .map((item: string) => item.trim())
      .filter((item: string) => item.length > 0)
    if (scope.length) {
      next.scope = scope
    }
  }

  return next
}

function hydrateServer(
  payload: Partial<McpServer>,
  existing: StoredMcpServer | null,
  servers: StoredMcpServer[]
): StoredMcpServer {
  const provider = resolveProvider(payload.provider ?? existing?.provider)
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom
  const name =
    String(payload.name ?? existing?.name ?? preset.defaultName).trim() || preset.defaultName
  const inputId = String(payload.id ?? existing?.id ?? slugify(name)).trim()
  const id = existing?.id || ensureUniqueId(slugify(inputId), servers)
  const category = resolveCategory(
    payload.category ?? existing?.category ?? preset.category,
    preset.category
  )
  const urlCandidate = payload.url ?? existing?.url ?? preset.defaultUrl
  const url =
    typeof urlCandidate === 'string' && urlCandidate.trim().length > 0
      ? urlCandidate.trim()
      : undefined
  const descriptionCandidate =
    payload.description ?? existing?.description ?? preset.defaultDescription
  const description =
    typeof descriptionCandidate === 'string' && descriptionCandidate.trim().length > 0
      ? descriptionCandidate.trim()
      : preset.defaultDescription

  const auth = normalizeAuth(payload.auth, preset.defaultAuthType, existing?.auth)
  const metadata = normalizeMetadata(
    payload.metadata,
    existing?.metadata as Record<string, unknown> | undefined
  )

  const createdAt = existing?.createdAt ?? nowIso()
  const updatedAt = nowIso()
  const lastStatus = (payload.lastStatus ??
    existing?.lastStatus ??
    'unknown') as StoredMcpServer['lastStatus']
  const lastCheckedAt = (payload.lastCheckedAt ?? existing?.lastCheckedAt ?? null) as string | null

  return {
    id,
    name,
    provider,
    category,
    url,
    description,
    auth,
    metadata,
    lastStatus,
    lastCheckedAt,
    createdAt,
    updatedAt
  }
}

export async function createMcpServer(payload: Partial<McpServer>): Promise<StoredMcpServer> {
  if (!payload.name && !payload.provider && !payload.url) {
    throw createError({ statusCode: 400, statusMessage: 'Missing MCP server data' })
  }

  const servers = await listMcpServers()
  const server = hydrateServer(payload, null, servers)
  servers.push(server)
  await writeMcpServers(servers)
  return server
}

export async function updateMcpServer(
  id: string,
  payload: Partial<McpServer>
): Promise<StoredMcpServer> {
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing MCP server id' })
  }

  const servers = await listMcpServers()
  const index = servers.findIndex((server) => server?.id === id)
  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: 'MCP server not found' })
  }

  const updated = hydrateServer({ ...payload, id }, servers[index], servers)
  servers.splice(index, 1, updated)
  await writeMcpServers(servers)
  return updated
}

export function listMcpProviderPresets() {
  return Object.entries(PROVIDER_PRESETS).map(([id, preset]) => ({
    id: id as McpProvider,
    ...preset
  }))
}

export function getMcpProviderPreset(provider: McpProvider) {
  return PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom
}

// moved to server/types/mcp-storage.d.ts

export const MCP_SERVER_TEMPLATES: McpServerTemplate[] = [
  {
    id: 'nuxt-ui-docs',
    name: 'Nuxt UI Documentation',
    description:
      'Access Nuxt UI component documentation, examples, and guidance for Vue.js and Nuxt development.',
    provider: 'nuxt-ui',
    category: 'documentation',
    icon: 'i-lucide-code',
    color: 'primary',
    defaultConfig: {
      name: 'Nuxt UI Documentation',
      provider: 'nuxt-ui',
      category: 'documentation',
      url: 'https://ui.nuxt.com',
      description:
        'Access Nuxt UI component documentation, examples, and guidance for Vue.js and Nuxt development.',
      auth: {
        type: 'bearer',
        token: ''
      },
      metadata: {
        version: 'latest'
      }
    }
  },
  {
    id: 'google-calendar-template',
    name: 'Google Calendar',
    description: 'Sync upcoming events from Google Calendar using the official API.',
    provider: 'google-calendar',
    category: 'calendar',
    icon: 'i-lucide-calendar',
    color: 'blue',
    defaultConfig: {
      name: 'Google Calendar',
      provider: 'google-calendar',
      category: 'calendar',
      url: 'https://www.googleapis.com/calendar/v3',
      description: 'Sync upcoming events from Google Calendar using the official API.',
      auth: {
        type: 'oauth2',
        token: ''
      },
      metadata: {
        calendarId: 'primary'
      }
    }
  },
  {
    id: 'todoist-template',
    name: 'Todoist Tasks',
    description: 'List and manage tasks from Todoist.',
    provider: 'todoist',
    category: 'todo',
    icon: 'i-lucide-check-square',
    color: 'green',
    defaultConfig: {
      name: 'Todoist Tasks',
      provider: 'todoist',
      category: 'todo',
      url: 'https://api.todoist.com/rest/v2',
      description: 'List and manage tasks from Todoist.',
      auth: {
        type: 'bearer',
        token: ''
      }
    }
  },
  {
    id: 'builtin-kanban-template',
    name: 'Team Kanban Board',
    description:
      'Built-in Kanban board for task management. Agents can view and update team boards.',
    provider: 'builtin-kanban',
    category: 'productivity',
    icon: 'i-lucide-kanban',
    color: 'purple',
    defaultConfig: {
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
      }
    }
  },
  {
    id: 'builtin-calendar-template',
    name: 'Team Calendar',
    description:
      'Built-in team calendar for event management. Agents can view and manage calendar events.',
    provider: 'builtin-calendar',
    category: 'calendar',
    icon: 'i-lucide-calendar-days',
    color: 'blue',
    defaultConfig: {
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
      }
    }
  },
  {
    id: 'builtin-agents-template',
    name: 'Agents Directory',
    description:
      'Built-in overview of available agents, their specialties, and communication permissions.',
    provider: 'builtin-agents',
    category: 'directory',
    icon: 'i-lucide-users',
    color: 'amber',
    defaultConfig: {
      name: 'Agents Directory',
      provider: 'builtin-agents',
      category: 'directory',
      description:
        'Built-in directory of active agents, their capabilities, and delegation preferences.',
      auth: {
        type: 'bearer',
        token: 'builtin'
      },
      metadata: {
        builtin: true
      }
    }
  },
  {
    id: 'builtin-datasafe-template',
    name: 'Team Datasafe',
    description:
      'Built-in secure datasafe vault. Agents can organize documents, apply storage rules, and retrieve files.',
    provider: 'builtin-datasafe',
    category: 'storage',
    icon: 'i-lucide-archive',
    color: 'orange',
    defaultConfig: {
      name: 'Team Datasafe',
      provider: 'builtin-datasafe',
      category: 'storage',
      description:
        'Built-in datasafe vault for storing documents, organizing folders, and capturing attachments with team rules.',
      auth: {
        type: 'bearer',
        token: 'builtin'
      },
      metadata: {
        builtin: true
      }
    }
  },
  {
    id: 'custom-template',
    name: 'Custom MCP Server',
    description: 'Create a custom MCP server integration.',
    provider: 'custom',
    category: 'custom',
    icon: 'i-lucide-settings',
    color: 'gray',
    defaultConfig: {
      name: 'Custom MCP Server',
      provider: 'custom',
      category: 'custom',
      description: 'Custom Model Context Protocol server integration.',
      auth: {
        type: 'bearer',
        token: ''
      }
    }
  }
]

export function getMcpServerTemplates(): McpServerTemplate[] {
  return MCP_SERVER_TEMPLATES
}

export function getMcpServerTemplate(templateId: string): McpServerTemplate | undefined {
  return MCP_SERVER_TEMPLATES.find((template) => template.id === templateId)
}
