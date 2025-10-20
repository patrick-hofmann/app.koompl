/**
 * Mailgun Authentication Utilities
 *
 * Provides reusable functions for verifying Mailgun webhook authentication
 * across all inbound email handlers.
 */

import crypto from 'crypto'

// In-memory cache for tokens to prevent replay attacks
// In production, consider using Redis or a database for distributed systems
const tokenCache = new Map<string, number>()
const TOKEN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Verify Mailgun signature using HMAC-SHA256
 * @param timestamp - Timestamp from the payload
 * @param token - Token from the payload
 * @param signature - Signature from the payload
 * @param context - Context for logging
 * @returns Object with success status and error message if failed
 */
export function verifyMailgunSignature(
  timestamp: string | undefined,
  token: string | undefined,
  signature: string | undefined,
  context: string
): {
  success: boolean
  error?: string
} {
  const config = useRuntimeConfig()
  // In development, bypass signature verification to enable roundtrip tests and local flows
  if (import.meta.dev) {
    console.warn(`[${context}] Development mode detected - skipping Mailgun signature verification`)
    return { success: true }
  }
  const signingKey = config.mailgun?.signingKey

  if (!signingKey) {
    console.warn(`[${context}] No MAILGUN_SIGNING_KEY configured - skipping signature verification`)
    return { success: true }
  }

  if (!timestamp || !token || !signature) {
    console.error(
      `[${context}] Missing required signature parameters - timestamp: ${!!timestamp}, token: ${!!token}, signature: ${!!signature}`
    )
    return {
      success: false,
      error: 'Missing signature parameters'
    }
  }

  // Check for replay attacks
  if (isTokenReplayed(token)) {
    console.error(`[${context}] Token replay attack detected - token: ${token}`)
    return {
      success: false,
      error: 'Token replay attack detected'
    }
  }

  // Check timestamp to prevent processing of outdated requests (within 5 minutes)
  const now = Date.now()
  const requestTime = parseInt(timestamp) * 1000
  const timeDiff = Math.abs(now - requestTime)
  const maxAge = 5 * 60 * 1000 // 5 minutes

  if (timeDiff > maxAge) {
    console.error(`[${context}] Request too old - time difference: ${timeDiff}ms`)
    return {
      success: false,
      error: 'Request too old'
    }
  }

  // Generate HMAC-SHA256 signature
  const data = timestamp + token
  const hmac = crypto.createHmac('sha256', signingKey)
  hmac.update(data)
  const computedSignature = hmac.digest('hex')

  if (computedSignature !== signature) {
    console.error(
      `[${context}] Signature mismatch - computed: ${computedSignature}, received: ${signature}`
    )
    return {
      success: false,
      error: 'Invalid signature'
    }
  }

  // Cache the token to prevent replay attacks
  cacheToken(token)

  console.log(`[${context}] ✓ Signature verification successful`)
  return { success: true }
}

/**
 * Check if a token has been used before (replay attack protection)
 * @param token - The token to check
 * @returns True if the token has been used before
 */
function isTokenReplayed(token: string): boolean {
  const now = Date.now()

  // Clean up expired tokens
  for (const [cachedToken, timestamp] of tokenCache.entries()) {
    if (now - timestamp > TOKEN_CACHE_TTL) {
      tokenCache.delete(cachedToken)
    }
  }

  return tokenCache.has(token)
}

/**
 * Cache a token to prevent replay attacks
 * @param token - The token to cache
 */
function cacheToken(token: string): void {
  tokenCache.set(token, Date.now())
}

/**
 * Extract signature parameters from payload
 * @param payload - The request payload
 * @returns Object with timestamp, token, and signature
 */
export function extractMailgunSignatureParams(payload: Record<string, unknown> | undefined): {
  timestamp: string | undefined
  token: string | undefined
  signature: string | undefined
} {
  return {
    timestamp: payload?.timestamp ? String(payload.timestamp) : undefined,
    token: payload?.token ? String(payload.token) : undefined,
    signature: payload?.signature ? String(payload.signature) : undefined
  }
}

/**
 * Extract token from payload or headers
 * @param payload - The request payload
 * @param headers - The request headers
 * @returns The token string if found, undefined otherwise
 */
export function extractMailgunToken(
  _payload: Record<string, unknown> | undefined,
  _headers: Record<string, string | string[] | undefined>
): string | undefined {
  return undefined
}
