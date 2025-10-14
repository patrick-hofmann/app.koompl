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
  agentEmail?: string
  currentMessageId?: string
}

/**
 * Runs an MCP agent with the provided configuration
 * @param options Configuration options for the MCP agent
 * @returns The final output from the agent
 */
export async function runMCPAgent(options: RunMCPAgentOptions): Promise<string> {
  const startTime = Date.now()
  const startTimestamp = new Date().toISOString()
  console.log(`[${startTimestamp}] [MCPAgent] ⏱️  Starting MCP agent execution`)

  const {
    mcpConfigs,
    teamId,
    userId,
    systemPrompt,
    userPrompt,
    attachments,
    event,
    agentEmail,
    currentMessageId
  } = options
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
    if (agentEmail) {
      headers['x-agent-email'] = agentEmail
    }
    if (currentMessageId) {
      headers['x-current-message-id'] = currentMessageId
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
  const connectStart = Date.now()
  for (const server of mcpServers) {
    await server.connect()
  }
  const connectDuration = Date.now() - connectStart
  console.log(
    `[MCPAgent] ⏱️  Connected to ${mcpServers.length} MCP servers in ${connectDuration}ms`
  )

  const model = 'gpt-4o-mini' // Fast, cost-effective model for agent tasks
  const temperature = 0.3 // Lower temperature for more deterministic responses

  console.log(`[MCPAgent] 🤖 Using model: ${model} (temperature: ${temperature})`)

  // Create an agent that uses these MCP servers
  const agent = new Agent({
    model,
    modelSettings: {
      temperature,
      maxTokens: 16000 // Increased to handle large attachments in function calls
    },
    name: 'MCP Assistant',
    instructions: systemPrompt,
    mcpServers
  })

  const setupDuration = Date.now() - startTime
  const setupEndTimestamp = new Date().toISOString()
  console.log(`[${setupEndTimestamp}] [MCPAgent] ⏱️  Setup completed in ${setupDuration}ms`)
  console.log(`[MCPAgent] Agent config:`, {
    model,
    mcpServerCount: mcpServers.length,
    serverNames: mcpServers.map((s) => s['name']),
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    hasAttachments: !!attachments && attachments.length > 0
  })

  // Log the actual prompts (truncated for readability)
  console.log(`[MCPAgent] 📝 System Prompt (${systemPrompt.length} chars):`)
  console.log(systemPrompt.substring(0, 500) + (systemPrompt.length > 500 ? '...' : ''))
  console.log(`[MCPAgent] 📝 User Prompt (${userPrompt.length} chars):`)
  console.log(userPrompt.substring(0, 500) + (userPrompt.length > 500 ? '...' : ''))

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

    const beforeRun = Date.now()
    const beforeRunTimestamp = new Date().toISOString()
    console.log(`[${beforeRunTimestamp}] [MCPAgent] 🚀 Running OpenAI agent...`)
    console.log(`[MCPAgent] Final prompt length: ${finalPrompt.length} chars`)

    // Log tool count that agent has access to
    console.log(`[MCPAgent] Agent has access to MCP tools from ${mcpServers.length} servers`)

    const result = await run(agent, finalPrompt)

    const afterRun = Date.now()
    const afterRunTimestamp = new Date().toISOString()
    console.log(
      `[${afterRunTimestamp}] [MCPAgent] ⏱️  Agent run completed in ${afterRun - beforeRun}ms`
    )
    console.log(`[MCPAgent] Result output length: ${result.finalOutput?.length || 0} chars`)

    const totalDuration = Date.now() - startTime
    const endTimestamp = new Date().toISOString()
    console.log(`[${endTimestamp}] [MCPAgent] ⏱️  Total execution time: ${totalDuration}ms`)

    // Performance breakdown
    console.log(`[MCPAgent] 📊 Performance breakdown:`)
    console.log(`  - Setup: ${setupDuration}ms`)
    console.log(`  - Agent execution: ${afterRun - beforeRun}ms`)
    console.log(`  - Total: ${totalDuration}ms`)

    return result.finalOutput
  } finally {
    // Always cleanup: close all MCP servers
    const cleanupStart = Date.now()
    for (const server of mcpServers) {
      await server.close()
    }
    const cleanupDuration = Date.now() - cleanupStart
    console.log(`[MCPAgent] ⏱️  Cleanup completed in ${cleanupDuration}ms`)
  }
}
