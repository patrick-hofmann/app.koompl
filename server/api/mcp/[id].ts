import { findMcpServer, removeMcpServer, updateMcpServer } from '../../mcp/storage'
import type { McpServer } from '~/types'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') as string
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing MCP server id' })
  }

  const method = getMethod(event)

  if (method === 'GET') {
    const server = await findMcpServer(id)
    if (!server) {
      throw createError({ statusCode: 404, statusMessage: 'MCP server not found' })
    }
    return server
  }

  if (method === 'PUT' || method === 'PATCH') {
    const body = await readBody<Partial<McpServer>>(event)
    const server = await updateMcpServer(id, body)
    return server
  }

  if (method === 'DELETE') {
    await removeMcpServer(id)
    return { ok: true }
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
