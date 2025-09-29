import { createMcpServer, listMcpProviderPresets, listMcpServers } from '../../utils/mcpStorage'
import type { McpServer } from '~/types'

export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  if (method === 'GET') {
    const servers = await listMcpServers()
    const presets = listMcpProviderPresets()
    return { servers, presets }
  }

  if (method === 'POST') {
    const body = await readBody<Partial<McpServer>>(event)
    const server = await createMcpServer(body)
    return server
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
