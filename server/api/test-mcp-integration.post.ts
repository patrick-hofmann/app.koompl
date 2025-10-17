/**
 * Test MCP Integration Endpoint
 *
 * This endpoint tests the new MCP agent service with mcp-use framework
 * and Nitro storage integration.
 */

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { testType = 'simple', email = 'test@example.com' } = body

    console.log(`🧪 [Test MCP] Starting ${testType} test for ${email}`)

    // Test 1: Simple email processing
    if (testType === 'simple') {
      const testEmail = {
        from: email,
        subject: 'Test: Please organize my datasafe files',
        body: 'I have a messy datasafe with files everywhere. Please organize them by type and create a summary.',
        attachments: []
      }

      console.log('🧪 [Test MCP] Testing simple email processing...')

      const response = await event.$fetch('/api/agent/test@example.com/mcp-process', {
        method: 'POST',
        body: testEmail
      })

      return {
        success: true,
        testType: 'simple',
        response,
        message: 'Simple email processing test completed'
      }
    }

    // Test 2: Complex email processing
    if (testType === 'complex') {
      const testEmail = {
        from: email,
        subject: 'Test: Urgent quarterly report needed',
        body: 'I need a comprehensive quarterly report by tomorrow. Include sales data, team performance, and recommendations for next quarter.',
        attachments: []
      }

      console.log('🧪 [Test MCP] Testing complex email processing...')

      const response = await event.$fetch('/api/agent/test@example.com/mcp-process', {
        method: 'POST',
        body: testEmail
      })

      return {
        success: true,
        testType: 'complex',
        response,
        message: 'Complex email processing test completed'
      }
    }

    // Test 3: Status check
    if (testType === 'status') {
      const { requestId } = body

      if (!requestId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Missing requestId for status test'
        })
      }

      console.log(`🧪 [Test MCP] Checking status for request: ${requestId}`)

      const response = await event.$fetch(
        `/api/agent/test@example.com/mcp-status?requestId=${requestId}`,
        {
          method: 'GET'
        }
      )

      return {
        success: true,
        testType: 'status',
        response,
        message: 'Status check test completed'
      }
    }

    // Test 4: Direct MCP agent service test
    if (testType === 'direct') {
      console.log('🧪 [Test MCP] Testing direct MCP agent service...')

      const { MCPAgentService } = await import('~~/server/services/mcpAgentService')
      const storage = useStorage('mcp-tasks')

      const agentService = new MCPAgentService(storage)
      await agentService.initialize()

      const testRequest = {
        id: `test-${Date.now()}`,
        from: email,
        subject: 'Direct Test: List my files',
        body: 'Please list all files in my datasafe and create a summary.',
        attachments: []
      }

      const result = await agentService.processEmailRequest(testRequest)

      return {
        success: true,
        testType: 'direct',
        result,
        message: 'Direct MCP agent service test completed'
      }
    }

    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid test type. Use: simple, complex, status, or direct'
    })
  } catch (error) {
    console.error('❌ [Test MCP] Test failed:', error)

    return {
      success: false,
      error: error.message,
      message: 'Test failed - see logs for details'
    }
  }
})
