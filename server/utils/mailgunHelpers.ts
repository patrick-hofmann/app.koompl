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
  const v = String(value).trim()
  if (!v) return null

  // Handle angle bracket format: "Name <email@domain.com>"
  const angle = v.match(/<([^>]+)>/)
  if (angle) {
    const email = angle[1].trim()
    const first = email.split(',')[0].trim()
    return first.toLowerCase()
  }

  // Handle plain email or comma-separated emails
  const first = v.split(',')[0].trim()

  // Basic email validation
  if (first.includes('@') && first.includes('.')) {
    return first.toLowerCase()
  }

  // If it doesn't look like an email, return null
  return null
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
  isInline?: boolean
  contentId?: string
}

// Maximum attachment size (25MB)
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024

// Allowed MIME types for security
// const ALLOWED_MIME_TYPES = [
//   'image/',
//   'text/',
//   'application/pdf',
//   'application/msword',
//   'application/vnd.openxmlformats-officedocument',
//   'application/vnd.ms-excel',
//   'application/vnd.ms-powerpoint',
//   'application/zip',
//   'application/x-zip-compressed',
//   'application/json',
//   'application/xml',
//   'application/octet-stream'
// ]

function isAllowedMimeType(_mimeType: string): boolean {
  return true // ALLOWED_MIME_TYPES.some(allowed => mimeType.startsWith(allowed))
}

function validateAttachmentData(data: string): { isValid: boolean; error?: string } {
  if (!data || typeof data !== 'string') {
    return { isValid: false, error: 'Invalid attachment data' }
  }

  // Check if it's valid base64
  try {
    const decoded = Buffer.from(data, 'base64')
    if (decoded.length === 0) {
      return { isValid: false, error: 'Empty attachment data' }
    }
    if (decoded.length > MAX_ATTACHMENT_SIZE) {
      return {
        isValid: false,
        error: `Attachment too large: ${decoded.length} bytes (max: ${MAX_ATTACHMENT_SIZE})`
      }
    }
  } catch {
    return { isValid: false, error: 'Invalid base64 data' }
  }

  return { isValid: true }
}

function normalizeAttachment(raw: any): MailgunAttachment | null {
  if (!raw) return null

  // Handle string input (JSON encoded)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return normalizeAttachment(parsed)
    } catch {
      return null
    }
  }

  // Extract base64 data from various possible fields
  let data: string | null = null

  if (typeof raw.data === 'string') {
    data = raw.data
  } else if (typeof raw.content === 'string') {
    data = raw.content
  } else if (typeof raw.base64 === 'string') {
    data = raw.base64
  } else if (typeof raw.body === 'string') {
    data = raw.body
  } else if (raw.data instanceof Buffer) {
    // Handle multipart form data where data is a Buffer
    data = raw.data.toString('base64')
  }

  if (!data) return null

  // Validate attachment data
  const validation = validateAttachmentData(data)
  if (!validation.isValid) {
    console.warn(`[Mailgun] Skipping invalid attachment: ${validation.error}`)
    return null
  }

  // Extract filename with better fallbacks
  const filename = String(
    raw.filename ||
      raw.name ||
      raw.fileName ||
      raw['content-disposition']?.match(/filename="?([^"]+)"?/)?.[1] ||
      `attachment-${Date.now()}.bin`
  ).trim()

  // Extract MIME type with better detection
  const mimeType = String(
    raw['content-type'] ||
      raw.mimeType ||
      raw.type ||
      (raw['content-disposition']
        ?.match(/filename="?([^"]+)"?/)?.[1]
        ?.split('.')
        .pop()
        ?.toLowerCase() === 'pdf'
        ? 'application/pdf'
        : 'application/octet-stream')
  ).trim()

  // Validate MIME type
  if (!isAllowedMimeType(mimeType)) {
    console.warn(`[Mailgun] Skipping attachment with disallowed MIME type: ${mimeType}`)
    return null
  }

  // Calculate size
  let size = Number(raw.size || raw['content-length'] || 0)
  if (!size || Number.isNaN(size)) {
    try {
      size = Buffer.from(data, 'base64').length
    } catch {
      size = 0
    }
  }

  // Check size again after calculation
  if (size > MAX_ATTACHMENT_SIZE) {
    console.warn(`[Mailgun] Skipping oversized attachment: ${size} bytes`)
    return null
  }

  return {
    filename,
    data,
    encoding: 'base64',
    mimeType,
    size,
    isInline: Boolean(raw['content-disposition']?.includes('inline') || raw.isInline),
    contentId: raw['content-id'] || raw.contentId
  }
}

export function extractMailgunAttachments(
  payload: Record<string, any> | null | undefined
): MailgunAttachment[] {
  if (!payload || typeof payload !== 'object') {
    console.log('[Mailgun] No payload or invalid payload for attachment extraction')
    return []
  }

  const attachments: MailgunAttachment[] = []
  let processedCount = 0
  let skippedCount = 0

  console.log('[Mailgun] Starting attachment extraction from payload')

  // Method 1: Handle 'attachments' array format
  const plural = (payload as any).attachments
  if (Array.isArray(plural)) {
    console.log(`[Mailgun] Found attachments array with ${plural.length} items`)
    for (const item of plural) {
      const normalized = normalizeAttachment(item)
      if (normalized) {
        attachments.push(normalized)
        processedCount++
        console.log(
          `[Mailgun] ✓ Processed attachment: ${normalized.filename} (${normalized.size} bytes, ${normalized.mimeType})`
        )
      } else {
        skippedCount++
      }
    }
  }

  // Method 2: Handle 'attachment-count' format
  const countRaw = (payload as any)['attachment-count']
  const count = Number(countRaw || 0)
  if (!Number.isNaN(count) && count > 0) {
    console.log(`[Mailgun] Found attachment-count: ${count}`)
    for (let i = 1; i <= count; i += 1) {
      const key = `attachment-${i}`
      const raw = (payload as any)[key]
      const normalized = normalizeAttachment(raw)
      if (normalized) {
        attachments.push(normalized)
        processedCount++
        console.log(
          `[Mailgun] ✓ Processed attachment-${i}: ${normalized.filename} (${normalized.size} bytes, ${normalized.mimeType})`
        )
      } else {
        skippedCount++
      }
    }
  }

  // Method 3: Handle individual attachment fields (attachment-1, attachment-2, etc.)
  const attachmentKeys = Object.keys(payload).filter(
    (key) => key.startsWith('attachment-') && !key.includes('count')
  )
  if (attachmentKeys.length > 0) {
    console.log(`[Mailgun] Found ${attachmentKeys.length} individual attachment fields`)
    for (const key of attachmentKeys) {
      const raw = (payload as any)[key]
      const normalized = normalizeAttachment(raw)
      if (normalized) {
        attachments.push(normalized)
        processedCount++
        console.log(
          `[Mailgun] ✓ Processed ${key}: ${normalized.filename} (${normalized.size} bytes, ${normalized.mimeType})`
        )
      } else {
        skippedCount++
      }
    }
  }

  // Method 4: Handle inline attachments (content-id based)
  const inlineAttachments = Object.keys(payload).filter(
    (key) =>
      key.startsWith('inline-') ||
      (payload[key] &&
        typeof payload[key] === 'object' &&
        payload[key]['content-disposition']?.includes('inline'))
  )
  if (inlineAttachments.length > 0) {
    console.log(`[Mailgun] Found ${inlineAttachments.length} inline attachments`)
    for (const key of inlineAttachments) {
      const raw = (payload as any)[key]
      const normalized = normalizeAttachment(raw)
      if (normalized) {
        attachments.push(normalized)
        processedCount++
        console.log(
          `[Mailgun] ✓ Processed inline ${key}: ${normalized.filename} (${normalized.size} bytes, ${normalized.mimeType})`
        )
      } else {
        skippedCount++
      }
    }
  }

  // Method 5: Handle multipart/form-data style attachments
  const formDataAttachments = Object.keys(payload).filter(
    (key) =>
      key.includes('attachment') &&
      typeof payload[key] === 'object' &&
      payload[key] !== null &&
      !Array.isArray(payload[key])
  )
  if (formDataAttachments.length > 0) {
    console.log(`[Mailgun] Found ${formDataAttachments.length} form-data attachments`)
    for (const key of formDataAttachments) {
      const raw = (payload as any)[key]
      const normalized = normalizeAttachment(raw)
      if (normalized) {
        attachments.push(normalized)
        processedCount++
        console.log(
          `[Mailgun] ✓ Processed form-data ${key}: ${normalized.filename} (${normalized.size} bytes, ${normalized.mimeType})`
        )
      } else {
        skippedCount++
      }
    }
  }

  console.log(
    `[Mailgun] Attachment extraction complete: ${processedCount} processed, ${skippedCount} skipped, ${attachments.length} total`
  )

  // Log summary of extracted attachments
  if (attachments.length > 0) {
    const totalSize = attachments.reduce((sum, att) => sum + att.size, 0)
    const mimeTypes = [...new Set(attachments.map((att) => att.mimeType))]
    console.log(
      `[Mailgun] Summary: ${attachments.length} attachments, ${totalSize} total bytes, types: ${mimeTypes.join(', ')}`
    )
  }

  return attachments
}

/**
 * Get attachment statistics from a payload without processing them
 */
export function getAttachmentStats(payload: Record<string, any> | null | undefined): {
  totalCount: number
  totalSize: number
  mimeTypes: string[]
  hasInline: boolean
  hasAttachments: boolean
} {
  const attachments = extractMailgunAttachments(payload)
  const totalSize = attachments.reduce((sum, att) => sum + att.size, 0)
  const mimeTypes = [...new Set(attachments.map((att) => att.mimeType))]
  const hasInline = attachments.some((att) => att.isInline)

  return {
    totalCount: attachments.length,
    totalSize,
    mimeTypes,
    hasInline,
    hasAttachments: attachments.length > 0
  }
}

/**
 * Filter attachments by MIME type
 */
export function filterAttachmentsByMimeType(
  attachments: MailgunAttachment[],
  mimeTypePattern: string | RegExp
): MailgunAttachment[] {
  const pattern =
    typeof mimeTypePattern === 'string' ? new RegExp(mimeTypePattern) : mimeTypePattern
  return attachments.filter((att) => pattern.test(att.mimeType))
}

/**
 * Filter attachments by size range
 */
export function filterAttachmentsBySize(
  attachments: MailgunAttachment[],
  minSize: number = 0,
  maxSize: number = Number.MAX_SAFE_INTEGER
): MailgunAttachment[] {
  return attachments.filter((att) => att.size >= minSize && att.size <= maxSize)
}

/**
 * Group attachments by MIME type
 */
export function groupAttachmentsByMimeType(
  attachments: MailgunAttachment[]
): Record<string, MailgunAttachment[]> {
  return attachments.reduce(
    (groups, att) => {
      const mimeType = att.mimeType
      if (!groups[mimeType]) {
        groups[mimeType] = []
      }
      groups[mimeType].push(att)
      return groups
    },
    {} as Record<string, MailgunAttachment[]>
  )
}

/**
 * Validate attachment for security and size constraints
 */
export function validateAttachment(attachment: MailgunAttachment): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check filename
  if (!attachment.filename || attachment.filename.trim().length === 0) {
    errors.push('Filename is required')
  }

  // Check for suspicious filename patterns
  const suspiciousPatterns = [
    /\.\./, // Path traversal
    /[<>:"|?*]/, // Invalid filename characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i // Windows reserved names
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(attachment.filename)) {
      errors.push(`Suspicious filename pattern: ${attachment.filename}`)
      break
    }
  }

  // Check MIME type
  if (!isAllowedMimeType(attachment.mimeType)) {
    errors.push(`Disallowed MIME type: ${attachment.mimeType}`)
  }

  // Check size
  if (attachment.size <= 0) {
    errors.push('Invalid file size')
  } else if (attachment.size > MAX_ATTACHMENT_SIZE) {
    errors.push(`File too large: ${attachment.size} bytes (max: ${MAX_ATTACHMENT_SIZE})`)
  }

  // Check data integrity
  const dataValidation = validateAttachmentData(attachment.data)
  if (!dataValidation.isValid) {
    errors.push(dataValidation.error || 'Invalid attachment data')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Debug function to log detailed attachment information
 */
export function debugAttachments(payload: Record<string, any> | null | undefined): void {
  console.log('[Mailgun Debug] === ATTACHMENT DEBUG START ===')

  if (!payload || typeof payload !== 'object') {
    console.log('[Mailgun Debug] No payload or invalid payload')
    return
  }

  console.log('[Mailgun Debug] Payload keys:', Object.keys(payload))

  // Check for attachment-related fields
  const attachmentKeys = Object.keys(payload).filter(
    (key) => key.includes('attachment') || key.includes('inline') || key.includes('content')
  )
  console.log('[Mailgun Debug] Attachment-related keys:', attachmentKeys)

  // Check attachment-count
  const count = payload['attachment-count']
  console.log('[Mailgun Debug] attachment-count:', count)

  // Check attachments array
  const attachments = payload.attachments
  console.log(
    '[Mailgun Debug] attachments array:',
    Array.isArray(attachments) ? attachments.length : 'not an array'
  )

  // Extract and analyze attachments
  const extracted = extractMailgunAttachments(payload)
  console.log('[Mailgun Debug] Extracted attachments:', extracted.length)

  for (let i = 0; i < extracted.length; i++) {
    const att = extracted[i]
    console.log(`[Mailgun Debug] Attachment ${i + 1}:`, {
      filename: att.filename,
      mimeType: att.mimeType,
      size: att.size,
      isInline: att.isInline,
      contentId: att.contentId,
      dataLength: att.data.length
    })
  }

  console.log('[Mailgun Debug] === ATTACHMENT DEBUG END ===')
}

/**
 * Simple wrapper to send email via Mailgun with automatic configuration
 */
export async function sendMailgunEmail(params: {
  from: string
  to: string
  subject: string
  text: string
  html?: string
  inReplyTo?: string
  references?: string
}): Promise<MailgunSendResponse> {
  const { from, to, subject, text, html, inReplyTo, references } = params

  // Get Mailgun configuration from settings
  const settingsStorage = useStorage('settings')
  const settings = (await settingsStorage.getItem<Record<string, unknown>>('settings.json')) || {}

  const mailgunApiKey = String(settings.mailgunApiKey || process.env.MAILGUN_KEY || '').trim()
  const mailgunDomain = String(settings.mailgunDomain || process.env.MAILGUN_DOMAIN || '').trim()

  if (!mailgunApiKey || !mailgunDomain) {
    console.warn('[MailgunHelpers] Mailgun not configured, simulating email send for development')
    return {
      id: `dev-${Date.now()}`,
      message: 'Email simulated (Mailgun not configured)'
    }
  }

  // Build body with threading headers
  const body = new URLSearchParams({
    'o:tracking': 'no',
    'o:tracking-clicks': 'no',
    'o:tracking-opens': 'no',
    'h:Content-Type': 'text/plain; charset=utf-8',
    'h:MIME-Version': '1.0',
    'h:Content-Transfer-Encoding': '8bit',
    from,
    to,
    subject,
    text
  })

  if (html) {
    body.set('html', html)
  }

  // Add threading headers
  if (inReplyTo) {
    body.set('h:In-Reply-To', inReplyTo)
  }

  if (references) {
    body.set('h:References', references)
  }

  const encodedDomain = encodeURIComponent(mailgunDomain)
  const endpoint = `https://api.mailgun.net/v3/${encodedDomain}/messages`

  return await $fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  })
}
