import { generateText, experimental_createMCPClient, stepCountIs } from 'ai'
import { openai } from '@ai-sdk/openai'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp'
import agentConfig from '~~/agents.config'
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
  // Optional model overrides
  model?: string
  temperature?: number
  maxTokens?: number
  maxSteps?: number
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
  // TODO: Implement actual streaming when Vercel AI SDK supports it
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
 * Runs an MCP agent with the provided configuration using Vercel AI SDK
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
    currentMessageId,
    model,
    temperature,
    maxTokens,
    maxSteps
  } = options
  const baseUrl = event ? getRequestURL(event).origin : 'http://localhost:3000'

  // Resolve model settings with safe defaults from agents.config
  const generalDefaults = (agentConfig as any)?.predefined?.general || {}
  const effectiveModel = model || generalDefaults.model || 'gpt-4o-mini'
  const effectiveTemperature = temperature ?? generalDefaults.temperature ?? 0.1
  const effectiveMaxTokens = maxTokens ?? generalDefaults.max_tokens ?? 8000
  const effectiveMaxSteps = maxSteps ?? generalDefaults.max_steps ?? 5

  console.log(`[MCPAgent] 🤖 Using model: ${effectiveModel} (temperature: ${effectiveTemperature})`)

  // Create MCP clients for each server
  const mcpClients: any[] = []
  const tools: Record<string, any> = {}

  try {
    // Initialize MCP clients for each server
    for (const [serverName, config] of Object.entries(mcpConfigs)) {
      try {
        const serverUrl = config.url.startsWith('http') ? config.url : baseUrl + config.url

        // Create custom headers for authentication
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

        // Create HTTP transport with custom headers
        const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
          headers
        })

        // Create MCP client
        const client = await experimental_createMCPClient({
          transport
        })

        mcpClients.push(client)

        // Get tools from this MCP server
        const serverTools = await client.tools()

        // Merge tools with server name prefix to avoid conflicts
        for (const [toolName, toolDef] of Object.entries(serverTools)) {
          const prefixedToolName = `${serverName}_${toolName}`
          tools[prefixedToolName] = toolDef
        }

        console.log(
          `[MCPAgent] ✅ Connected to ${serverName}: ${Object.keys(serverTools).length} tools`
        )
      } catch (error) {
        console.log(`[MCPAgent] ⚠️  Failed to connect to ${serverName}:`, error)
      }
    }

    const setupDuration = Date.now() - startTime
    const setupEndTimestamp = new Date().toISOString()
    console.log(`[${setupEndTimestamp}] [MCPAgent] ⏱️  Setup completed in ${setupDuration}ms`)
    console.log(`[MCPAgent] Agent config:`, {
      model: effectiveModel,
      mcpServerCount: Object.keys(mcpConfigs).length,
      serverNames: Object.keys(mcpConfigs),
      toolCount: Object.keys(tools).length,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      hasAttachments: !!attachments && attachments.length > 0
    })

    // Log the actual prompts (truncated for readability)
    console.log(`[MCPAgent] 📝 System Prompt (${systemPrompt.length} chars):`)
    console.log(systemPrompt.substring(0, 500) + (systemPrompt.length > 500 ? '...' : ''))
    console.log(`[MCPAgent] 📝 User Prompt (${userPrompt.length} chars):`)
    console.log(userPrompt.substring(0, 500) + (userPrompt.length > 500 ? '...' : ''))

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
    console.log(`[${beforeRunTimestamp}] [MCPAgent] 🚀 Running Vercel AI SDK agent...`)
    console.log(`[MCPAgent] Final prompt length: ${finalPrompt.length} chars`)

    // Log tool count that agent has access to
    console.log(`[MCPAgent] Agent has access to ${Object.keys(tools).length} MCP tools`)

    // Add timeout to prevent hanging - reduced for faster feedback
    const AGENT_TIMEOUT = 45000 // 45 seconds to allow tool completion and cleanup
    const result = (await Promise.race([
      generateText({
        model: openai(effectiveModel),
        system:
          systemPrompt +
          '\n\nIMPORTANT: You have access to all necessary tools. Use them directly when needed.',
        prompt: finalPrompt,
        tools,
        temperature: effectiveTemperature,
        maxTokens: effectiveMaxTokens,
        stopWhen: stepCountIs(effectiveMaxSteps)
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Agent execution timeout')), AGENT_TIMEOUT)
      )
    ])) as Awaited<ReturnType<typeof generateText>>

    const afterRun = Date.now()
    const afterRunTimestamp = new Date().toISOString()
    console.log(
      `[${afterRunTimestamp}] [MCPAgent] ⏱️  Agent run completed in ${afterRun - beforeRun}ms`
    )
    console.log(`[MCPAgent] Result output length: ${result.text?.length || 0} chars`)

    // Log the full result for debugging
    console.log(`[MCPAgent] 📋 Full result:`, {
      text: result.text,
      finishReason: result.finishReason,
      usage: result.usage
    })

    // Log tool calls if any
    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log(`[MCPAgent] 📝 Tool calls (${result.toolCalls.length}):`)
      result.toolCalls.forEach((toolCall, index) => {
        console.log(`  Tool call ${index + 1}:`, {
          toolName: toolCall.toolName,
          args: toolCall.args
        })
      })
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

    return result.text
  } catch (error) {
    console.error(`[MCPAgent] ❌ Error during agent execution:`, error)
    throw error
  } finally {
    // Always cleanup: close all MCP clients
    const cleanupStart = Date.now()
    await Promise.all(
      mcpClients.map(async (client) => {
        try {
          await client.close()
        } catch (error) {
          console.log(`[MCPAgent] ⚠️  Error closing MCP client:`, error)
        }
      })
    )
    const cleanupDuration = Date.now() - cleanupStart
    console.log(`[MCPAgent] ⏱️  Cleanup completed in ${cleanupDuration}ms`)
  }
}
