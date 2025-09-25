export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') as string
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Missing id' })
    }

    const agentsStorage = useStorage('agents')
    const settingsStorage = useStorage('settings')

    const body = await readBody<{
      subject?: string
      text?: string
      from?: string
      includeQuote?: boolean
      maxTokens?: number
      temperature?: number
    }>(event)

    const subject = String(body?.subject || '')
    const text = String(body?.text || '')
    const from = String(body?.from || '')
    const includeQuote = Boolean(body?.includeQuote ?? true)
    const maxTokens = Number(body?.maxTokens || 700)
    const temperature = Number(body?.temperature || 0.4)

    if (!text.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Email text is required' })
    }

    const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
    const agent = agents.find(a => a?.id === id)
    if (!agent) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }

    const settings = (await settingsStorage.getItem<Record<string, unknown>>('settings.json')) || {}

    // Helper function to get OpenAI key from various sources
    function getOpenAIKey(): string | null {
      const envKey = (process.env as Record<string, unknown>)['OPENAI_API_KEY']
      const settingsKey = (settings as Record<string, unknown>)['openaiApiKey']
      const settingsKey2 = (settings as Record<string, unknown>)['OPENAI_API_KEY']
      const nestedKey = ((settings as Record<string, unknown>)['openai'] && (settings as Record<string, unknown>)['openai']?.apiKey)

      return String(envKey || settingsKey || settingsKey2 || nestedKey || '').trim() || null
    }

    const openaiKey = getOpenAIKey()
    if (!openaiKey) {
      return { ok: false, error: 'missing_openai_key' }
    }

    // Build the user message content
    let userContent = ''
    if (subject) {
      userContent += `Subject: ${subject}\n`
    }
    if (from) {
      userContent += `From: ${from}\n`
    }
    userContent += '\nEmail body:\n' + text

    if (includeQuote) {
      userContent += '\n\nTask: Write a concise, helpful reply. Do not include the original message or signatures.'
    } else {
      userContent += '\n\nTask: Write a concise, helpful reply.'
    }

    const messages = [
      agent.prompt ? { role: 'system', content: String(agent.prompt) } : null,
      { role: 'user', content: userContent }
    ].filter(Boolean) as Array<{ role: string, content: string }>

    const res: { choices?: Array<{ message?: { content?: string } }> } = await $fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature,
        max_tokens: maxTokens
      })
    })

    const result = String(res?.choices?.[0]?.message?.content || '').trim()

    return { ok: true, result }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})
