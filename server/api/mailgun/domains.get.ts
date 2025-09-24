export default defineEventHandler(async () => {
  const settings = await useStorage('settings').getItem<{ mailgunApiKey?: string }>('settings.json')
  const apiKey = settings?.mailgunApiKey
  if (!apiKey) {
    return { ok: false, error: 'missing_api_key', domains: [] }
  }
  // Mailgun API - list domains
  // See: https://documentation.mailgun.com/en/latest/api-domains.html#domains
  const res: { items?: unknown[] } | undefined = await $fetch('https://api.mailgun.net/v4/domains', {
    headers: {
      Authorization: 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64')
    }
  }).catch(_e => ({ items: [] }))

  const items = Array.isArray(res?.items) ? res!.items as Array<Record<string, unknown>> : []
  const domains = items.map(d => ({
    name: String(d.name || ''),
    state: String(d.state || ''),
    created_at: String(d.created_at || '')
  }))
  return { ok: true, domains }
})
