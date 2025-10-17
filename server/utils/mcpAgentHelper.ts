import { generateText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import agentConfig from '~~/agents.config'
import type { H3Event } from 'h3'

// Helper function to convert JSON Schema to Zod schema
function createZodSchemaFromJsonSchema(jsonSchema: any): z.ZodSchema {
  if (!jsonSchema || jsonSchema.type !== 'object') {
    return z.object({}).describe('No parameters required')
  }

  const properties = jsonSchema.properties || {}
  const required = jsonSchema.required || []

  const zodProperties: Record<string, z.ZodSchema> = {}

  for (const [key, prop] of Object.entries(properties)) {
    const propSchema = prop as any
    let zodProp: z.ZodSchema

    switch (propSchema.type) {
      case 'string':
        zodProp = z.string()
        break
      case 'number':
        zodProp = z.number()
        break
      case 'boolean':
        zodProp = z.boolean()
        break
      case 'array':
        zodProp = z.array(z.any())
        break
      case 'object':
        zodProp = z.object({})
        break
      default:
        zodProp = z.any()
    }

    if (propSchema.description) {
      zodProp = zodProp.describe(propSchema.description)
    }

    if (!required.includes(key)) {
      zodProp = zodProp.optional()
    }

    zodProperties[key] = zodProp
  }

  return z.object(zodProperties).describe(jsonSchema.description || '')
}

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
    teamId: _teamId,
    userId: _userId,
    systemPrompt,
    userPrompt,
    attachments,
    event,
    agentEmail: _agentEmail,
    currentMessageId: _currentMessageId,
    model,
    temperature,
    maxTokens
  } = options
  const _baseUrl = event ? getRequestURL(event).origin : 'http://localhost:3000'

  // Resolve model settings with safe defaults from agents.config
  const generalDefaults = (agentConfig as any)?.predefined?.general || {}
  const effectiveModel = model || generalDefaults.model || 'gpt-4o-mini'
  const effectiveTemperature = temperature ?? generalDefaults.temperature ?? 0.1
  const effectiveMaxTokens = maxTokens ?? generalDefaults.max_tokens ?? 8000

  console.log(`[MCPAgent] 🤖 Using model: ${effectiveModel} (temperature: ${effectiveTemperature})`)

  try {
    // Load MCP tools using direct HTTP calls and custom tool definitions
    const tools: Record<string, any> = {}

    console.log(
      `[MCPAgent] 🔧 Loading MCP tools from ${Object.keys(mcpConfigs).length} servers using direct HTTP calls`
    )

    for (const [serverName, config] of Object.entries(mcpConfigs)) {
      try {
        const serverUrl = config.url.startsWith('http') ? config.url : _baseUrl + config.url
        console.log(`[MCPAgent] 📡 Connecting to MCP server ${serverName}: ${serverUrl}`)

        // Get available tools from the MCP server
        const toolsResponse = await fetch(serverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'list-tools',
            method: 'tools/list',
            params: {}
          })
        })

        if (!toolsResponse.ok) {
          console.log(
            `[MCPAgent] ⚠️  Failed to list tools from ${serverName}:`,
            toolsResponse.status
          )
          continue
        }

        const toolsResult = await toolsResponse.json()
        const mcpTools = toolsResult.result?.tools || []
        console.log(
          `[MCPAgent] 🔧 Available MCP tools from ${serverName}:`,
          mcpTools.map((t: any) => t.name)
        )

        // Create AI SDK tools that call the MCP server
        for (const mcpTool of mcpTools) {
          const prefixedToolName = `${serverName}_${mcpTool.name}`

          // Create a custom tool that calls the MCP server
          const aiTool = tool({
            description: mcpTool.description || `Call ${mcpTool.name} on ${serverName}`,
            inputSchema: mcpTool.inputSchema
              ? createZodSchemaFromJsonSchema(mcpTool.inputSchema)
              : z.object({}).describe('No parameters required'),
            execute: async (args) => {
              console.log(`[MCPAgent] 🔧 Calling MCP tool ${prefixedToolName} with args:`, args)

              const response = await fetch(serverUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: 'Bearer test-token'
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: `call-${Date.now()}`,
                  method: 'tools/call',
                  params: {
                    name: mcpTool.name,
                    arguments: args
                  }
                })
              })

              if (response.ok) {
                const result = await response.json()
                console.log(`[MCPAgent] 🔧 MCP tool ${prefixedToolName} response:`, result.result)
                return result.result
              } else {
                const error = await response.text()
                console.log(`[MCPAgent] ❌ MCP tool ${prefixedToolName} error:`, error)
                throw new Error(`MCP tool failed: ${error}`)
              }
            }
          })

          tools[prefixedToolName] = aiTool
          console.log(`[MCPAgent] ✅ Created AI SDK tool ${prefixedToolName}`)
        }

        console.log(`[MCPAgent] ✅ Loaded ${mcpTools.length} tools from ${serverName}`)
      } catch (error) {
        console.log(`[MCPAgent] ⚠️  Error loading tools from ${serverName}:`, error)
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
        maxTokens: effectiveMaxTokens
        // No cleanup needed for direct HTTP calls
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
      usage: result.usage,
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

    // Log tool calls if any
    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log(`[MCPAgent] 📝 Tool calls (${result.toolCalls.length}):`)
      result.toolCalls.forEach((toolCall, index) => {
        console.log(`  Tool call ${index + 1}:`, {
          toolName: toolCall.toolName,
          args: toolCall.args,
          result: toolCall.result
        })
      })
    }

    // Log tool results if any
    if (result.toolResults && result.toolResults.length > 0) {
      console.log(`[MCPAgent] 📝 Tool results (${result.toolResults.length}):`)
      result.toolResults.forEach((toolResult, index) => {
        console.log(`  Tool result ${index + 1}:`, {
          toolCallId: toolResult.toolCallId,
          result: toolResult.result
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
  }
}
