/**
 * MCP Agent Status Endpoint
 *
 * This endpoint returns the status of tasks and responses for a given request.
 */

import { MCPAgentService } from '../../../services/mcpAgentService'

export default defineEventHandler(async (event) => {
  try {
    const requestId = getRouterParam(event, 'requestId')

    if (!requestId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing requestId parameter'
      })
    }

    console.log(`📊 [MCP API] Getting status for request: ${requestId}`)

    // Get Nitro storage
    const storage = useStorage('mcp-tasks')

    // Initialize MCP agent service
    const agentService = new MCPAgentService(storage)
    await agentService.initialize()

    // Get task status
    const tasks = await agentService.getTaskStatus(requestId)

    // Get response
    const response = await agentService.getResponse(requestId)

    console.log(`✅ [MCP API] Retrieved status for ${requestId}: ${tasks.length} tasks`)

    return {
      success: true,
      requestId,
      tasks,
      response,
      summary: {
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.status === 'completed').length,
        failedTasks: tasks.filter((t) => t.status === 'failed').length,
        pendingTasks: tasks.filter((t) => t.status === 'pending').length,
        inProgressTasks: tasks.filter((t) => t.status === 'in_progress').length
      }
    }
  } catch (error) {
    console.error('❌ [MCP API] Error getting status:', error)

    return {
      success: false,
      error: error.message,
      message: 'Failed to get request status'
    }
  }
})
