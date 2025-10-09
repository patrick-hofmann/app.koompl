import { Agent, run, MCPServerStreamableHttp } from '@openai/agents'
import type { H3Event } from 'h3'

interface MCPConfig {
  url: string
}

interface FileAttachment {
  type: 'image' | 'file'
  url?: string
  base64?: string
  mimeType?: string
}

interface RunMCPAgentOptions {
  mcpConfigs: Record<string, MCPConfig>
  teamId: string
  userId?: string
  systemPrompt: string
  userPrompt: string
  attachments?: FileAttachment[]
  event?: H3Event
}

/**
 * Runs an MCP agent with the provided configuration
 * @param options Configuration options for the MCP agent
 * @returns The final output from the agent
 */
export async function runMCPAgent(options: RunMCPAgentOptions): Promise<string> {
  const { mcpConfigs, teamId, userId, systemPrompt, userPrompt, attachments, event } = options
  const baseUrl = event ? getRequestURL(event).origin : 'http://localhost:3000'

  // Create a custom fetch function for same-origin requests
  let localFetch:
    | undefined
    | ((
        path: string,
        init?: {
          method?: string
          headers?: Record<string, string>
          body?: any
          signal?: AbortSignal
        }
      ) => Promise<Response>)

  // Try to get Nitro's localFetch at runtime (Nuxt server alias)
  try {
    const nitro = await import('#internal/nitro')
    const app = nitro.useNitroApp ? nitro.useNitroApp() : nitro.default?.useNitroApp?.()
    localFetch = app?.localFetch
  } catch {
    // ignore; we'll fall back to global fetch
  }

  // WHATWG-compatible fetch that forwards cookies and uses localFetch when available
  const sameOriginFetch: typeof fetch = async (input, init) => {
    const href = typeof input === 'string' || input instanceof URL ? input.toString() : input.url
    const origin = event ? getRequestURL(event).origin : baseUrl
    const u = new URL(href, origin)

    // Flatten headers
    const headersObj = init?.headers
      ? Object.fromEntries(new Headers(init.headers as HeadersInit).entries())
      : {}

    // Forward cookie from event if available
    if (event) {
      const cookie = getRequestHeader(event, 'cookie')
      if (cookie) (headersObj as any).cookie = cookie
    }

    if (localFetch) {
      // Zero-hop, in-process call; returns a native Response
      console.log('localFetch', `${u.pathname}${u.search}`)
      return localFetch(`${u.pathname}${u.search}`, {
        method: init?.method,
        headers: headersObj,
        body: init?.body as any,
        signal: init?.signal as any
      })
    }

    // Fallback: regular HTTP (native fetch)
    console.log('fallback globalThis.fetch', u.toString())
    return globalThis.fetch(u.toString(), {
      ...init,
      headers: headersObj
    })
  }

  // Build MCP server clients with custom fetch
  const mcpServers = Object.entries(mcpConfigs).map(([name, config]) => {
    const headers: Record<string, string> = {
      'x-team-id': teamId
    }
    if (userId) {
      headers['x-user-id'] = userId
    }

    return new MCPServerStreamableHttp({
      name,
      url: config.url.startsWith('http') ? config.url : baseUrl + config.url,
      fetch: config.url.startsWith('http') ? undefined : sameOriginFetch,
      requestInit: {
        headers
      }
    })
  })

  // Connect all servers
  for (const server of mcpServers) {
    await server.connect()
  }

  // Create an agent that uses these MCP servers
  const agent = new Agent({
    model: 'gpt-4o',
    modelSettings: {
      temperature: 0.3,
      maxTokens: 16000 // Increased to handle large attachments in function calls
    },
    name: 'MCP Assistant',
    instructions: systemPrompt,
    mcpServers
  })

  try {
    let finalPrompt = userPrompt

    // If attachments are provided, include them in the prompt text
    if (attachments && attachments.length > 0) {
      finalPrompt += '\n\n--- Attachments ---\n'
      attachments.forEach((att, idx) => {
        finalPrompt += `\nAttachment ${idx + 1}:\n`
        finalPrompt += `- Type: ${att.type}\n`
        finalPrompt += `- MIME Type: ${att.mimeType || 'unknown'}\n`
        if (att.url) {
          finalPrompt += `- URL: ${att.url}\n`
        }
        if (att.base64) {
          finalPrompt += `- Base64 Data: ${att.base64}\n`
        }
      })
      finalPrompt +=
        '\n(Use the base64 data above with the appropriate MCP tools to store or process these files)'
    }

    const result = await run(agent, finalPrompt)
    return result.finalOutput
  } finally {
    // Always cleanup: close all MCP servers
    for (const server of mcpServers) {
      await server.close()
    }
  }
}
