/**
 * Dedicated route for sending outbound emails via Mailgun
 * This route handles ONLY real outgoing emails that are actually sent
 */

import type { Agent } from '~/types'
import { mailStorage } from '../../utils/mailStorage'
import { agentLogger } from '../../utils/agentLogging'
import { determineMailgunDomain, sendMailgunMessage } from '../../utils/mailgunHelpers'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const mailgunKey = config?.mailgun?.key
    const configuredDomain = (config as { mailgun?: { domain?: string } }).mailgun?.domain
    const isProduction = process.env.NODE_ENV === 'production'

    if (isProduction && !mailgunKey) {
      throw createError({ statusCode: 500, statusMessage: 'Mailgun configuration missing' })
    }

    const body = await readBody<{
      from: string
      to: string
      subject: string
      text: string
      html?: string
      agentId: string
      agentEmail: string
      mcpServerIds?: string[]
      mcpContextCount?: number
      isAutomatic?: boolean
    }>(event)

    const {
      from,
      to,
      subject,
      text,
      html,
      agentId,
      agentEmail,
      mcpServerIds,
      mcpContextCount,
      isAutomatic
    } = body

    if (!from || !to || !subject || !text) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: from, to, subject, text'
      })
    }

    if (!agentId || !agentEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing agent information: agentId, agentEmail'
      })
    }

    let messageId: string
    let mailgunSent = false
    let mailgunResponse: { id?: string; message?: string } | undefined

    if (isProduction) {
      // Determine domain for Mailgun endpoint
      const domain = determineMailgunDomain(configuredDomain, from)
      if (!domain) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Unable to determine Mailgun domain from config or from address'
        })
      }

      try {
        mailgunResponse = await sendMailgunMessage({
          endpointDomain: domain,
          apiKey: mailgunKey as string,
          from,
          to,
          subject,
          text,
          html,
          tracking: false
        })
        mailgunSent = true
      } catch (err: unknown) {
        const e = err as {
          response?: { status?: number; statusText?: string; _data?: unknown }
          status?: number
          statusText?: string
          data?: unknown
        }
        const status =
          e?.response?.status ||
          e?.status ||
          (e as { data?: { status?: number } })?.data?.status ||
          'unknown'
        const statusText = e?.response?.statusText || e?.statusText || 'unknown'
        const data = e?.response?._data || (e as { data?: unknown })?.data || null
        console.error('Outbound email error: Mailgun request failed', {
          domain,
          to,
          from,
          subject,
          status,
          statusText,
          data
        })
        throw err
      }

      messageId =
        (mailgunResponse as { id?: string } | undefined)?.id ||
        `mg-${Date.now()}-${Math.random().toString(36).slice(2)}`
    } else {
      messageId = `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
      console.log(`[Outbound] (dev) Skipping Mailgun send, generated message ID: ${messageId}`)
    }

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
      mailgunSent,
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
          mailgunSent,
          isAutomatic: Boolean(isAutomatic),
          mcpContextCount: mcpContextCount || 0
        }
      })
    } catch (logErr) {
      console.error('Failed to log outbound email activity:', logErr)
    }

    if (!isProduction) {
      const agentsStorage = useStorage('agents')
      const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
      const recipientEmail = extractEmail(to)
      const recipientAgent = agents.find((a) => a?.email?.toLowerCase().trim() === recipientEmail)

      if (recipientAgent) {
        const port = process.env.PORT || 3000
        console.log(
          `[Outbound] (dev) Scheduling synthetic inbound delivery to ${recipientAgent.email}`
        )

        setImmediate(async () => {
          try {
            const payload: Record<string, unknown> = {
              recipient: recipientAgent.email,
              to: recipientAgent.email,
              To: recipientAgent.email,
              'Message-Id': messageId,
              'message-id': messageId,
              sender: from,
              from,
              From: from,
              subject,
              Subject: subject,
              'stripped-text': text,
              text,
              'body-plain': text
            }

            if (html) {
              payload['stripped-html'] = html
              payload['html'] = html
              payload['body-html'] = html
            }

            await $fetch(`http://localhost:${port}/api/mailgun/inbound`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })

            console.log(`[Outbound] (dev) Synthetic inbound delivered to ${recipientAgent.email}`)
          } catch (error) {
            console.error('[Outbound] ✗ Synthetic inbound delivery failed:', error)
          }
        })
      }
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

function extractEmail(value: string): string {
  const match = value.match(/<([^>]+)>/)
  if (match) {
    return match[1].trim().toLowerCase()
  }
  return value.trim().toLowerCase()
}
