/**
 * Dedicated route for sending outbound emails via Mailgun
 * This route handles ONLY real outgoing emails that are actually sent
 */

import { mailStorage } from '../../utils/mailStorage'
import { agentLogger } from '../../utils/agentLogging'
import { determineMailgunDomain, sendMailgunMessage } from '../../utils/mailgunHelpers'

export default defineEventHandler(async event => {
  try {
    const config = useRuntimeConfig()
    const mailgunKey = config?.mailgun?.key
    const configuredDomain = (config as { mailgun?: { domain?: string } }).mailgun?.domain

    if (!mailgunKey) {
      throw createError({ statusCode: 500, statusMessage: 'Mailgun configuration missing' })
    }

    const body = await readBody<{
      from: string;
      to: string;
      subject: string;
      text: string;
      html?: string;
      agentId: string;
      agentEmail: string;
      mcpServerIds?: string[];
      mcpContextCount?: number;
      isAutomatic?: boolean
    }>(event)

    const { from, to, subject, text, html, agentId, agentEmail, mcpServerIds, mcpContextCount, isAutomatic } = body

    if (!from || !to || !subject || !text) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required fields: from, to, subject, text' })
    }

    if (!agentId || !agentEmail) {
      throw createError({ statusCode: 400, statusMessage: 'Missing agent information: agentId, agentEmail' })
    }

    // Determine domain for Mailgun endpoint
    const domain = determineMailgunDomain(configuredDomain, from)
    if (!domain) {
      throw createError({ statusCode: 400, statusMessage: 'Unable to determine Mailgun domain from config or from address' })
    }

    type MailgunSendResponse = { id?: string; message?: string }
    let mailgunResponse: MailgunSendResponse | undefined
    try {
      mailgunResponse = await sendMailgunMessage({
        endpointDomain: domain,
        apiKey: mailgunKey,
        from,
        to,
        subject,
        text,
        html,
        tracking: false
      })
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; statusText?: string; _data?: unknown }; status?: number; statusText?: string; data?: unknown }
      const status = e?.response?.status || e?.status || (e as { data?: { status?: number } })?.data?.status || 'unknown'
      const statusText = e?.response?.statusText || e?.statusText || 'unknown'
      const data = e?.response?._data || (e as { data?: unknown })?.data || null
      console.error('Outbound email error: Mailgun request failed', { domain, to, from, subject, status, statusText, data })
      throw err
    }

    const messageId = (mailgunResponse as MailgunSendResponse | undefined)?.id || `mg-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Store the outbound email in unified storage (only real outgoing emails)
    await mailStorage.storeOutboundEmail({
      messageId,
      from,
      to,
      subject,
      body: text,
      agentId,
      agentEmail,
      usedOpenAI: true, // Assuming all outbound emails use AI
      mailgunSent: true, // This email was actually sent via Mailgun
      mcpServerIds: mcpServerIds || [],
      mcpContextCount: mcpContextCount || 0,
      isAutomatic: isAutomatic || false
    })

    // Log email activity for outbound message
    try {
      await agentLogger.logEmailActivity({
        agentId,
        agentEmail,
        direction: 'outbound',
        email: {
          messageId,
          from,
          to,
          subject,
          body: text
        },
        metadata: {
          mailgunSent: true,
          isAutomatic: Boolean(isAutomatic),
          mcpContextCount: mcpContextCount || 0
        }
      })
    } catch (logErr) {
      console.error('Failed to log outbound email activity:', logErr)
    }
    return {
      ok: true,
      messageId,
      mailgunResponse
    }
  } catch (error) {
    console.error('Outbound email error:', error)
    return {
      ok: false,
      error: String(error)
    }
  }
})
