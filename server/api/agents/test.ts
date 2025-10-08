import { runMCPAgent } from '../../utils/mcpAgentHelper'

interface TestAgentRequest {
  userPrompt: string
  systemPrompt?: string
  teamId?: string
  userId?: string
  files?: Array<{
    base64: string
    mimeType: string
    type?: 'image' | 'file'
  }>
  mcpServers?: string[]
}

export default defineEventHandler(async (event) => {
  const method = event.node.req.method

  // Handle GET for testing with default data
  if (method === 'GET') {
    const samplePdfBase64 =
      'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXS9Db250ZW50cyA0IDAgUi9SZXNvdXJjZXMgNSAwIFI+PgplbmRvYmoKNCAwIG9iago8PC9MZW5ndGggNjY+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKEhlbGxvIFdvcmxkISBUaGlzIGlzIGEgdGVzdCBQREYuKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwvRm9udDw8L0YxIDYgMCBSPj4+PgplbmRvYmoKNiAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PgplbmRvYmoKeHJlZgowIDcKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjEwIDAwMDAwIG4gCjAwMDAwMDAzMjYgMDAwMDAgbiAKMDAwMDAwMDM2MyAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNy9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjQyNwolJUVPRg=='

    const mcpConfigs = {
      datasafe: { url: '/api/mcp/builtin-datasafe' }
    }

    const result = await runMCPAgent({
      mcpConfigs,
      teamId: '1',
      userId: 'o7vlnR06h9B-',
      systemPrompt:
        'You are a helpful assistant with access to file storage and analysis capabilities.',
      userPrompt: `
        I'm providing you with a PDF document. Please:
        1. Read and analyze the content of this PDF
        2. Provide a brief summary of what it contains
        3. Store it in my Datasafe at the path /documents/test-document.pdf
        4. Confirm that it was stored successfully
      `,
      attachments: [
        {
          type: 'file',
          base64: samplePdfBase64,
          mimeType: 'application/pdf'
        }
      ],
      event
    })

    return result
  }

  // Handle POST for custom requests
  const body = await readBody<TestAgentRequest>(event)

  if (!body || !body.userPrompt) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required field: userPrompt'
    })
  }

  // Map server names to URLs
  const serverMap: Record<string, string> = {
    gitDoc: 'https://gitmcp.io/docs',
    kanban: '/api/mcp/builtin-kanban',
    datasafe: '/api/mcp/builtin-datasafe',
    agents: '/api/mcp/builtin-agents',
    calendar: '/api/mcp/builtin-calendar'
  }

  // Build MCP configs based on requested servers (default to datasafe)
  const requestedServers = body.mcpServers || ['datasafe']
  const mcpConfigs: Record<string, { url: string }> = {}
  for (const server of requestedServers) {
    if (serverMap[server]) {
      mcpConfigs[server] = { url: serverMap[server] }
    }
  }

  // Convert files to attachments format
  const attachments = body.files?.map((file) => ({
    type: file.type || ('file' as 'image' | 'file'),
    base64: file.base64,
    mimeType: file.mimeType
  }))

  const result = await runMCPAgent({
    mcpConfigs,
    teamId: body.teamId || '1',
    userId: body.userId || 'o7vlnR06h9B-',
    systemPrompt:
      body.systemPrompt || 'You are a helpful AI assistant with access to various tools.',
    userPrompt: body.userPrompt,
    attachments,
    event
  })

  return result
})
