/**
 * MCP Server Endpoint for Built-in Calendar
 * This endpoint spawns the built-in calendar MCP server and handles JSON-RPC requests
 */

import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id
  const userId = session.user?.id

  if (!teamId || !userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Authentication required'
    })
  }

  const body = await readBody(event)

  // Path to the built-in calendar MCP server
  const serverPath = resolve(process.cwd(), 'server/utils/builtinCalendarMcpServer.ts')

  return new Promise((resolve, reject) => {
    // Spawn the MCP server with context
    const child = spawn('tsx', [serverPath], {
      env: {
        ...process.env,
        CALENDAR_TEAM_ID: teamId,
        CALENDAR_USER_ID: userId,
        CALENDAR_AGENT_ID: body.agentId || ''
      }
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    // Send the JSON-RPC request
    child.stdin.write(JSON.stringify(body))
    child.stdin.end()

    child.on('close', (code) => {
      if (code !== 0) {
        console.error('[BuiltinCalendarMCP] Server error:', stderr)
        reject(
          createError({
            statusCode: 500,
            statusMessage: `Calendar MCP server failed: ${stderr}`
          })
        )
      } else {
        try {
          const response = JSON.parse(stdout)
          resolve(response)
        } catch (error) {
          console.error('[BuiltinCalendarMCP] Failed to parse response:', stdout, error)
          reject(
            createError({
              statusCode: 500,
              statusMessage: 'Invalid response from calendar MCP server'
            })
          )
        }
      }
    })

    child.on('error', (error) => {
      console.error('[BuiltinCalendarMCP] Spawn error:', error)
      reject(
        createError({
          statusCode: 500,
          statusMessage: `Failed to start calendar MCP server: ${error.message}`
        })
      )
    })
  })
})
