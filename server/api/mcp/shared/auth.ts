import { createError, getRequestHeaders, getRequestHeader } from 'h3'
import type { H3Event } from 'h3'

/**
 * Development mode debug token
 * Set this in your environment or use the default for local testing
 */
const DEBUG_AUTH_TOKEN = process.env.MCP_DEBUG_TOKEN || 'debug-mcp-local-dev-token'

/**
 * Default IDs for development mode
 */
const DEV_TEAM_ID = process.env.MCP_DEV_TEAM_ID || '1'
const DEV_USER_ID = process.env.MCP_DEV_USER_ID || '1'

interface McpAuthResult {
  teamId: string
  userId: string
  isDevelopmentMode: boolean
}

/**
 * Authenticate MCP requests with support for:
 * 1. Production: x-team-id and x-user-id headers
 * 2. Development: Bearer token for localhost testing
 */
export async function authenticateMcpRequest(event: H3Event): Promise<McpAuthResult> {
  const headers = getRequestHeaders(event)
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Check if authentication is disabled for inbound requests
  const disableInboundAuth = process.env.DISABLE_INBOUND_AUTH === 'true'
  const isVercelDeployment =
    process.env.VERCEL_URL || process.env.NUXT_PUBLIC_BASE_URL?.includes('vercel.app')

  if (disableInboundAuth || isVercelDeployment) {
    console.log(
      `[MCP Auth] Inbound authentication disabled via ${disableInboundAuth ? 'DISABLE_INBOUND_AUTH=true' : 'Vercel deployment detected'}`
    )
    return {
      teamId: String(headers['x-team-id'] || '1'),
      userId: String(headers['x-user-id'] || '1'),
      isDevelopmentMode: true
    }
  }

  // Check if this is a relayed request from mailgun inbound (bypass auth)
  const forwardedBy = getRequestHeader(event, 'x-forwarded-by')
  if (forwardedBy === 'mailgun-inbound' || forwardedBy === 'mcp-agent-service') {
    console.log(`[MCP Auth] Relayed request from ${forwardedBy}: bypassing authentication`)
    return {
      teamId: String(headers['x-team-id'] || '1'),
      userId: String(headers['x-user-id'] || '1'),
      isDevelopmentMode: true
    }
  }

  // Check for debug authorization bearer token (development only)
  if (isDevelopment) {
    const authHeader = getRequestHeader(event, 'authorization')

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)

      if (token === DEBUG_AUTH_TOKEN) {
        console.log('[MCP Auth] Development mode: Using debug token')
        return {
          teamId: DEV_TEAM_ID,
          userId: DEV_USER_ID,
          isDevelopmentMode: true
        }
      }
    }

    // In development, allow localhost without auth
    const host = getRequestHeader(event, 'host')
    if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
      const teamId = headers['x-team-id']
      const userId = headers['x-user-id']

      // If headers are provided, use them
      if (teamId && userId) {
        console.log('[MCP Auth] Development mode: Using provided headers')
        return {
          teamId: String(teamId),
          userId: String(userId),
          isDevelopmentMode: true
        }
      }

      // Otherwise, use defaults
      console.log('[MCP Auth] Development mode: Using default IDs for localhost')
      return {
        teamId: DEV_TEAM_ID,
        userId: DEV_USER_ID,
        isDevelopmentMode: true
      }
    }
  }

  // Production mode: require headers
  const headerTeamId = headers['x-team-id']
  const headerUserId = headers['x-user-id']

  if (!headerTeamId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing x-team-id header'
    })
  }

  if (!headerUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing x-user-id header'
    })
  }

  return {
    teamId: String(headerTeamId),
    userId: String(headerUserId),
    isDevelopmentMode: false
  }
}

/**
 * Get session validation mode based on environment
 */
export function shouldValidateSession(event: H3Event): boolean {
  const isDevelopment = process.env.NODE_ENV === 'development'

  // In development, skip session validation for localhost
  if (isDevelopment) {
    const host = getRequestHeader(event, 'host')
    if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
      return false
    }
  }

  // Always validate in production
  return true
}
