import { createMcpServer, getMcpServerTemplate } from '../../utils/mcpStorage'
import type { McpServer } from '~/types'

export default defineEventHandler(async event => {
  try {
    const body = await readBody<{ templateId: string; customizations?: Partial<McpServer> }>(event)
    const { templateId, customizations = {} } = body

    if (!templateId) {
      throw createError({ statusCode: 400, statusMessage: 'Template ID is required' })
    }

    const template = getMcpServerTemplate(templateId)
    if (!template) {
      throw createError({ statusCode: 404, statusMessage: 'Template not found' })
    }

    // Merge template config with customizations
    const serverConfig: Partial<McpServer> = {
      ...template.defaultConfig,
      ...customizations
    }

    const server = await createMcpServer(serverConfig)
    return server
  } catch (error) {
    console.error('Template creation error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to create server from template'
    })
  }
})
