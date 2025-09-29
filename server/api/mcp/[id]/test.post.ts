import { findMcpServer } from '../../../utils/mcpStorage'
import { testMcpConnection } from '../../../utils/mcpClients'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') as string
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing MCP server id' })
  }

  const server = await findMcpServer(id)
  if (!server) {
    throw createError({ statusCode: 404, statusMessage: 'MCP server not found' })
  }

  const result = await testMcpConnection(server)
  return result
})
