/**
 * Message Router - Email Routing and Matching
 *
 * Routes incoming emails to the appropriate handler and matches responses to flows.
 * Handles agent-to-agent and agent-to-user communication.
 */

import type { AgentFlow } from '../types/agent-flows'
import { agentFlowEngine } from './agentFlowEngine'
import { agentLogger } from './agentLogging'

export interface InboundEmail {
  messageId: string
  from: string
  to: string
  subject: string
  body: string
  receivedAt: string
}

export class MessageRouter {
  /**
   * Route an incoming email to the appropriate handler
   * - If it's a response to one of this agent's flows: resume that flow
   * - If it's a new request: handle as new (caller decides to start flow or single-round)
   */
  async routeInboundEmail(email: InboundEmail, agentId: string): Promise<{
    isFlowResponse: boolean
    flow?: AgentFlow
  }> {
    console.log(`[MessageRouter] Routing email for agent ${agentId}`)

    // Check if this is a response to THIS AGENT's active flow
    const flow = await this.matchEmailToFlow(email, agentId)

    if (flow) {
      console.log(`[MessageRouter] Email matched to flow ${flow.id}`)
      return { isFlowResponse: true, flow }
    }

    console.log(`[MessageRouter] Email is a new request for agent ${agentId}`)
    return { isFlowResponse: false }
  }

  /**
   * Send an email from one agent to another
   * IMPORTANT: This includes a request ID for tracking responses
   */
  async sendAgentToAgentEmail(params: {
    fromAgentEmail: string
    toAgentEmail: string
    subject: string
    body: string
    flowId: string
    requestId: string
  }): Promise<string> {
    console.log(`\n[MessageRouter] ════════════════════════════════════════════`)
    console.log(`[MessageRouter] 📧 AGENT-TO-AGENT EMAIL`)
    console.log(`[MessageRouter] From: ${params.fromAgentEmail}`)
    console.log(`[MessageRouter] To: ${params.toAgentEmail}`)
    console.log(`[MessageRouter] Subject: [Req: ${params.requestId}] ${params.subject}`)
    console.log(`[MessageRouter] Flow ID: ${params.flowId}`)
    console.log(`[MessageRouter] ════════════════════════════════════════════`)

    // Get agent details by email
    console.log(`[MessageRouter] → Looking up agents...`)
    const fromAgent = await this.getAgentByEmail(params.fromAgentEmail)
    const toAgent = await this.getAgentByEmail(params.toAgentEmail)

    if (!fromAgent || !toAgent) {
      console.error(`[MessageRouter] ✗ Agent lookup failed:`)
      console.error(`[MessageRouter]   From agent (${params.fromAgentEmail}): ${fromAgent ? '✓ found' : '✗ NOT FOUND'}`)
      console.error(`[MessageRouter]   To agent (${params.toAgentEmail}): ${toAgent ? '✓ found' : '✗ NOT FOUND'}`)
      throw createError({
        statusCode: 404,
        statusMessage: 'One or both agents not found'
      })
    }

    console.log(`[MessageRouter] ✓ Both agents found`)
    console.log(`[MessageRouter]   From: ${fromAgent.name} <${fromAgent.email}>`)
    console.log(`[MessageRouter]   To: ${toAgent.name} <${toAgent.email}>`)

    // Check if fromAgent is allowed to communicate with toAgent
    if (fromAgent.multiRoundConfig?.canCommunicateWithAgents) {
      let allowedEmails = fromAgent.multiRoundConfig.allowedAgentEmails || []

      // Migration: if allowedAgentEmails is empty but allowedAgentIds exists, convert IDs to emails
      if (allowedEmails.length === 0 && (fromAgent.multiRoundConfig as Record<string, unknown>).allowedAgentIds) {
        const agentsStorage = useStorage('agents')
        const allAgents = await agentsStorage.getItem<Array<{
          id?: string
          email?: string
        }>>('agents.json') || []

        const oldIds = (fromAgent.multiRoundConfig as Record<string, unknown>).allowedAgentIds as string[]
        allowedEmails = oldIds
          .map((id) => {
            const foundAgent = allAgents.find(a => a?.id === id)
            return foundAgent?.email?.toLowerCase()
          })
          .filter((email): email is string => !!email)

        console.log(`[MessageRouter Migration] Converted ${oldIds.length} agent IDs to ${allowedEmails.length} emails`)
      }

      if (allowedEmails.length > 0 && !allowedEmails.includes(params.toAgentEmail.toLowerCase())) {
        console.error(`[MessageRouter] ✗ Permission denied:`)
        console.error(`[MessageRouter]   ${fromAgent.name} is only allowed to contact: ${allowedEmails.join(', ')}`)
        console.error(`[MessageRouter]   Attempted to contact: ${params.toAgentEmail}`)
        throw createError({
          statusCode: 403,
          statusMessage: `Agent ${params.fromAgentEmail} is not allowed to communicate with ${params.toAgentEmail}`
        })
      }

      console.log(`[MessageRouter] ✓ Permission check passed`)
      if (allowedEmails.length > 0) {
        console.log(`[MessageRouter]   Allowed agents: ${allowedEmails.join(', ')}`)
      } else {
        console.log(`[MessageRouter]   Can contact: ALL agents`)
      }
    } else {
      console.error(`[MessageRouter] ✗ Inter-agent communication is disabled for ${fromAgent.name}`)
      throw createError({
        statusCode: 403,
        statusMessage: `Agent ${params.fromAgentEmail} does not have inter-agent communication enabled`
      })
    }

    // Format subject with request ID
    const subjectWithReqId = `[Req: ${params.requestId}] ${params.subject}`

    // Compose email
    const from = `${fromAgent.name} <${fromAgent.email}>`
    const to = toAgent.email
    const subject = subjectWithReqId
    const body = params.body

    // Send via Mailgun
    console.log(`[MessageRouter] → Sending via Mailgun...`)
    const messageId = await this.sendEmailViaMailgun({
      from,
      to,
      subject,
      text: body
    })

    console.log(`[MessageRouter] ✓ Email sent successfully`)
    console.log(`[MessageRouter]   Message ID: ${messageId}`)
    console.log(`[MessageRouter] ════════════════════════════════════════════\n`)

    // Log activity
    try {
      await agentLogger.logEmailActivity({
        agentId: fromAgent.id,
        agentEmail: fromAgent.email,
        direction: 'outbound',
        email: {
          messageId,
          from,
          to,
          subject,
          body
        },
        metadata: {
          mailgunSent: true,
          isAutomatic: true,
          mcpContextCount: 0,
          requestId: params.requestId,
          targetAgent: params.toAgentId,
          flowId: params.flowId
        }
      })
    } catch (error) {
      console.error('[MessageRouter] Failed to log email activity:', error)
    }

    // For agent-to-agent emails, simulate immediate inbound delivery
    // since Mailgun won't webhook back for internal agent addresses
    console.log(`[MessageRouter] → Simulating inbound delivery to ${params.toAgentEmail}...`)

    try {
      console.log(`[MessageRouter] ✓ Target agent: ${toAgent.name}`)

      // Store as inbound email
      await mailStorage.storeInboundEmail({
        messageId,
        from,
        to: toAgent.email,
        subject,
        body,
        html: '',
        agentId: toAgent.id,
        agentEmail: toAgent.email,
        mcpContexts: [],
        rawPayload: {}
      })

      // Log inbound activity
      await agentLogger.logEmailActivity({
        agentId: toAgent.id,
        agentEmail: toAgent.email,
        direction: 'inbound',
        email: {
          messageId,
          from,
          to: toAgent.email,
          subject,
          body
        },
        metadata: {
          mailgunSent: false,
          isAutomatic: true,
          mcpContextCount: 0
        }
      })

      console.log(`[MessageRouter] ✓ Stored as inbound email for ${toAgent.name}`)
      console.log(`[MessageRouter] → Processing inbound email...`)

      // Route the email to determine if it's a flow response or new request
      const routingResult = await this.routeInboundEmail({
        messageId,
        from,
        to: toAgent.email,
        subject,
        body,
        receivedAt: new Date().toISOString()
      }, toAgent.id)

      console.log(`[MessageRouter] → Routing result: isFlowResponse=${routingResult.isFlowResponse}`)

      if (routingResult.isFlowResponse && routingResult.flow) {
        // This is a response to one of this agent's flows - resume it
        console.log(`[MessageRouter] ✓ This is a RESPONSE to existing flow ${routingResult.flow.id}`)
        console.log(`[MessageRouter] → Resuming flow...`)

        await agentFlowEngine.resumeFlow(routingResult.flow.id, {
          type: 'email_response',
          email: {
            messageId,
            from,
            subject,
            body
          }
        }, toAgent.id)

        console.log(`[MessageRouter] ✓ Flow resumed successfully`)
      } else {
        // This is a NEW request for this agent
        console.log(`[MessageRouter] ✓ This is a NEW REQUEST for agent ${toAgent.name}`)

        // Check if agent has multi-round enabled
        if (toAgent.multiRoundConfig?.enabled) {
          console.log(`[MessageRouter] → Starting new multi-round flow...`)

          const flow = await agentFlowEngine.startFlow({
            agentId: toAgent.id,
            trigger: {
              type: 'email',
              messageId,
              from,
              to: toAgent.email,
              subject,
              body,
              receivedAt: new Date().toISOString()
            },
            maxRounds: (toAgent.multiRoundConfig as { maxRounds?: number }).maxRounds || 10,
            timeoutMinutes: (toAgent.multiRoundConfig as { timeoutMinutes?: number }).timeoutMinutes || 60
          })

          console.log(`[MessageRouter] ✓ Flow created: ${flow.id}`)
          console.log(`[MessageRouter] → Executing first round...`)

          // Execute first round
          await agentFlowEngine.executeRound(flow.id, toAgent.id)

          console.log(`[MessageRouter] ✓ First round executed for ${toAgent.name}`)
        } else {
          // Agent doesn't have multi-round - use single-round processing
          console.log(`[MessageRouter] ⚠ Agent ${toAgent.name} does not have multi-round enabled`)
          console.log(`[MessageRouter] → Using single-round processing...`)

          try {
            // Call the agent's respond endpoint
            const respondUrl = `http://localhost:${process.env.PORT || 3000}/api/agents/${toAgent.id}/respond`
            console.log(`[MessageRouter] → Calling respond endpoint: ${respondUrl}`)

            const response = await $fetch<{ ok: boolean, result?: string, error?: string }>(respondUrl, {
              method: 'POST',
              body: {
                subject,
                text: body,
                from,
                includeQuote: true,
                maxTokens: 700,
                temperature: 0.4
              }
            })

            if (response.ok && response.result) {
              console.log(`[MessageRouter] ✓ Got AI response from ${toAgent.name}`)

              // Format the response with quote
              const quoted = body
                .split('\n')
                .map(line => `> ${line}`)
                .join('\n')
              const responseBody = `${response.result}\n\nOn ${new Date().toISOString()}, ${from} wrote:\n${quoted}`

              // Prepare reply subject - KEEP the request ID so sender can match it to their waiting flow
              const replySubject = `Re: ${subject.replace(/^Re:\s*/i, '')}`

              // Send reply back to the original sender
              console.log(`[MessageRouter] → Sending reply back to ${from}`)
              console.log(`[MessageRouter]   Subject: ${replySubject}`)

              const outboundUrl = `http://localhost:${process.env.PORT || 3000}/api/mailgun/outbound`
              const replyMessageId = await $fetch<{ messageId?: string }>(outboundUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  from: `${toAgent.name} <${toAgent.email}>`,
                  to: from,
                  subject: replySubject,
                  text: responseBody,
                  agentId: toAgent.id,
                  agentEmail: toAgent.email,
                  mcpServerIds: [],
                  mcpContextCount: 0,
                  isAutomatic: true
                })
              }).then(res => res.messageId || 'unknown')

              console.log(`[MessageRouter] ✓ Reply sent, message ID: ${replyMessageId}`)

              // Schedule async inbound delivery simulation for local dev
              // In production, this would come via Mailgun webhook
              // We use setImmediate to break the call stack and make it truly async
              console.log(`[MessageRouter] → Scheduling async inbound delivery simulation...`)

              setImmediate(async () => {
                try {
                  console.log(`\n[MessageRouter:Async] ════════════════════════════════════════════`)
                  console.log(`[MessageRouter:Async] 📬 SIMULATING WEBHOOK: Reply delivery to ${from}`)
                  console.log(`[MessageRouter:Async] ════════════════════════════════════════════`)

                  const fromAgentEmail = this.extractEmail(from)
                  const recipientAgent = await this.getAgentByEmail(fromAgentEmail)

                  if (recipientAgent) {
                    console.log(`[MessageRouter:Async] ✓ Recipient agent found: ${recipientAgent.name}`)

                    // Store as inbound email for the recipient
                    await mailStorage.storeInboundEmail({
                      messageId: replyMessageId,
                      from: `${toAgent.name} <${toAgent.email}>`,
                      to: from,
                      subject: replySubject,
                      body: responseBody,
                      html: '',
                      agentId: recipientAgent.id,
                      agentEmail: recipientAgent.email,
                      mcpContexts: [],
                      rawPayload: {}
                    })

                    // Log inbound activity
                    await agentLogger.logEmailActivity({
                      agentId: recipientAgent.id,
                      agentEmail: recipientAgent.email,
                      direction: 'inbound',
                      email: {
                        messageId: replyMessageId,
                        from: `${toAgent.name} <${toAgent.email}>`,
                        to: from,
                        subject: replySubject,
                        body: responseBody
                      },
                      metadata: {
                        mailgunSent: false,
                        isAutomatic: true,
                        mcpContextCount: 0
                      }
                    })

                    console.log(`[MessageRouter:Async] ✓ Stored reply as inbound for ${recipientAgent.name}`)

                    // Route to see if this is a flow response
                    const replyRoutingResult = await this.routeInboundEmail({
                      messageId: replyMessageId,
                      from: `${toAgent.name} <${toAgent.email}>`,
                      to: from,
                      subject: replySubject,
                      body: responseBody,
                      receivedAt: new Date().toISOString()
                    }, recipientAgent.id)

                    if (replyRoutingResult.isFlowResponse && replyRoutingResult.flow) {
                      console.log(`[MessageRouter:Async] ✓ Reply matched to flow ${replyRoutingResult.flow.id}`)
                      console.log(`[MessageRouter:Async] → Resuming recipient's flow...`)

                      await agentFlowEngine.resumeFlow(replyRoutingResult.flow.id, {
                        type: 'email_response',
                        email: {
                          messageId: replyMessageId,
                          from: `${toAgent.name} <${toAgent.email}>`,
                          subject: replySubject,
                          body: responseBody
                        }
                      }, recipientAgent.id)

                      console.log(`[MessageRouter:Async] ✓ Recipient's flow resumed successfully`)
                      console.log(`[MessageRouter:Async] ════════════════════════════════════════════\n`)
                    } else {
                      console.log(`[MessageRouter:Async] ⚠ Reply did not match any waiting flow`)
                      console.log(`[MessageRouter:Async] ════════════════════════════════════════════\n`)
                    }
                  } else {
                    console.warn(`[MessageRouter:Async] ⚠ Recipient agent not found for ${fromAgentEmail}`)
                    console.log(`[MessageRouter:Async] ════════════════════════════════════════════\n`)
                  }
                } catch (error) {
                  console.error(`[MessageRouter:Async] ✗ Async inbound delivery failed:`, error)
                }
              })

              console.log(`[MessageRouter] ✓ Single-round processing complete for ${toAgent.name}`)
            } else {
              console.error(`[MessageRouter] ✗ Failed to get AI response:`, response.error)
            }
          } catch (singleRoundError) {
            console.error(`[MessageRouter] ✗ Single-round processing failed:`, singleRoundError)
          }
        }
      }
    } catch (error) {
      console.error(`[MessageRouter] ✗ Failed to simulate inbound delivery:`, error)
    }

    return messageId
  }

  /**
   * Send email from agent to external user
   */
  async sendAgentToUserEmail(params: {
    fromAgentId: string
    toEmail: string
    subject: string
    body: string
    flowId?: string
  }): Promise<string> {
    console.log(`[MessageRouter] Sending email from agent ${params.fromAgentId} to user ${params.toEmail}`)

    // Get agent details
    const agent = await this.getAgent(params.fromAgentId)

    if (!agent) {
      throw createError({ statusCode: 404, statusMessage: 'Agent not found' })
    }

    // Compose email
    const from = `${agent.name} <${agent.email}>`
    const to = params.toEmail
    const subject = params.subject
    const body = params.body

    // Send via Mailgun
    const messageId = await this.sendEmailViaMailgun({
      from,
      to,
      subject,
      text: body
    })

    // Log activity
    try {
      await agentLogger.logEmailActivity({
        agentId: params.fromAgentId,
        agentEmail: agent.email,
        direction: 'outbound',
        email: {
          messageId,
          from,
          to,
          subject,
          body
        },
        metadata: {
          mailgunSent: true,
          isAutomatic: true,
          mcpContextCount: 0,
          flowId: params.flowId
        }
      })
    } catch (error) {
      console.error('[MessageRouter] Failed to log email activity:', error)
    }

    // Only simulate inbound delivery for agent-to-agent emails
    // External users will receive emails normally via Mailgun
    const toAgent = await this.getAgentByEmail(params.toEmail)
    if (toAgent) {
      // This is agent-to-agent email - simulate inbound delivery
      console.log(`[MessageRouter] → Simulating inbound delivery to ${params.toEmail}...`)

      try {
        console.log(`[MessageRouter] ✓ Target agent found: ${toAgent.name}`)

        // Store as inbound email
        await mailStorage.storeInboundEmail({
          messageId,
          from,
          to: params.toEmail,
          subject,
          body,
          html: '',
          agentId: toAgent.id,
          agentEmail: toAgent.email,
          mcpContexts: [],
          rawPayload: {}
        })

        // Log inbound activity
        await agentLogger.logEmailActivity({
          agentId: toAgent.id,
          agentEmail: toAgent.email,
          direction: 'inbound',
          email: {
            messageId,
            from,
            to: params.toEmail,
            subject,
            body
          },
          metadata: {
            mailgunSent: false,
            isAutomatic: true,
            mcpContextCount: 0
          }
        })

        console.log(`[MessageRouter] ✓ Stored as inbound email for ${toAgent.name}`)
        console.log(`[MessageRouter] → Processing inbound email...`)

        // Route the email to determine if it's a flow response or new request
        const routingResult = await this.routeInboundEmail({
          messageId,
          from,
          to: params.toEmail,
          subject,
          body,
          receivedAt: new Date().toISOString()
        }, toAgent.id)

        console.log(`[MessageRouter] → Routing result: isFlowResponse=${routingResult.isFlowResponse}`)

        if (routingResult.isFlowResponse && routingResult.flow) {
          // This is a response to one of this agent's flows - resume it
          console.log(`[MessageRouter] ✓ This is a RESPONSE to existing flow ${routingResult.flow.id}`)
          console.log(`[MessageRouter] → Resuming flow...`)

          await agentFlowEngine.resumeFlow(routingResult.flow.id, {
            type: 'email_response',
            email: {
              messageId,
              from,
              subject,
              body
            }
          }, toAgent.id)

          console.log(`[MessageRouter] ✓ Flow resumed successfully`)
        } else {
          // This is a NEW request for this agent
          console.log(`[MessageRouter] ✓ This is a NEW REQUEST for agent ${toAgent.name}`)

          // Check if agent has multi-round enabled
          if (toAgent.multiRoundConfig?.enabled) {
            console.log(`[MessageRouter] → Starting new multi-round flow...`)

            const flow = await agentFlowEngine.startFlow({
              agentId: toAgent.id,
              trigger: {
                type: 'email',
                messageId,
                from,
                to: params.toEmail,
                subject,
                body,
                receivedAt: new Date().toISOString()
              },
              maxRounds: (toAgent.multiRoundConfig as { maxRounds?: number }).maxRounds || 10,
              timeoutMinutes: (toAgent.multiRoundConfig as { timeoutMinutes?: number }).timeoutMinutes || 60
            })

            console.log(`[MessageRouter] ✓ Flow created: ${flow.id}`)
            console.log(`[MessageRouter] → Executing first round...`)

            // Execute first round
            await agentFlowEngine.executeRound(flow.id, toAgent.id)

            console.log(`[MessageRouter] ✓ First round executed for ${toAgent.name}`)
          } else {
            // Agent doesn't have multi-round - use single-round processing
            console.log(`[MessageRouter] ⚠ Agent ${toAgent.name} does not have multi-round enabled`)
            console.log(`[MessageRouter] → Using single-round processing...`)

            try {
              // Call the agent's respond endpoint
              const respondUrl = `http://localhost:${process.env.PORT || 3000}/api/agents/${toAgent.id}/respond`
              console.log(`[MessageRouter] → Calling respond endpoint: ${respondUrl}`)

              const response = await $fetch<{ ok: boolean, result?: string, error?: string }>(respondUrl, {
                method: 'POST',
                body: {
                  subject,
                  text: body,
                  from,
                  includeQuote: true,
                  maxTokens: 700,
                  temperature: 0.4
                }
              })

              if (response.ok && response.result) {
                console.log(`[MessageRouter] ✓ Got AI response from ${toAgent.name}`)

                // Format the response with quote
                const quoted = body
                  .split('\n')
                  .map(line => `> ${line}`)
                  .join('\n')
                const responseBody = `${response.result}\n\nOn ${new Date().toISOString()}, ${from} wrote:\n${quoted}`

                // Prepare reply subject - KEEP the request ID so sender can match it to their waiting flow
                const replySubject = `Re: ${subject.replace(/^Re:\s*/i, '')}`

                // Send reply back to the original sender
                console.log(`[MessageRouter] → Sending reply back to ${from}`)
                console.log(`[MessageRouter]   Subject: ${replySubject}`)

                const outboundUrl = `http://localhost:${process.env.PORT || 3000}/api/mailgun/outbound`
                const replyMessageId = await $fetch<{ messageId?: string }>(outboundUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    from: `${toAgent.name} <${toAgent.email}>`,
                    to: from,
                    subject: replySubject,
                    text: responseBody,
                    agentId: toAgent.id,
                    agentEmail: toAgent.email,
                    mcpServerIds: [],
                    mcpContextCount: 0,
                    isAutomatic: true
                  })
                }).then(res => res.messageId || 'unknown')

                console.log(`[MessageRouter] ✓ Reply sent, message ID: ${replyMessageId}`)

                // Log outbound activity for the replying agent (Bobby)
                try {
                  await agentLogger.logEmailActivity({
                    agentId: toAgent.id,
                    agentEmail: toAgent.email,
                    direction: 'outbound',
                    email: {
                      messageId: replyMessageId,
                      from: `${toAgent.name} <${toAgent.email}>`,
                      to: from,
                      subject: replySubject,
                      body: responseBody
                    },
                    metadata: {
                      mailgunSent: true,
                      isAutomatic: true,
                      mcpContextCount: 0
                    }
                  })
                  console.log(`[MessageRouter] ✓ Logged outbound email for ${toAgent.name}`)
                } catch (logError) {
                  console.error(`[MessageRouter] ✗ Failed to log outbound activity for ${toAgent.name}:`, logError)
                }

                // Schedule async inbound delivery simulation for local dev
                // In production, this would come via Mailgun webhook
                // We use setImmediate to break the call stack and make it truly async
                console.log(`[MessageRouter] → Scheduling async inbound delivery simulation...`)

                setImmediate(async () => {
                  try {
                    console.log(`\n[MessageRouter:Async] ════════════════════════════════════════════`)
                    console.log(`[MessageRouter:Async] 📬 SIMULATING WEBHOOK: Reply delivery to ${from}`)
                    console.log(`[MessageRouter:Async] ════════════════════════════════════════════`)

                    const fromAgentEmail = this.extractEmail(from)
                    const recipientAgent = await this.getAgentByEmail(fromAgentEmail)

                    if (recipientAgent) {
                      console.log(`[MessageRouter:Async] ✓ Recipient agent found: ${recipientAgent.name}`)

                      // Store as inbound email for the recipient
                      await mailStorage.storeInboundEmail({
                        messageId: replyMessageId,
                        from: `${toAgent.name} <${toAgent.email}>`,
                        to: from,
                        subject: replySubject,
                        body: responseBody,
                        html: '',
                        agentId: recipientAgent.id,
                        agentEmail: recipientAgent.email,
                        mcpContexts: [],
                        rawPayload: {}
                      })

                      // Log inbound activity
                      await agentLogger.logEmailActivity({
                        agentId: recipientAgent.id,
                        agentEmail: recipientAgent.email,
                        direction: 'inbound',
                        email: {
                          messageId: replyMessageId,
                          from: `${toAgent.name} <${toAgent.email}>`,
                          to: from,
                          subject: replySubject,
                          body: responseBody
                        },
                        metadata: {
                          mailgunSent: false,
                          isAutomatic: true,
                          mcpContextCount: 0
                        }
                      })

                      console.log(`[MessageRouter:Async] ✓ Stored reply as inbound for ${recipientAgent.name}`)

                      // Route to see if this is a flow response
                      const replyRoutingResult = await this.routeInboundEmail({
                        messageId: replyMessageId,
                        from: `${toAgent.name} <${toAgent.email}>`,
                        to: from,
                        subject: replySubject,
                        body: responseBody,
                        receivedAt: new Date().toISOString()
                      }, recipientAgent.id)

                      if (replyRoutingResult.isFlowResponse && replyRoutingResult.flow) {
                        console.log(`[MessageRouter:Async] ✓ Reply matched to flow ${replyRoutingResult.flow.id}`)
                        console.log(`[MessageRouter:Async] → Resuming recipient's flow...`)

                        await agentFlowEngine.resumeFlow(replyRoutingResult.flow.id, {
                          type: 'email_response',
                          email: {
                            messageId: replyMessageId,
                            from: `${toAgent.name} <${toAgent.email}>`,
                            subject: replySubject,
                            body: responseBody
                          }
                        }, recipientAgent.id)

                        console.log(`[MessageRouter:Async] ✓ Recipient's flow resumed successfully`)
                        console.log(`[MessageRouter:Async] ════════════════════════════════════════════\n`)
                      } else {
                        console.log(`[MessageRouter:Async] ⚠ Reply did not match any waiting flow`)
                        console.log(`[MessageRouter:Async] ════════════════════════════════════════════\n`)
                      }
                    } else {
                      console.warn(`[MessageRouter:Async] ⚠ Recipient agent not found for ${fromAgentEmail}`)
                      console.log(`[MessageRouter:Async] ════════════════════════════════════════════\n`)
                    }
                  } catch (error) {
                    console.error(`[MessageRouter:Async] ✗ Async inbound delivery failed:`, error)
                  }
                })

                console.log(`[MessageRouter] ✓ Single-round processing complete for ${toAgent.name}`)
              } else {
                console.error(`[MessageRouter] ✗ Failed to get AI response:`, response.error)
              }
            } catch (singleRoundError) {
              console.error(`[MessageRouter] ✗ Single-round processing failed:`, singleRoundError)
            }
          }
        }
      } catch (error) {
        console.error(`[MessageRouter] ✗ Failed to simulate inbound delivery:`, error)
      }
    } else {
      // External user - no need to simulate inbound delivery
      console.log(`[MessageRouter] → External user ${params.toEmail} - email sent via Mailgun`)
    }

    return messageId
  }

  /**
   * Check if incoming email is a response to THIS AGENT's active flow
   * IMPORTANT: Only checks flows belonging to the receiving agent
   */
  async matchEmailToFlow(
    email: InboundEmail,
    agentId: string
  ): Promise<AgentFlow | null> {
    // Extract request ID from subject line
    const requestId = this.extractRequestId(email.subject)

    if (!requestId) {
      console.log('[MessageRouter] No request ID found in subject, not a flow response')
      return null
    }

    console.log(`[MessageRouter] Found request ID: ${requestId}`)

    // Load flows for this agent that are waiting
    const flows = await agentFlowEngine.listAgentFlows(agentId, {
      status: ['waiting']
    })

    console.log(`[MessageRouter] Found ${flows.length} waiting flow(s) for agent`)

    // Find flow waiting for this request ID
    for (const flow of flows) {
      console.log(`[MessageRouter] Checking flow ${flow.id}: waitingFor.type=${flow.waitingFor?.type}, requestId=${flow.waitingFor?.requestId}`)

      if (flow.waitingFor?.type === 'agent_response'
        && flow.waitingFor.requestId === requestId) {
        // Verify sender matches expected agent (optional, for security)
        const expectedAgentIdOrEmail = flow.waitingFor.agentId
        if (expectedAgentIdOrEmail) {
          // Handle both agent ID (legacy) and agent email (new format)
          const expectedAgent = expectedAgentIdOrEmail.includes('@')
            ? await this.getAgentByEmail(expectedAgentIdOrEmail)
            : await this.getAgent(expectedAgentIdOrEmail)

          const senderEmail = this.extractEmail(email.from)

          if (expectedAgent && senderEmail !== expectedAgent.email) {
            console.warn(`[MessageRouter] Sender ${senderEmail} does not match expected agent ${expectedAgent.email}`)
            continue
          }

          console.log(`[MessageRouter] ✓ Flow matched: ${flow.id}`)
          console.log(`[MessageRouter]   Expected agent: ${expectedAgent?.email}`)
          console.log(`[MessageRouter]   Actual sender: ${senderEmail}`)
        }

        // Check temporal proximity (not expired)
        if (flow.waitingFor.expectedBy) {
          const expectedBy = new Date(flow.waitingFor.expectedBy).getTime()
          const now = Date.now()

          if (now > expectedBy) {
            console.warn(`[MessageRouter] Flow ${flow.id} has expired (expected by ${flow.waitingFor.expectedBy})`)
            continue
          }
        }

        console.log(`[MessageRouter] Matched email to flow ${flow.id}`)
        return flow
      }
    }

    console.log('[MessageRouter] No matching flow found for request ID')
    return null
  }

  /**
   * Extract request ID from subject line
   */
  private extractRequestId(subject: string): string | null {
    // Match [Req: req-abc123] or Re: [Req: req-abc123]
    // Include dashes in the pattern since nanoid can generate IDs with dashes
    const match = subject.match(/\[Req:\s*(req-[a-zA-Z0-9_-]+)\]/)

    if (match) {
      return match[1]
    }

    return null
  }

  /**
   * Extract email address from header
   */
  private extractEmail(emailHeader: string): string {
    // Handle "Name <email@domain.com>" format
    const match = emailHeader.match(/<([^>]+)>/)
    if (match) {
      return match[1].trim().toLowerCase()
    }

    // Handle plain email format
    return emailHeader.trim().toLowerCase()
  }

  /**
   * Get agent by email address
   */
  private async getAgentByEmail(email: string): Promise<{
    id: string
    name: string
    email: string
    multiRoundConfig?: {
      canCommunicateWithAgents?: boolean
      allowedAgentEmails?: string[]
    }
  } | undefined> {
    const agentsStorage = useStorage('agents')
    const agents = await agentsStorage.getItem<Array<{
      id?: string
      name?: string
      email?: string
      multiRoundConfig?: Record<string, unknown>
    }>>('agents.json') || []
    const normalizedEmail = email.toLowerCase().trim()
    const agent = agents.find(a => a?.email?.toLowerCase().trim() === normalizedEmail)
    if (!agent || !agent.id || !agent.name || !agent.email) {
      return undefined
    }
    return {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      multiRoundConfig: agent.multiRoundConfig as {
        canCommunicateWithAgents?: boolean
        allowedAgentEmails?: string[]
      }
    }
  }

  /**
   * Get agent by ID (kept for backwards compatibility)
   */
  private async getAgent(agentId: string): Promise<{
    id: string
    name: string
    email: string
    multiRoundConfig?: {
      canCommunicateWithAgents?: boolean
      allowedAgentEmails?: string[]
    }
  } | undefined> {
    const agentsStorage = useStorage('agents')
    const agents = await agentsStorage.getItem<Array<{
      id?: string
      name?: string
      email?: string
      multiRoundConfig?: Record<string, unknown>
    }>>('agents.json') || []
    const agent = agents.find(a => a?.id === agentId)
    if (!agent || !agent.id || !agent.name || !agent.email) {
      return undefined
    }
    return {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      multiRoundConfig: agent.multiRoundConfig as {
        canCommunicateWithAgents?: boolean
        allowedAgentEmails?: string[]
      }
    }
  }

  /**
   * Send email via Mailgun
   */
  private async sendEmailViaMailgun(params: {
    from: string
    to: string
    subject: string
    text: string
  }): Promise<string> {
    const settingsStorage = useStorage('settings')
    const settings = await settingsStorage.getItem<Record<string, unknown>>('settings.json') || {}

    const mailgunApiKey = String(settings.mailgunApiKey || process.env.MAILGUN_KEY || '').trim()
    const mailgunDomain = String(settings.mailgunDomain || process.env.MAILGUN_DOMAIN || '').trim()

    if (!mailgunApiKey || !mailgunDomain) {
      console.warn('[MessageRouter] Mailgun not configured, email not sent')
      // Return fake message ID for development
      return `dev-${Date.now()}`
    }

    try {
      const formData = new FormData()
      formData.append('from', params.from)
      formData.append('to', params.to)
      formData.append('subject', params.subject)
      formData.append('text', params.text)

      const response = await $fetch<{ id: string }>(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString('base64')}`
        },
        body: formData
      })

      return response.id
    } catch (error) {
      console.error('[MessageRouter] Mailgun API error:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to send email via Mailgun'
      })
    }
  }
}
