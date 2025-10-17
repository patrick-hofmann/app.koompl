/**
 * MCP Agent Processing Endpoint
 *
 * This endpoint processes email requests using the mcp-use framework
 * and stores task data in Nitro storage.
 */

import { MCPAgentService } from '~~/server/services/mcpAgentService'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { from, subject, body: emailBody, messageId, attachments = [] } = body

    if (!from || !subject || !emailBody) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: from, subject, body'
      })
    }

    console.log(`📧 [MCP API] Processing email from ${from}: ${subject}`)

    // Get Nitro storage
    const storage = useStorage('mcp-tasks')

    // Initialize MCP agent service
    const agentService = new MCPAgentService(storage)
    await agentService.initialize()

    // Generate request ID
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Process email request
    const result = await agentService.processEmailRequest({
      id: requestId,
      from,
      subject,
      body: emailBody,
      messageId: messageId || `msg-${Date.now()}@test.local`,
      attachments
    })

    console.log(`✅ [MCP API] Processed request ${requestId}:`, result.status)

    return {
      success: true,
      requestId,
      result
    }
  } catch (error) {
    console.error('❌ [MCP API] Error processing email:', error)

    return {
      success: false,
      error: error.message,
      message: 'Failed to process email request'
    }
  }
})
