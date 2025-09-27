export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = config.mailgun?.key
  if (!apiKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing Mailgun API key' })
  }
  const name = getRouterParam(event, 'name')
  const res: { message?: string, status?: string } = await $fetch(`https://api.mailgun.net/v4/domains/${encodeURIComponent(String(name))}`, {
    method: 'DELETE',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64')
    }
  }).catch(e => ({ message: String(e), status: 'error' }))

  if (res?.status === 'error') {
    throw createError({ statusCode: 502, statusMessage: 'Mailgun error: ' + res.message })
  }
  return { ok: true }
})
