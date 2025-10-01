export default defineEventHandler(async _event => {
  const config = useRuntimeConfig()
  const apiKey = config.mailgun?.key
  if (!apiKey) {
    console.log('[domains.get] No API key found')
    throw createError({
      statusCode: 400,
      statusMessage: 'Mailgun API key is missing in Runtime Config.',
      data: { ok: false, error: 'missing_api_key' }
    })
  }
  // Mailgun API - list domains
  // See: https://documentation.mailgun.com/en/latest/api-domains.html#domains
  console.log('[domains.get] Fetching domains from Mailgun API')
  let res: { items?: unknown[] } | undefined
  try {
    res = await $fetch('https://api.mailgun.net/v4/domains', {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64')
      }
    })
  } catch (e: unknown) {
    const err = e as { status?: number; response?: { status?: number } }
    const status = err?.status || err?.response?.status
    if (status === 401) {
      console.error('[domains.get] Unauthorized from Mailgun API (401). Likely invalid API key.')
      throw createError({
        statusCode: 401,
        statusMessage: 'Mailgun rejected the API key (401 Unauthorized).',
        data: { ok: false, error: 'invalid_api_key' }
      })
    }
    console.error('[domains.get] Error fetching domains:', e)
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to fetch domains from Mailgun.',
      data: { ok: false, error: 'upstream_error' }
    })
  }

  const items = Array.isArray(res?.items) ? res!.items as Array<Record<string, unknown>> : []
  const domains = items.map(d => ({
    name: String(d.name || ''),
    state: String(d.state || ''),
    created_at: String(d.created_at || '')
  }))
  console.log(`[domains.get] Found ${domains.length} domains`)
  return { ok: true, domains }
})
