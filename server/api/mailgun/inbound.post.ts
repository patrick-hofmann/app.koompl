/* * Mailgun Inbound Email Handler (Simplified Relay)
 *
 * Receives emails from Mailgun webhook, identifies team by domain,
 * and relays to team-level inbound handler.
 *
 * Flow: Mailgun → mailgun/inbound → team/[teamId]/inbound → agent/[email]/inbound
 */

export default defineEventHandler(async (event) => {
  // Always return ok to Mailgun no matter what happens
  try {
    let payload: Record<string, unknown> | null = null
    const contentType = getHeader(event, 'content-type') || ''

    console.log('[MailgunInbound] Content-Type:', contentType)
    console.log('[MailgunInbound] Request method:', getMethod(event))

    // ═══════════════════════════════════════════════════════════════════
    // PARSE PAYLOAD (multipart, JSON, or form data)
    // ═══════════════════════════════════════════════════════════════════
    if (contentType.includes('application/json')) {
      payload = await readBody(event)
      console.log('[MailgunInbound] Parsed as JSON payload')
    } else if (contentType.includes('multipart/form-data')) {
      console.log('[MailgunInbound] Parsing multipart form data...')
      try {
        const formData = await readMultipartFormData(event)
        if (formData) {
          payload = {}
          for (const field of formData) {
            if (field.name && field.data) {
              if (field.filename) {
                // File attachment
                payload[field.name] = {
                  filename: field.filename,
                  data: field.data,
                  type: field.type,
                  size: field.data.length
                }
                console.log(
                  `[MailgunInbound] Found attachment: ${field.name} = ${field.filename} (${field.data.length} bytes)`
                )
              } else {
                // Text field
                const value =
                  field.data instanceof Buffer ? field.data.toString('utf8') : field.data
                payload[field.name] = value
              }
            }
          }
          console.log('[MailgunInbound] Parsed multipart form data, fields:', Object.keys(payload))
        }
      } catch (error) {
        console.error('[MailgunInbound] Failed to parse multipart form data:', error)
        const body = await readBody<Record<string, string>>(event)
        payload = body
      }
    } else {
      console.log('[MailgunInbound] Parsing as regular form data...')
      const body = await readBody<Record<string, string>>(event)
      payload = body
    }

    if (!payload) {
      console.error('[MailgunInbound] No payload received')
      return { ok: true, error: 'No payload' }
    }

    console.log('[MailgunInbound] Payload keys:', Object.keys(payload))

    // ═══════════════════════════════════════════════════════════════════
    // AUTHENTICATION: Verify token from payload against stored token
    // ═══════════════════════════════════════════════════════════════════

    const { verifyMailgunToken, extractMailgunToken } = await import('../../utils/mailgunAuth')
    const headers = getHeaders(event)
    const receivedToken = extractMailgunToken(payload, headers)

    const authResult = verifyMailgunToken(receivedToken, 'MailgunInbound')
    if (!authResult.success) {
      return { ok: true, error: authResult.error }
    }

    // Log signature and token if present
    if (payload.signature) {
      console.log('[MailgunInbound] Signature:', payload.signature)
    }
    if (payload.token) {
      console.log('[MailgunInbound] Token:', payload.token)
    }

    // Log header data
    console.log('[MailgunInbound] Request headers:', headers)

    // ═══════════════════════════════════════════════════════════════════
    // EXTRACT RECIPIENT AND IDENTIFY TEAM BY DOMAIN
    // ═══════════════════════════════════════════════════════════════════

    // Helper to get first non-empty string
    function firstString(...values: Array<unknown>): string | undefined {
      for (const v of values) {
        if (v === undefined || v === null) continue
        const s = String(v)
        if (s.length > 0) return s
      }
      return undefined
    }

    const recipient = firstString(
      payload.recipient,
      payload.to,
      payload.To,
      payload.recipients,
      payload.Recipients
    )

    const from = firstString(payload.from, payload.sender, payload.From)

    const subject = firstString(payload.subject, payload.Subject)

    console.log('[MailgunInbound] Email details:', {
      recipient,
      from,
      subject
    })

    if (!recipient) {
      console.error('[MailgunInbound] No recipient found in payload')
      return { ok: true, error: 'No recipient' }
    }

    // Extract bare email address (handle "Name <email@domain.com>" format)
    const { extractEmail } = await import('../../utils/mailgunHelpers')
    const recipientEmail = extractEmail(recipient)

    if (!recipientEmail) {
      console.error('[MailgunInbound] Could not extract email from recipient:', recipient)
      return { ok: true, error: 'Invalid recipient format' }
    }

    // Extract domain from recipient
    const recipientDomain = recipientEmail.split('@')[1]?.toLowerCase()
    if (!recipientDomain) {
      console.error('[MailgunInbound] No domain found in recipient email:', recipientEmail)
      return { ok: true, error: 'Invalid recipient email' }
    }

    console.log('[MailgunInbound] Recipient domain:', recipientDomain)

    // Look up team by domain
    const { getIdentity } = await import('../../features/team/storage')
    const identity = await getIdentity()
    const team = identity.teams.find((t) => t.domain?.toLowerCase() === recipientDomain)

    if (!team) {
      console.warn('[MailgunInbound] No team found for domain:', recipientDomain)
      return { ok: true, error: 'Team not found for domain' }
    }

    console.log('[MailgunInbound] ✓ Found team:', {
      teamId: team.id,
      teamName: team.name,
      domain: recipientDomain
    })

    // ═══════════════════════════════════════════════════════════════════
    // RELAY TO TEAM INBOUND HANDLER
    // ═══════════════════════════════════════════════════════════════════

    console.log(
      `[MailgunInbound] 📤 Relaying to team inbound handler: /api/team/${team.id}/inbound`
    )

    try {
      // Forward relevant original headers plus our custom ones
      const originalHeaders = getHeaders(event)
      const forwardedHeaders = {
        // Forward important Mailgun headers
        'Message-Id': originalHeaders['message-id'] || originalHeaders['Message-Id'],
        From: originalHeaders['from'] || originalHeaders['From'],
        To: originalHeaders['to'] || originalHeaders['To'],
        Subject: originalHeaders['subject'] || originalHeaders['Subject'],
        Date: originalHeaders['date'] || originalHeaders['Date'],
        // Forward authentication headers
        Authorization: originalHeaders['authorization'] || originalHeaders['Authorization'],
        'X-Mailgun-Signature':
          originalHeaders['x-mailgun-signature'] || originalHeaders['X-Mailgun-Signature'],
        'X-Mailgun-Timestamp':
          originalHeaders['x-mailgun-timestamp'] || originalHeaders['X-Mailgun-Timestamp'],
        'X-Mailgun-Token':
          receivedToken || originalHeaders['x-mailgun-token'] || originalHeaders['X-Mailgun-Token'],
        // Our custom headers
        'x-forwarded-by': 'mailgun-inbound',
        'x-source-domain': recipientDomain,
        'x-team-id': team.id,
        'x-user-id': '1', // Default user ID for mailgun requests
        'Content-Type': 'application/json'
      }

      const response = await $fetch(`/api/team/${team.id}/inbound`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: forwardedHeaders
      })

      console.log('[MailgunInbound] ✓ Successfully relayed to team handler')

      return {
        ok: true,
        teamId: team.id,
        domain: recipientDomain,
        relayed: true,
        response
      }
    } catch (error) {
      console.error('[MailgunInbound] Failed to relay to team handler:', error)
      return {
        ok: true,
        error: 'Failed to relay to team handler',
        details: error
      }
    }
  } catch (error) {
    console.error('[MailgunInbound] Unexpected error:', error)
    return { ok: true, error: 'Internal server error' }
  }
})
