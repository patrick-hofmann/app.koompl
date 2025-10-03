/**
 * Mailgun helper utilities to deduplicate outbound requests and email parsing
 */

/**
 * Extract bare email address from common header formats like:
 * - "Name <user@example.com>"
 * - "user@example.com, other@example.com"
 */
export function extractEmail(value: string | undefined | null): string | null {
  if (!value) return null
  const v = String(value)
  const angle = v.match(/<([^>]+)>/)
  const email = (angle ? angle[1] : v).trim()
  const first = email.split(',')[0].trim()
  return first.toLowerCase()
}

/**
 * Determine Mailgun domain using runtime config or fallback based on sender address
 */
export function determineMailgunDomain(
  configuredDomain: string | undefined,
  from: string
): string | null {
  const fromEmail = extractEmail(from) || from
  const fallbackDomain = fromEmail && fromEmail.includes('@') ? fromEmail.split('@')[1] : undefined
  const domain = (configuredDomain || fallbackDomain || '').trim()
  return domain || null
}

type MailgunSendParams = {
  endpointDomain: string
  apiKey: string
  from: string
  to: string
  subject: string
  text: string
  html?: string
  tracking?: boolean
}

type MailgunSendResponse = { id?: string; message?: string }

/**
 * Send an email via Mailgun messages API
 */
export async function sendMailgunMessage(params: MailgunSendParams): Promise<MailgunSendResponse> {
  const { endpointDomain, apiKey, from, to, subject, text, html, tracking = false } = params
  const encodedDomain = encodeURIComponent(endpointDomain)
  const endpoint = `https://api.mailgun.net/v3/${encodedDomain}/messages`

  const body = new URLSearchParams({
    'o:tracking': tracking ? 'yes' : 'no',
    'o:tracking-clicks': tracking ? 'yes' : 'no',
    'o:tracking-opens': tracking ? 'yes' : 'no',
    'h:Content-Type': 'text/plain; charset=utf-8',
    'h:MIME-Version': '1.0',
    'h:Content-Transfer-Encoding': '8bit',
    from,
    to,
    subject,
    text
  })
  if (html) body.set('html', html)

  return await $fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  })
}

export interface MailgunAttachment {
  filename: string
  data: string
  encoding: 'base64'
  mimeType: string
  size: number
}

function normalizeAttachment(raw: any): MailgunAttachment | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return normalizeAttachment(parsed)
    } catch {
      return null
    }
  }
  const data =
    typeof raw.data === 'string'
      ? raw.data
      : typeof raw.content === 'string'
        ? raw.content
        : typeof raw.base64 === 'string'
          ? raw.base64
          : null
  if (!data) return null
  const filename = String(raw.filename || raw.name || raw.fileName || `attachment-${Date.now()}`)
  const mimeType = String(
    raw['content-type'] || raw.mimeType || raw.type || 'application/octet-stream'
  )
  let size = Number(raw.size || raw['content-length'] || 0)
  if (!size || Number.isNaN(size)) {
    try {
      size = Buffer.from(data, 'base64').length
    } catch {
      size = 0
    }
  }
  return { filename, data, encoding: 'base64', mimeType, size }
}

export function extractMailgunAttachments(
  payload: Record<string, any> | null | undefined
): MailgunAttachment[] {
  if (!payload || typeof payload !== 'object') return []
  const attachments: MailgunAttachment[] = []
  const plural = (payload as any).attachments
  if (Array.isArray(plural)) {
    for (const item of plural) {
      const normalized = normalizeAttachment(item)
      if (normalized) attachments.push(normalized)
    }
  }
  const countRaw = (payload as any)['attachment-count']
  const count = Number(countRaw || 0)
  if (!Number.isNaN(count) && count > 0) {
    for (let i = 1; i <= count; i += 1) {
      const key = `attachment-${i}`
      const raw = (payload as any)[key]
      const normalized = normalizeAttachment(raw)
      if (normalized) attachments.push(normalized)
    }
  }
  return attachments
}
