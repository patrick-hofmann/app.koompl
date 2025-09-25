export default defineEventHandler(async (event) => {
  const storage = useStorage('settings')
  const method = getMethod(event)

  if (method === 'GET') {
    const data = await storage.getItem<{ 
      mailgunApiKey?: string
      allowedDomains?: string 
    }>('settings.json')
    return data || {}
  }

  if (method === 'PATCH' || method === 'PUT' || method === 'POST') {
    const body = await readBody<{ 
      mailgunApiKey?: string
      allowedDomains?: string 
    }>(event)
    const current = (await storage.getItem<{ 
      mailgunApiKey?: string
      allowedDomains?: string 
    }>('settings.json')) || {}
    const next = { ...current, ...body }
    await storage.setItem('settings.json', next)
    return next
  }

  throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
})


