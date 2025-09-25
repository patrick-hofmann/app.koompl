export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing id' })
    }

    const body = await readBody<{ subject?: string, text?: string }>(event)
    const subject = String(body?.subject || 'Test Email')
    const text = String(body?.text || `Hello,

This is a test message to verify the agent setup and AI response flow.

Thanks!`)

    // Use the new respond route
    const response = await $fetch<{ ok: boolean, result?: string, error?: string }>(`/api/agents/${id}/respond`, {
      method: 'POST',
      body: {
        subject,
        text,
        includeQuote: false,
        maxTokens: 400,
        temperature: 0.4
      }
    })

    if (!response.ok) {
      return { ok: false, error: response.error || 'Unknown error' }
    }

    return { ok: true, result: response.result || '' }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})
