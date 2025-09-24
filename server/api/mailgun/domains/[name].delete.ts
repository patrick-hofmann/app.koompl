export default defineEventHandler(async (event) => {
  const settings = await useStorage('settings').getItem<{ mailgunApiKey?: string }>('settings.json')
  const apiKey = settings?.mailgunApiKey
  if (!apiKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing Mailgun API key' })
  }
  const name = getRouterParam(event, 'name')
  const res: any = await $fetch(`https://api.mailgun.net/v4/domains/${encodeURIComponent(String(name))}`, {
    method: 'DELETE',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64')
    }
  }).catch((e) => ({ message: String(e), status: 'error' }))

  if (res?.status === 'error') {
    throw createError({ statusCode: 502, statusMessage: 'Mailgun error: ' + res.message })
  }
  return { ok: true }
})


