import { createGeneralAgent } from '../../../mcp/agent'
import { listMcpServers } from '../../../mcp/storage'

export default defineEventHandler(async (event) => {
  try {
    const serverId = getRouterParam(event, 'id')
    if (!serverId) {
      throw createError({ statusCode: 400, statusMessage: 'Server ID is required' })
    }

    const body = await readBody(event)
    const { testMessage, agentType = 'general' } = body

    if (!testMessage) {
      throw createError({ statusCode: 400, statusMessage: 'Test message is required' })
    }

    // Get the specific server
    const allServers = await listMcpServers()
    const server = allServers.find((s) => s.id === serverId)

    if (!server) {
      throw createError({ statusCode: 404, statusMessage: 'MCP server not found' })
    }

    // Create MCP agent
    const mcpAgent = createGeneralAgent()

    // Process test message
    const emailContext = {
      subject: 'MCP Agent Test',
      text: testMessage,
      from: 'test@koompl.ai',
      receivedAt: new Date().toISOString()
    }

    const agentPrompt =
      'You are a helpful AI assistant that can access various data sources through MCP servers.'

    const response = await mcpAgent.processEmail(emailContext, agentPrompt, [server])

    // Cleanup
    await mcpAgent.cleanup()

    return {
      success: response.success,
      result: response.result,
      error: response.error,
      serverName: server.name,
      serverProvider: server.provider,
      agentType
    }
  } catch (error) {
    console.error('MCP Agent test error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})
