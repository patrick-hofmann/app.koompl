import { createError } from 'h3'
import type { StoredMcpServer } from '../types/mcp-storage'
import { getMcpProviderPreset, setMcpServerStatus } from './mcpStorage'
import { agentLogger } from './agentLogging'

import type { McpEmailContext, McpContextResult } from '../types/mcp-clients'
import { fetchKanbanContext, type KanbanMcpContext } from './mcpKanban'
import { fetchCalendarContext, type CalendarMcpContext } from './mcpCalendar'

const DEFAULT_LIMIT = 5

function normalizeLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) return DEFAULT_LIMIT
  return Math.min(Math.max(1, Math.floor(limit)), 20)
}

function joinUrl(baseUrl: string | undefined, path: string): string {
  const base = (baseUrl ?? '').trim()
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

function ensureToken(server: StoredMcpServer): string {
  const token = server.auth.token || server.auth.apiKey
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: `Missing token for server ${server.name}` })
  }
  return token
}

async function fetchGoogleCalendarContext(
  server: StoredMcpServer,
  limit: number
): Promise<McpContextResult | null> {
  const token = ensureToken(server)
  const preset = getMcpProviderPreset(server.provider)
  const calendarId =
    typeof server.metadata?.calendarId === 'string' && server.metadata.calendarId.trim().length > 0
      ? String(server.metadata.calendarId).trim()
      : 'primary'
  const baseUrl = server.url || preset.defaultUrl || 'https://www.googleapis.com/calendar/v3'
  const url = joinUrl(baseUrl, `/calendars/${encodeURIComponent(calendarId)}/events`)
  const timeMin = new Date().toISOString()

  const response = await $fetch<{ items?: Array<Record<string, any>> }>(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    },
    query: {
      maxResults: limit,
      orderBy: 'startTime',
      singleEvents: true,
      timeMin
    }
  })

  const events = Array.isArray(response?.items) ? response.items.slice(0, limit) : []
  if (!events.length) {
    return {
      serverId: server.id,
      serverName: server.name,
      provider: server.provider,
      category: server.category,
      summary: 'Keine anstehenden Termine gefunden.',
      details: events
    }
  }

  const summary = events
    .map((event) => {
      const title = event.summary || event?.title || 'Ohne Titel'
      const start = event.start?.dateTime || event.start?.date || event.start
      const end = event.end?.dateTime || event.end?.date || event.end
      return `• ${title} (${start ?? 'ohne Start'} – ${end ?? 'ohne Ende'})`
    })
    .join('\n')

  return {
    serverId: server.id,
    serverName: server.name,
    provider: server.provider,
    category: server.category,
    summary: `Anstehende Termine:\n${summary}`,
    details: events
  }
}

async function fetchMicrosoftCalendarContext(
  server: StoredMcpServer,
  limit: number
): Promise<McpContextResult | null> {
  const token = ensureToken(server)
  const baseUrl = server.url || 'https://graph.microsoft.com/v1.0'
  const url = joinUrl(baseUrl, '/me/events')

  const response = await $fetch<{ value?: Array<Record<string, any>> }>(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.timezone="UTC"'
    },
    query: {
      $select: 'subject,start,end,organizer,webLink',
      $orderby: 'start/dateTime ASC',
      $top: limit
    }
  })

  const events = Array.isArray(response?.value) ? response?.value.slice(0, limit) : []
  if (!events.length) {
    return {
      serverId: server.id,
      serverName: server.name,
      provider: server.provider,
      category: server.category,
      summary: 'Keine Outlook Termine gefunden.',
      details: events
    }
  }

  const summary = events
    .map((event) => {
      const subject = event.subject || 'Ohne Betreff'
      const start = event.start?.dateTime || event.start
      const end = event.end?.dateTime || event.end
      return `• ${subject} (${start ?? 'ohne Start'} – ${end ?? 'ohne Ende'})`
    })
    .join('\n')

  return {
    serverId: server.id,
    serverName: server.name,
    provider: server.provider,
    category: server.category,
    summary: `Outlook Termine:\n${summary}`,
    details: events
  }
}

async function fetchTodoistContext(
  server: StoredMcpServer,
  limit: number
): Promise<McpContextResult | null> {
  const token = ensureToken(server)
  const baseUrl = server.url || 'https://api.todoist.com/rest/v2'
  const url = joinUrl(baseUrl, '/tasks')

  const response = await $fetch<Array<Record<string, any>>>(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const tasks = Array.isArray(response) ? response.slice(0, limit) : []
  if (!tasks.length) {
    return {
      serverId: server.id,
      serverName: server.name,
      provider: server.provider,
      category: server.category,
      summary: 'Keine offenen Todoist Aufgaben gefunden.',
      details: tasks
    }
  }

  const summary = tasks
    .map((task) => {
      const content = task.content || 'Aufgabe ohne Beschreibung'
      const due = task.due?.date || task.due?.datetime || 'kein Fälligkeitsdatum'
      return `• ${content} (fällig: ${due})`
    })
    .join('\n')

  return {
    serverId: server.id,
    serverName: server.name,
    provider: server.provider,
    category: server.category,
    summary: `Todoist Aufgaben:\n${summary}`,
    details: tasks
  }
}

async function fetchTrelloContext(
  server: StoredMcpServer,
  limit: number
): Promise<McpContextResult | null> {
  const apiKey = server.auth.apiKey
  const token = server.auth.token
  if (!apiKey || !token) {
    throw createError({
      statusCode: 400,
      statusMessage: `Trello benötigt apiKey und token für ${server.name}`
    })
  }

  const boardId =
    typeof server.metadata?.boardId === 'string' && server.metadata.boardId.trim().length > 0
      ? String(server.metadata.boardId).trim()
      : null

  if (!boardId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Trello boardId fehlt in der MCP Konfiguration.'
    })
  }

  const baseUrl = server.url || 'https://api.trello.com/1'
  const url = joinUrl(baseUrl, `/boards/${encodeURIComponent(boardId)}/cards`)

  const cards = await $fetch<Array<Record<string, any>>>(url, {
    method: 'GET',
    query: {
      key: apiKey,
      token,
      fields: 'name,due,url'
    }
  })

  const upcoming = Array.isArray(cards)
    ? cards
        .filter((card) => card.due)
        .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
        .slice(0, limit)
    : []

  if (!upcoming.length) {
    return {
      serverId: server.id,
      serverName: server.name,
      provider: server.provider,
      category: server.category,
      summary: 'Keine Trello Karten mit Fälligkeitsdatum gefunden.',
      details: cards
    }
  }

  const summary = upcoming
    .map((card) => `• ${card.name || 'Karte ohne Titel'} (fällig: ${card.due || 'unbekannt'})`)
    .join('\n')

  return {
    serverId: server.id,
    serverName: server.name,
    provider: server.provider,
    category: server.category,
    summary: `Trello Karten:\n${summary}`,
    details: upcoming
  }
}

async function fetchNuxtUIContext(
  server: StoredMcpServer,
  email: McpEmailContext,
  _limit: number
): Promise<McpContextResult | null> {
  const baseUrl = server.url || 'https://ui.nuxt.com'

  // For Nuxt UI, we'll simulate a context by providing documentation links
  // In a real implementation, this would connect to the actual Nuxt UI MCP server
  const searchTerms = extractSearchTerms(email.text)

  const summary =
    searchTerms.length > 0
      ? `Nuxt UI Documentation für: ${searchTerms.join(', ')}. Verfügbare Komponenten und Beispiele unter ${baseUrl}`
      : `Nuxt UI Documentation verfügbar unter ${baseUrl}. Bietet Komponenten, Beispiele und Anleitungen für Vue.js und Nuxt.`

  return {
    serverId: server.id,
    serverName: server.name,
    provider: server.provider,
    category: server.category,
    summary,
    details: {
      baseUrl,
      searchTerms,
      availableComponents: [
        'UButton',
        'UCard',
        'UInput',
        'UModal',
        'UForm',
        'UAlert',
        'UBadge',
        'USkeleton'
      ],
      documentationSections: ['Getting Started', 'Components', 'Theming', 'Icons', 'Pro']
    }
  }
}

async function fetchCustomContext(
  server: StoredMcpServer,
  email: McpEmailContext,
  limit: number
): Promise<McpContextResult | null> {
  if (!server.url) {
    throw createError({
      statusCode: 400,
      statusMessage: `Custom MCP Server ${server.name} benötigt eine URL.`
    })
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (server.auth.type === 'bearer' && server.auth.token) {
    headers.Authorization = `Bearer ${server.auth.token}`
  } else if (server.auth.type === 'apiKey' && server.auth.apiKey) {
    headers['X-API-Key'] = server.auth.apiKey
  } else if (server.auth.type === 'basic' && server.auth.username && server.auth.password) {
    const credentials = Buffer.from(`${server.auth.username}:${server.auth.password}`).toString(
      'base64'
    )
    headers.Authorization = `Basic ${credentials}`
  }

  const response = await $fetch<{ summary?: string; details?: unknown }>(server.url, {
    method: 'POST',
    headers,
    body: {
      email,
      limit
    }
  }).catch((error) => {
    throw createError({ statusCode: 400, statusMessage: `Custom MCP Fehler: ${String(error)}` })
  })

  return {
    serverId: server.id,
    serverName: server.name,
    provider: server.provider,
    category: server.category,
    summary: response?.summary || 'Keine Zusammenfassung vom Custom MCP erhalten.',
    details: response?.details
  }
}

function extractSearchTerms(text: string): string[] {
  const commonTerms = [
    'button',
    'card',
    'input',
    'modal',
    'form',
    'alert',
    'badge',
    'skeleton',
    'component',
    'ui',
    'nuxt'
  ]
  const words = text.toLowerCase().split(/\s+/)
  return commonTerms.filter((term) => words.some((word) => word.includes(term)))
}

export async function fetchMcpContext(
  server: StoredMcpServer,
  email: McpEmailContext,
  options: {
    limit?: number
    agentId?: string
    agentEmail?: string
    teamId?: string
    userId?: string
  } = {}
): Promise<McpContextResult | null> {
  const limit = normalizeLimit(options.limit)
  const startTime = Date.now()

  try {
    let result: McpContextResult | null = null
    switch (server.provider) {
      case 'google-calendar':
        result = await fetchGoogleCalendarContext(server, limit)
        break
      case 'microsoft-outlook':
        result = await fetchMicrosoftCalendarContext(server, limit)
        break
      case 'todoist':
        result = await fetchTodoistContext(server, limit)
        break
      case 'trello':
        result = await fetchTrelloContext(server, limit)
        break
      case 'nuxt-ui':
        result = await fetchNuxtUIContext(server, email, limit)
        break
      case 'builtin-kanban':
        // Built-in Kanban board - requires team context
        if (options.teamId && options.userId) {
          const kanbanContext: KanbanMcpContext = {
            teamId: options.teamId,
            userId: options.userId,
            agentId: options.agentId
          }
          result = await fetchKanbanContext(kanbanContext, limit)
        } else {
          result = {
            serverId: server.id,
            serverName: server.name,
            provider: server.provider,
            category: server.category,
            summary: 'Kanban board requires team context',
            details: null
          }
        }
        break
      case 'builtin-calendar':
        // Built-in Calendar - requires team context
        if (options.teamId && options.userId) {
          const calendarContext: CalendarMcpContext = {
            teamId: options.teamId,
            userId: options.userId,
            agentId: options.agentId
          }
          result = await fetchCalendarContext(calendarContext, limit)
        } else {
          result = {
            serverId: server.id,
            serverName: server.name,
            provider: server.provider,
            category: server.category,
            summary: 'Calendar requires team context',
            details: null
          }
        }
        break
      default:
        result = await fetchCustomContext(server, email, limit)
    }

    await setMcpServerStatus(server.id, 'ok')

    // Log MCP usage if agent information is provided
    if (options.agentId && options.agentEmail) {
      try {
        await agentLogger.logMcpUsage({
          agentId: options.agentId,
          agentEmail: options.agentEmail,
          serverId: server.id,
          serverName: server.name,
          provider: server.provider,
          category: server.category,
          input: {
            query: email.text || email.subject || 'No query provided',
            context: {
              subject: email.subject,
              from: email.from,
              receivedAt: email.receivedAt
            },
            parameters: { limit }
          },
          output: {
            result: result,
            success: true
          },
          metadata: {
            responseTime: Date.now() - startTime,
            contextCount: result?.details ? 1 : 0
          }
        })
      } catch (logError) {
        console.error('Failed to log MCP usage:', logError)
      }
    }

    return result
  } catch (error) {
    await setMcpServerStatus(server.id, 'error')
    console.error('MCP server error', server.id, error)

    // Log failed MCP usage if agent information is provided
    if (options.agentId && options.agentEmail) {
      try {
        await agentLogger.logMcpUsage({
          agentId: options.agentId,
          agentEmail: options.agentEmail,
          serverId: server.id,
          serverName: server.name,
          provider: server.provider,
          category: server.category,
          input: {
            query: email.text || email.subject || 'No query provided',
            context: {
              subject: email.subject,
              from: email.from,
              receivedAt: email.receivedAt
            },
            parameters: { limit }
          },
          output: {
            result: null,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          },
          metadata: {
            responseTime: Date.now() - startTime,
            contextCount: 0
          }
        })
      } catch (logError) {
        console.error('Failed to log MCP usage error:', logError)
      }
    }

    return null
  }
}

export async function testMcpConnection(
  server: StoredMcpServer
): Promise<{ ok: boolean; summary?: string; error?: string }> {
  try {
    const context = await fetchMcpContext(
      server,
      {
        subject: 'Konfigurationstest',
        text: 'Dies ist ein Testaufruf des MCP Servers.',
        from: null,
        receivedAt: new Date().toISOString()
      },
      { limit: 3 }
    )

    if (!context) {
      return { ok: false, error: 'Keine Daten vom MCP Server erhalten.' }
    }

    return { ok: true, summary: context.summary }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
