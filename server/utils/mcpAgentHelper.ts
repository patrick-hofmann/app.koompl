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

// Simple in-memory cache for tool lists to reduce repeated calls
// const toolListCache = new Map<string, { tools: any[], timestamp: number }>()
// const CACHE_TTL = 30000 // 30 seconds cache

/**
 * Runs an MCP agent with streaming support for faster user feedback
 * @param options Configuration options for the MCP agent
 * @param onProgress Optional callback for progress updates
 * @returns The final output from the agent
 */
export async function runMCPAgentStreaming(
  options: RunMCPAgentOptions,
  onProgress?: (update: {
    type: 'acknowledgment' | 'progress' | 'completion'
    message: string
  }) => void
): Promise<string> {
  // For now, just call the regular function
  // TODO: Implement actual streaming when OpenAI Agents SDK supports it
  if (onProgress) {
    onProgress({ type: 'acknowledgment', message: 'Processing your request...' })
  }

  const result = await runMCPAgent(options)

  if (onProgress) {
    onProgress({ type: 'completion', message: 'Request completed successfully' })
  }

  return result
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
  const temperature = 0.1 // Lower temperature for more deterministic, faster responses

  console.log(`[MCPAgent] 🤖 Using model: ${model} (temperature: ${temperature})`)

  // Create an agent that uses these MCP servers
  const agent = new Agent({
    model,
    modelSettings: {
      temperature,
      maxTokens: 8000, // Reduced for faster processing
      maxSteps: 5 // Reduced to prevent overthinking and speed up execution
    },
    name: 'MCP Assistant',
    instructions:
      systemPrompt +
      '\n\nIMPORTANT: You have access to all necessary tools. Use them directly when needed.',
    mcpServers,
    // Filter out tools that can cause context window overflow
    toolFilter: (tools) => {
      return tools.filter((tool) => {
        // Prevent download_file tool to avoid context window overflow
        if (tool.name === 'download_file') {
          console.log(`[MCPAgent] 🚫 Filtered out tool: ${tool.name} (prevents context overflow)`)
          return false
        }
        return true
      })
    }
  })

  // Add event listeners for tool calls to log results
  agent.on('toolCall', (toolCall) => {
    console.log(`[MCPAgent] 🔧 Tool called: ${toolCall.toolName}`, {
      args: toolCall.args,
      callId: toolCall.callId
    })
  })

  agent.on('toolResult', (toolResult) => {
    console.log(`[MCPAgent] ✅ Tool result: ${toolResult.toolName}`, {
      callId: toolResult.callId,
      success: toolResult.success,
      result: toolResult.result
        ? JSON.stringify(toolResult.result).substring(0, 200) + '...'
        : null,
      error: toolResult.error
    })
  })

  // Add performance monitoring
  const toolCallTimes = new Map<string, number>()
  agent.on('toolCall', (toolCall) => {
    toolCallTimes.set(toolCall.callId, Date.now())
  })

  agent.on('toolResult', (toolResult) => {
    const startTime = toolCallTimes.get(toolResult.callId)
    if (startTime) {
      const duration = Date.now() - startTime
      console.log(`[MCPAgent] ⏱️  Tool '${toolResult.toolName}' took ${duration}ms`)
      toolCallTimes.delete(toolResult.callId)
    }
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

    // Add timeout to prevent hanging - reduced for faster feedback
    const AGENT_TIMEOUT = 45000 // 45 seconds to allow tool completion and cleanup
    const result = (await Promise.race([
      run(agent, finalPrompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Agent execution timeout')), AGENT_TIMEOUT)
      )
    ])) as Awaited<ReturnType<typeof run>>

    const afterRun = Date.now()
    const afterRunTimestamp = new Date().toISOString()
    console.log(
      `[${afterRunTimestamp}] [MCPAgent] ⏱️  Agent run completed in ${afterRun - beforeRun}ms`
    )
    console.log(`[MCPAgent] Result output length: ${result.finalOutput?.length || 0} chars`)

    // Log the full result for debugging
    console.log(`[MCPAgent] 📋 Full result:`, {
      finalOutput: result.finalOutput,
      steps: result.steps?.length || 0,
      hasError: !!result.error,
      error: result.error
    })

    // Log each step for debugging
    if (result.steps && result.steps.length > 0) {
      console.log(`[MCPAgent] 📝 Execution steps (${result.steps.length}):`)
      result.steps.forEach((step, index) => {
        console.log(`  Step ${index + 1}:`, {
          type: step.type,
          content:
            step.content?.substring(0, 100) +
            (step.content && step.content.length > 100 ? '...' : ''),
          toolCalls: step.toolCalls?.length || 0
        })
      })
    }

    // Log potential issues
    if (
      result.finalOutput &&
      result.finalOutput.includes('image') &&
      result.finalOutput.includes('Tobi')
    ) {
      console.log(
        `[MCPAgent] ⚠️  Agent mentioned sending an image but may not have access to files. Consider checking datasafe for available files.`
      )
    }

    // Log performance summary
    const totalToolCalls = toolCallTimes.size
    if (totalToolCalls > 0) {
      console.log(
        `[MCPAgent] ⚠️  ${totalToolCalls} tool calls still pending - possible timeout or error`
      )
    }

    const totalDuration = Date.now() - startTime
    const endTimestamp = new Date().toISOString()
    console.log(`[${endTimestamp}] [MCPAgent] ⏱️  Total execution time: ${totalDuration}ms`)

    // Performance breakdown
    console.log(`[MCPAgent] 📊 Performance breakdown:`)
    console.log(`  - Setup: ${setupDuration}ms`)
    console.log(`  - Agent execution: ${afterRun - beforeRun}ms`)
    console.log(`  - Total: ${totalDuration}ms`)

    // Performance analysis with updated thresholds
    if (totalDuration > 15000) {
      console.log(
        `[MCPAgent] ⚠️  SLOW EXECUTION: ${totalDuration}ms - consider optimizing agent instructions or reducing tool complexity`
      )
    } else if (totalDuration > 8000) {
      console.log(
        `[MCPAgent] ⚡ MODERATE EXECUTION: ${totalDuration}ms - acceptable but could be faster`
      )
    } else if (totalDuration > 3000) {
      console.log(`[MCPAgent] 🚀 GOOD EXECUTION: ${totalDuration}ms - good performance`)
    } else {
      console.log(`[MCPAgent] ⚡ EXCELLENT EXECUTION: ${totalDuration}ms - excellent performance`)
    }

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
