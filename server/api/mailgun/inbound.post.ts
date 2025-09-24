export default defineEventHandler(async (event) => {
  // Mailgun forwards MIME or parsed form fields depending on route settings.
  // We accept both JSON and form-urlencoded payloads.

  const storage = useStorage('inbound')

  let payload: any = null
  const contentType = getHeader(event, 'content-type') || ''

  if (contentType.includes('application/json')) {
    payload = await readBody(event)
  } else {
    // Parse form data for typical Mailgun POSTs
    const body = await readBody<Record<string, string>>(event)
    payload = body
  }

  // Basic shape we care about
  const receivedAt = new Date().toISOString()
  const messageId = String(payload['Message-Id'] || payload['message-id'] || payload['Message-Id'] || payload['Message-Id'] || payload['message']['headers']?.['message-id'] || crypto.randomUUID?.() || Math.random().toString(36).slice(2))
  const from = payload['from'] || payload['sender'] || payload['From'] || payload['headers']?.from
  const to = payload['recipient'] || payload['to'] || payload['To'] || payload['headers']?.to
  const subject = payload['subject'] || payload['Subject'] || payload['headers']?.subject
  const text = payload['stripped-text'] || payload['text'] || payload['body-plain'] || payload['body']
  const html = payload['stripped-html'] || payload['html'] || payload['body-html']

  // Persist raw payload for traceability
  const key = `${receivedAt}_${(messageId || '').replace(/[^a-zA-Z0-9_-]/g, '') || Math.random().toString(36).slice(2)}.json`
  await storage.setItem(key, {
    receivedAt,
    messageId,
    from,
    to,
    subject,
    text,
    html,
    raw: payload
  })

  return {
    ok: true,
    id: key
  }
})


