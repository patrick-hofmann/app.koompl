/**
 * Mailgun Authentication Utilities
 *
 * Provides reusable functions for verifying Mailgun webhook authentication
 * across all inbound email handlers.
 */

/**
 * Verify Mailgun token authentication
 * @param receivedToken - Token from the payload or header
 * @param context - Context for logging (e.g., 'MailgunInbound', 'TeamInbound')
 * @returns Object with success status and error message if failed
 */
export function verifyMailgunToken(
  receivedToken: string | undefined,
  context: string
): {
  success: boolean
  error?: string
} {
  const config = useRuntimeConfig()
  const expectedToken = config.mailgun?.token

  if (!expectedToken) {
    console.warn(`[${context}] No MAILGUN_TOKEN configured - skipping authentication`)
    return { success: true }
  }

  if (!receivedToken) {
    console.error(`[${context}] No token provided`)
    return {
      success: false,
      error: 'Authentication required'
    }
  }

  if (receivedToken !== expectedToken) {
    console.error(
      `[${context}] Token mismatch - received: ${receivedToken}, expected: ${expectedToken}`
    )
    return {
      success: false,
      error: 'Invalid token'
    }
  }

  console.log(`[${context}] ✓ Token authentication successful`)
  return { success: true }
}

/**
 * Extract token from payload or headers
 * @param payload - The request payload
 * @param headers - The request headers
 * @returns The token string if found, undefined otherwise
 */
export function extractMailgunToken(
  payload: Record<string, unknown> | undefined,
  headers: Record<string, string | string[] | undefined>
): string | undefined {
  // First try to get from payload
  if (payload?.token) {
    return String(payload.token)
  }

  // Then try to get from headers
  const headerToken = headers['x-mailgun-token'] || headers['X-Mailgun-Token']
  if (headerToken) {
    return Array.isArray(headerToken) ? headerToken[0] : headerToken
  }

  return undefined
}
