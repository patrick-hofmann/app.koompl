#!/usr/bin/env node

/**
 * Built-in Email MCP Server
 * This runs as a proper MCP server that the MCP client can connect to
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js'
import {
  listEmails,
  getEmail,
  searchEmails,
  getEmailThread,
  getEmailAttachments,
  type EmailMcpContext
} from './mcpEmail'

// Get context from environment variables (passed by the MCP client)
const getEmailContext = (): EmailMcpContext => {
  console.log('[BuiltinEmailMCP] Getting context from environment variables')
  const teamId = process.env.EMAIL_TEAM_ID
  const userId = process.env.EMAIL_USER_ID
  const agentId = process.env.EMAIL_AGENT_ID

  console.log('[BuiltinEmailMCP] Environment variables:', {
    hasTeamId: !!teamId,
    hasUserId: !!userId,
    hasAgentId: !!agentId
  })

  if (!teamId || !userId || !agentId) {
    throw new Error(
      'Missing required environment variables: EMAIL_TEAM_ID, EMAIL_USER_ID, EMAIL_AGENT_ID'
    )
  }

  return {
    teamId,
    userId,
    agentId
  }
}

async function main() {
  console.log('[BuiltinEmailMCP] Starting built-in Email MCP server...')

  const context = getEmailContext()
  console.log('[BuiltinEmailMCP] Context loaded:', {
    teamId: context.teamId,
    userId: context.userId,
    agentId: context.agentId
  })

  const server = new Server(
    {
      name: 'builtin-email-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  )

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.log('[BuiltinEmailMCP] Listing tools')

    const tools: Tool[] = [
      {
        name: 'list_emails',
        description:
          'List emails for the current user, optionally filtered by date, subject, or sender',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of emails to return (default: 20)',
              minimum: 1,
              maximum: 100
            },
            offset: {
              type: 'number',
              description: 'Number of emails to skip (default: 0)',
              minimum: 0
            },
            startDate: {
              type: 'string',
              description: 'Filter emails from this date (ISO 8601)'
            },
            endDate: {
              type: 'string',
              description: 'Filter emails to this date (ISO 8601)'
            },
            from: {
              type: 'string',
              description: 'Filter emails from specific sender'
            },
            subject: {
              type: 'string',
              description: 'Filter emails by subject containing text'
            },
            direction: {
              type: 'string',
              enum: ['inbound', 'outbound', 'all'],
              description: 'Email direction filter'
            }
          },
          required: [],
          additionalProperties: false
        }
      },
      {
        name: 'get_email',
        description: 'Get detailed content of a specific email by ID',
        inputSchema: {
          type: 'object',
          properties: {
            emailId: {
              type: 'string',
              description: 'Email ID to retrieve'
            }
          },
          required: ['emailId'],
          additionalProperties: false
        }
      },
      {
        name: 'search_emails',
        description: 'Search emails by content, subject, or sender',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 10)',
              minimum: 1,
              maximum: 50
            }
          },
          required: ['query'],
          additionalProperties: false
        }
      },
      {
        name: 'get_email_thread',
        description: 'Get all emails in a conversation thread',
        inputSchema: {
          type: 'object',
          properties: {
            threadId: {
              type: 'string',
              description: 'Thread ID or message ID'
            }
          },
          required: ['threadId'],
          additionalProperties: false
        }
      },
      {
        name: 'get_email_attachments',
        description: 'Get attachments from a specific email',
        inputSchema: {
          type: 'object',
          properties: {
            emailId: {
              type: 'string',
              description: 'Email ID to get attachments from'
            }
          },
          required: ['emailId'],
          additionalProperties: false
        }
      }
    ]

    return { tools }
  })

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    console.log(`[BuiltinEmailMCP] Executing tool: ${name}`, args)

    try {
      let result: any

      switch (name) {
        case 'list_emails':
          result = await listEmails(context, args as any)
          break

        case 'get_email':
          result = await getEmail(context, (args as any).emailId)
          if (!result) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: false,
                      error: 'Email not found'
                    },
                    null,
                    2
                  )
                }
              ],
              isError: true
            }
          }
          break

        case 'search_emails':
          result = await searchEmails(context, (args as any).query, (args as any).limit)
          break

        case 'get_email_thread':
          result = await getEmailThread(context, (args as any).threadId)
          break

        case 'get_email_attachments':
          result = await getEmailAttachments(context, (args as any).emailId)
          break

        default:
          throw new Error(`Unknown tool: ${name}`)
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                data: result
              },
              null,
              2
            )
          }
        ]
      }
    } catch (error) {
      console.error(`[BuiltinEmailMCP] Error executing tool ${name}:`, error)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              },
              null,
              2
            )
          }
        ],
        isError: true
      }
    }
  })

  // Start the server
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.log('[BuiltinEmailMCP] Email MCP server started successfully')
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('[BuiltinEmailMCP] Received SIGINT, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('[BuiltinEmailMCP] Received SIGTERM, shutting down gracefully...')
  process.exit(0)
})

// Start the server
main().catch((error) => {
  console.error('[BuiltinEmailMCP] Fatal error:', error)
  process.exit(1)
})
