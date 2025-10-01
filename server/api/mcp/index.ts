import { createMcpServer, listMcpProviderPresets, listMcpServers, getMcpServerTemplates } from '../../utils/mcpStorage'
import type { McpServer } from '~/types'

export default defineEventHandler(async event => {
  const method = getMethod(event)

  if (method === 'GET') {
    const servers = await listMcpServers()
    const presets = listMcpProviderPresets()
    const templates = getMcpServerTemplates()
    return { servers, presets, templates }
  }

  if (method === 'POST') {
    const body = await readBody<Partial<McpServer>>(event)
    const server = await createMcpServer(body)
    return server
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})
