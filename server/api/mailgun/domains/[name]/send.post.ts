export default defineEventHandler(async (event) => {
  const settings = await useStorage('settings').getItem<{ mailgunApiKey?: string }>('settings.json')
  const apiKey = settings?.mailgunApiKey
  if (!apiKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing Mailgun API key' })
  }

  const name = getRouterParam(event, 'name')
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Missing domain name' })
  }

  const { to, subject, text, from } = await readBody<{ to?: string; subject?: string; text?: string; from?: string }>(event)
  if (!to || !subject || !text) {
    throw createError({ statusCode: 400, statusMessage: 'Missing to/subject/text' })
  }

  const form = new URLSearchParams()
  form.set('to', to)
  form.set('subject', subject)
  form.set('text', text)
  form.set('from', from || `Koompl Test <noreply@${name}>`)
  // Disable tracking to avoid link-wrapping which can look suspicious
  form.set('o:tracking', 'no')
  form.set('o:tracking-clicks', 'no')
  form.set('o:tracking-opens', 'no')

  // Mailgun messages API (v3)
  const url = `https://api.mailgun.net/v3/${encodeURIComponent(String(name))}/messages`
  const res: any = await $fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  }).catch((e) => ({ message: String(e), status: 'error' }))

  if (res?.status === 'error') {
    throw createError({ statusCode: 502, statusMessage: 'Mailgun error: ' + res.message })
  }

  return { ok: true, id: res?.id, message: res?.message }
})


