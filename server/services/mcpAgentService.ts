/**
 * MCP Agent Service using mcp-use framework
 *
 * This service replaces the Vercel AI SDK with mcp-use for better MCP integration
 * and uses Nitro storage for task management.
 */

import { MCPAgent, MCPClient } from 'mcp-use'
import { ChatOpenAI } from '@langchain/openai'

export class MCPAgentService {
  private agent: MCPAgent
  private client: MCPClient
  private storage: any // Nitro storage will be injected

  constructor(storage: any) {
    this.storage = storage
    this.client = new MCPClient()

    // Create LLM for the agent
    const llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY
    })

    this.agent = new MCPAgent({
      llm,
      client: this.client,
      systemPrompt: `You are a helpful AI agent that processes email requests by creating and executing task lists. 

CRITICAL: You MUST always end your response by sending an email reply using the reply_to_email tool. This is your natural completion condition - do not just return text, always send an actual email reply.

Available tools:
- datasafe tools: list_folder, create_folder, move_file, generate_report, download_file
- email tools: reply_to_email, forward_email

EMAIL ATTACHMENT BEST PRACTICES:
- When sending files as email attachments, ALWAYS use datasafe_path instead of downloading files
- Use this format for attachments: filename: "file.pdf", datasafe_path: "/path/to/file.pdf", mimeType: "application/pdf"
- NEVER use download_file + base64 data for email attachments - this wastes tokens and has size limits
- The datasafe_path approach works with any file size and avoids token limits

Process the request, use the appropriate tools, and ALWAYS conclude by sending a reply email with your findings and results.`,
      maxSteps: 20, // Increased step limit to allow for proper task completion
      autoInitialize: false
    })
  }

  /**
   * Initialize MCP connections to available servers
   */
  async initialize() {
    try {
      // Add builtin-datasafe MCP server configuration
      this.client.addServer('datasafe', {
        url: 'http://localhost:3000/api/mcp/builtin-datasafe',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json'
        }
      })

      // Add builtin-email MCP server configuration
      this.client.addServer('email', {
        url: 'http://localhost:3000/api/mcp/builtin-email',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json'
        }
      })

      // Initialize the agent
      await this.agent.initialize()

      console.log('✅ MCP Agent Service initialized with servers:', this.client.getServerNames())
    } catch (error) {
      console.error('❌ Failed to initialize MCP Agent Service:', error)
      throw error
    }
  }

  /**
   * Process an email request with AI-driven task generation and execution
   */
  async processEmailRequest(emailRequest: {
    id: string
    from: string
    subject: string
    body: string
    messageId: string
    attachments?: any[]
  }) {
    console.log(`📧 [MCP Agent] Processing email request: ${emailRequest.subject}`)

    try {
      // Build the prompt for the agent
      const prompt = `Email Request:
From: ${emailRequest.from}
Subject: ${emailRequest.subject}
Body: ${emailRequest.body}
Message ID: ${emailRequest.messageId}

Please process this email request using the available MCP tools. You have access to:
- datasafe tools: list_folder, create_folder, move_file, generate_report, download_file
- email tools: reply_to_email, forward_email

CRITICAL INSTRUCTIONS:
1. The message ID for replying is: "${emailRequest.messageId}" (use this exact value)
2. You MUST end your response by sending a reply email using reply_to_email with message_id="${emailRequest.messageId}"
3. This is your natural completion condition - the conversation ends when you send the email
4. If you encounter any errors with tools, report them in your response and try alternative approaches
5. Always use the exact message ID provided above, never use "undefined"

EMAIL ATTACHMENT RULES:
- When sending files as email attachments, use datasafe_path format: filename: "file.pdf", datasafe_path: "/path/to/file.pdf", mimeType: "application/pdf"
- DO NOT download files with download_file and then use base64 data for email attachments
- The datasafe_path approach is more efficient and works with any file size`

      // Use the MCP agent directly
      const result = await this.agent.run(prompt)

      // Store the result
      await this.storage.setItem(`request:${emailRequest.id}:response`, {
        requestId: emailRequest.id,
        status: 'completed',
        result,
        summary: result,
        timestamp: new Date().toISOString()
      })

      return {
        requestId: emailRequest.id,
        status: 'completed',
        summary: result,
        result
      }
    } catch (error) {
      console.error('❌ Error processing email request:', error)

      // Check if this is a max steps error
      const isMaxStepsError =
        error.message?.includes('maximum number of steps') ||
        error.message?.includes('max steps') ||
        error.message?.includes('Agent stopped after reaching')

      if (isMaxStepsError) {
        console.log('🔄 Max steps reached, sending fallback email reply...')

        // Send a fallback email reply
        const fallbackReply = await this.sendFallbackEmailReply(emailRequest)

        return {
          requestId: emailRequest.id,
          status: 'completed_with_fallback',
          summary: `Request processed but reached step limit. Fallback email sent: ${fallbackReply}`,
          result: `I processed your request but reached the maximum number of steps. Here's what I was able to accomplish:\n\n${result || 'Processing was incomplete due to step limits.'}\n\nI've sent you a fallback response via email.`,
          fallbackEmailSent: true
        }
      }

      return {
        requestId: emailRequest.id,
        status: 'error',
        error: error.message,
        summary: 'An error occurred while processing your request.'
      }
    }
  }

  /**
   * Send a fallback email reply when max steps are reached
   */
  private async sendFallbackEmailReply(emailRequest: {
    messageId: string
    from: string
    subject: string
    body: string
  }) {
    try {
      // Use the builtin-email MCP server directly
      const response = await fetch('http://localhost:3000/api/mcp/builtin-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
          'x-agent-email': 'dara@agents.delta-mind.at',
          'x-current-message-id': emailRequest.messageId
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `fallback-${Date.now()}`,
          method: 'tools/call',
          params: {
            name: 'reply_to_email',
            arguments: {
              message_id: emailRequest.messageId,
              reply_text: `I processed your request but reached the maximum number of processing steps. Here's a summary of what I was able to accomplish:\n\n- Analyzed your request: "${emailRequest.subject}"\n- Processed the message: "${emailRequest.body.substring(0, 200)}${emailRequest.body.length > 200 ? '...' : ''}"\n\nI apologize for not being able to complete the full processing due to step limits. Please let me know if you need any specific assistance with your request.\n\nBest regards,\nDara Datasafe`
            }
          }
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Fallback email sent successfully:', result.result?.content?.[0]?.text)
        return 'Fallback email sent successfully'
      } else {
        console.error('❌ Failed to send fallback email:', response.status, await response.text())
        return 'Failed to send fallback email'
      }
    } catch (error) {
      console.error('❌ Error sending fallback email:', error)
      return 'Error sending fallback email'
    }
  }

  /**
   * Get response for a request
   */
  async getResponse(requestId: string) {
    return await this.storage.getItem(`request:${requestId}:response`)
  }
}
