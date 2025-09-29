export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiKey = config.mailgun?.key
  if (!apiKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing Mailgun API key' })
  }

  const body = await readBody<{ name?: string, smtp_password?: string, spam_action?: string }>(event)
  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'Missing domain name' })
  }

  // https://documentation.mailgun.com/en/latest/api-domains.html#domains
  const form = new URLSearchParams()
  form.set('name', body.name)
  if (body.smtp_password) form.set('smtp_password', body.smtp_password)
  if (body.spam_action) form.set('spam_action', body.spam_action)

  const res: any = await $fetch('https://api.mailgun.net/v4/domains', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  }).catch(e => ({ message: String(e), status: 'error' }))

  if (res?.status === 'error') {
    throw createError({ statusCode: 502, statusMessage: 'Mailgun error: ' + res.message })
  }

  return { ok: true, domain: res?.domain || res }
})
