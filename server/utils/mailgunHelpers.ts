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
export function determineMailgunDomain(configuredDomain: string | undefined, from: string): string | null {
  const fromEmail = extractEmail(from) || from
  const fallbackDomain = fromEmail && fromEmail.includes('@') ? fromEmail.split('@')[1] : undefined
  const domain = (configuredDomain || fallbackDomain || '').trim()
  return domain || null
}

type MailgunSendParams = {
  endpointDomain: string;
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
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
      'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  })
}
