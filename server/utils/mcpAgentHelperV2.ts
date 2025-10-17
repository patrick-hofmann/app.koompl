/**
 * MCP Agent Helper V2 - Using mcp-use framework
 *
 * This replaces the Vercel AI SDK with mcp-use for better MCP integration
 * and uses Nitro storage for task management.
 */

import { MCPAgentService } from '../services/mcpAgentService'
import type { H3Event } from 'h3'

interface FileAttachment {
  type: 'image' | 'file'
  url?: string
  base64?: string
  mimeType?: string
}

interface RunMCPAgentOptions {
  mcpConfigs: Record<string, { url: string }>
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

/**
 * Runs an MCP agent using the mcp-use framework with Nitro storage
 * @param options Configuration options for the MCP agent
 * @param onProgress Optional callback for progress updates
 * @returns The final output from the agent
 */
export async function runMCPAgentStreamingV2(
  options: RunMCPAgentOptions,
  onProgress?: (update: {
    type: 'acknowledgment' | 'progress' | 'completion'
    message: string
  }) => void
): Promise<string> {
  const startTime = Date.now()
  const startTimestamp = new Date().toISOString()
  console.log(`[${startTimestamp}] [MCPAgentV2] ⏱️  Starting MCP agent execution with mcp-use`)

  const { userPrompt, attachments, agentEmail, currentMessageId } = options

  try {
    // Get Nitro storage
    const storage = useStorage('mcp-tasks')

    // Initialize MCP agent service
    const agentService = new MCPAgentService(storage)
    await agentService.initialize()

    if (onProgress) {
      onProgress({ type: 'acknowledgment', message: 'Processing your request with MCP agents...' })
    }

    // Generate request ID
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Build email request object
    const emailRequest = {
      id: requestId,
      from: agentEmail || 'user@example.com',
      subject: 'Agent Request',
      body: userPrompt,
      messageId: currentMessageId || `msg-${Date.now()}`,
      attachments: attachments || []
    }

    console.log(`[MCPAgentV2] 📧 Processing email request: ${requestId}`)

    // Process email request using MCP agent service
    const result = await agentService.processEmailRequest(emailRequest)

    const totalDuration = Date.now() - startTime
    const endTimestamp = new Date().toISOString()
    console.log(`[${endTimestamp}] [MCPAgentV2] ⏱️  Total execution time: ${totalDuration}ms`)

    if (onProgress) {
      onProgress({ type: 'completion', message: 'Request completed successfully' })
    }

    // Return the summary or result text
    return result.summary || result.message || 'Request processed successfully'
  } catch (error) {
    console.error(`[MCPAgentV2] ❌ Error during agent execution:`, error)

    if (onProgress) {
      onProgress({ type: 'completion', message: 'Request failed - see logs for details' })
    }

    throw error
  }
}

/**
 * Runs an MCP agent using the mcp-use framework (non-streaming version)
 * @param options Configuration options for the MCP agent
 * @returns The final output from the agent
 */
export async function runMCPAgentV2(options: RunMCPAgentOptions): Promise<string> {
  return runMCPAgentStreamingV2(options)
}

/**
 * Get task status for a request
 */
export async function getMCPTaskStatus(requestId: string) {
  try {
    const storage = useStorage('mcp-tasks')
    const agentService = new MCPAgentService(storage)
    await agentService.initialize()

    return await agentService.getTaskStatus(requestId)
  } catch (error) {
    console.error('❌ Error getting task status:', error)
    return []
  }
}

/**
 * Get response for a request
 */
export async function getMCPResponse(requestId: string) {
  try {
    const storage = useStorage('mcp-tasks')
    const agentService = new MCPAgentService(storage)
    await agentService.initialize()

    return await agentService.getResponse(requestId)
  } catch (error) {
    console.error('❌ Error getting response:', error)
    return null
  }
}
