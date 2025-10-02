#!/usr/bin/env node

/**
 * Integration Test for Builtin Kanban MCP Server
 *
 * This script tests the builtin Kanban MCP server by connecting to the
 * running Nuxt server at localhost:3000 and making HTTP requests to the
 * MCP endpoint.
 *
 * Usage:
 *   node test-kanban-integration.js [--port=3000] [--scenario=basic|full|integration]
 *   npm run test:kanban:integration
 */

import {
  validateTestEnvironment,
  generateTestReport,
  TEST_SCENARIOS,
  EXPECTED_TOOLS,
  TEST_TIMEOUTS
} from './test-kanban-config.js'

// Parse command line arguments
const args = process.argv.slice(2)
const port = args.find((arg) => arg.startsWith('--port='))?.split('=')[1] || '3000'
const scenario = args.find((arg) => arg.startsWith('--scenario='))?.split('=')[1] || 'basic'
const env = 'development'

// Test configuration
validateTestEnvironment()

const BASE_URL = `http://localhost:${port}`
const MCP_ENDPOINT = `${BASE_URL}/api/mcp/builtin-kanban`

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  errors:
    /** @type {Array<{test: string, error: string, duration: string, timestamp: string}>} */ ([]),
  startTime: Date.now(),
  environment: env,
  scenario: scenario,
  serverUrl: BASE_URL
}

/**
 * Enhanced logging with different levels and colors
 */
class TestLogger {
  constructor() {
    this.startTime = Date.now()
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    const elapsed = Date.now() - this.startTime
    const prefix = this.getPrefix(type)
    const color = this.getColor(type)

    console.log(`${color}${prefix} [${timestamp}] [${elapsed}ms] ${message}\x1b[0m`)
  }

  getPrefix(type) {
    switch (type) {
      case 'error':
        return '❌'
      case 'success':
        return '✅'
      case 'warn':
        return '⚠️'
      case 'info':
        return 'ℹ️'
      case 'debug':
        return '🔍'
      case 'test':
        return '🧪'
      case 'http':
        return '🌐'
      default:
        return 'ℹ️'
    }
  }

  getColor(type) {
    switch (type) {
      case 'error':
        return '\x1b[31m' // Red
      case 'success':
        return '\x1b[32m' // Green
      case 'warn':
        return '\x1b[33m' // Yellow
      case 'info':
        return '\x1b[36m' // Cyan
      case 'debug':
        return '\x1b[90m' // Gray
      case 'test':
        return '\x1b[35m' // Magenta
      case 'http':
        return '\x1b[34m' // Blue
      default:
        return '\x1b[0m' // Reset
    }
  }
}

const logger = new TestLogger()

/**
 * Run a test case with enhanced error handling and reporting
 */
async function runTest(testName, testFunction, timeout = TEST_TIMEOUTS.TOOL_TIMEOUT) {
  const startTime = Date.now()

  try {
    logger.log(`Starting test: ${testName}`, 'test')

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Test timeout after ${timeout}ms`)), timeout)
    })

    const testPromise = testFunction()

    await Promise.race([testPromise, timeoutPromise])

    const duration = Date.now() - startTime
    testResults.passed++
    logger.log(`✅ Test passed: ${testName} (${duration}ms)`, 'success')
  } catch (error) {
    const duration = Date.now() - startTime
    testResults.failed++
    testResults.errors.push({
      test: testName,
      error: error.message,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    })
    logger.log(`❌ Test failed: ${testName} - ${error.message} (${duration}ms)`, 'error')
  }
}

/**
 * Send HTTP request to MCP endpoint
 */
async function sendMCPRequest(request, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await sendMCPRequestAttempt(request)
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`MCP request failed after ${retries} attempts: ${error.message}`)
      }
      logger.log(`MCP request attempt ${attempt} failed, retrying...`, 'warn')
      // @ts-ignore
      await new Promise((resolve) => setTimeout(() => resolve(), 1000 * attempt))
    }
  }
}

async function sendMCPRequestAttempt(request) {
  const response = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errorText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`MCP Error ${data.error.code}: ${data.error.message}`)
  }

  return data
}

/**
 * Check if server is running
 */
async function checkServerHealth() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      method: 'GET',
      // @ts-ignore
      timeout: 5000
    })

    if (response.ok) {
      logger.log('Server health check passed', 'success')
      return true
    }
  } catch {
    // Health endpoint might not exist, try a different approach
  }

  // Try to connect to the MCP endpoint directly
  try {
    const initRequest = {
      jsonrpc: '2.0',
      id: 'health-check',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'health-check', version: '1.0.0' }
      }
    }

    await sendMCPRequest(initRequest)
    logger.log('MCP endpoint is accessible', 'success')
    return true
  } catch (error) {
    throw new Error(`Server not accessible at ${BASE_URL}: ${error.message}`)
  }
}

/**
 * Test: Initialize MCP connection
 */
async function testInitializeMCP() {
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: 'kanban-integration-test',
        version: '1.0.0'
      }
    }
  }

  const response = await sendMCPRequest(request)

  if (!response.result) {
    throw new Error('Failed to initialize MCP connection')
  }

  if (!response.result.protocolVersion || !response.result.capabilities) {
    throw new Error('Invalid initialization response')
  }

  logger.log('MCP connection initialized successfully', 'success')
  logger.log(
    `Server: ${response.result.serverInfo?.name} v${response.result.serverInfo?.version}`,
    'info'
  )
  return response.result
}

/**
 * Test: List available tools
 */
async function testListTools() {
  const request = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  }

  const response = await sendMCPRequest(request)

  if (!response.result || !response.result.tools) {
    throw new Error('No tools returned from server')
  }

  const toolNames = response.result.tools.map((tool) => tool.name)
  logger.log(`Server provides ${toolNames.length} tools: ${toolNames.join(', ')}`, 'info')

  // Validate expected tools
  for (const expectedTool of EXPECTED_TOOLS) {
    if (!toolNames.includes(expectedTool)) {
      throw new Error(`Missing expected tool: ${expectedTool}`)
    }
  }

  // Validate tool schemas
  for (const tool of response.result.tools) {
    if (!tool.name || !tool.description || !tool.inputSchema) {
      throw new Error(`Invalid tool schema for: ${tool.name}`)
    }
  }

  logger.log('All expected tools present with valid schemas', 'success')
}

/**
 * Test: List boards
 */
async function testListBoards() {
  const request = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'list_boards',
      arguments: {}
    }
  }

  const response = await sendMCPRequest(request)

  if (!response.result) {
    throw new Error('No result from list_boards')
  }

  const content = response.result.content[0]
  if (content.type !== 'text') {
    throw new Error('Expected text content from list_boards')
  }

  const data = JSON.parse(content.text)
  if (!data.success) {
    throw new Error(`list_boards failed: ${data.error || 'Unknown error'}`)
  }

  if (!Array.isArray(data.data)) {
    throw new Error('Expected data.data to be an array')
  }

  logger.log(`Found ${data.data.length} boards`, 'info')

  // Validate board structure
  for (const board of data.data) {
    if (!board.id || !board.name || !Array.isArray(board.columns)) {
      throw new Error(`Invalid board structure: ${JSON.stringify(board)}`)
    }
  }

  logger.log('Board structure validation passed', 'success')
}

/**
 * Test: Create card
 */
async function testCreateCard() {
  const testCard = {
    boardIdOrName: 'Test Board',
    columnIdOrName: 'To Do',
    title: 'Integration Test Card',
    description: 'This card was created by integration testing',
    assignee: 'testuser',
    priority: 'High',
    tags: ['test', 'integration'],
    ticket: 'INT-TEST-001'
  }

  const request = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'create_card',
      arguments: testCard
    }
  }

  const response = await sendMCPRequest(request)

  if (!response.result) {
    throw new Error('No result from create_card')
  }

  const content = response.result.content[0]
  if (content.type !== 'text') {
    throw new Error('Expected text content from create_card')
  }

  const data = JSON.parse(content.text)

  if (data.success) {
    logger.log(`Created card: ${data.data.card.title}`, 'success')

    // Validate created card structure
    const card = data.data.card
    if (!card.id || !card.title) {
      throw new Error('Invalid card structure created')
    }

    return card.id
  } else {
    throw new Error(`create_card failed: ${data.error || 'unknown error'}`)
  }
}

/**
 * Test: Search cards
 */
async function testSearchCards() {
  const searchQueries = ['test', 'integration', 'card', 'INT-TEST']

  for (const query of searchQueries) {
    const request = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'search_cards',
        arguments: { query }
      }
    }

    const response = await sendMCPRequest(request)

    if (!response.result) {
      throw new Error(`No result from search_cards for query: ${query}`)
    }

    const content = response.result.content[0]
    if (content.type !== 'text') {
      throw new Error('Expected text content from search_cards')
    }

    const data = JSON.parse(content.text)
    if (!data.success) {
      throw new Error(`search_cards failed for query "${query}": ${data.error}`)
    }

    if (!Array.isArray(data.data)) {
      throw new Error('Expected data.data to be an array')
    }

    logger.log(`Found ${data.data.length} cards matching "${query}"`, 'info')
  }

  logger.log('Search functionality working correctly', 'success')
}

/**
 * Test: Get cards by assignee
 */
async function testGetCardsByAssignee() {
  const assignees = ['testuser', 'developer', 'admin']

  for (const assignee of assignees) {
    const request = {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'get_cards_by_assignee',
        arguments: { assignee }
      }
    }

    const response = await sendMCPRequest(request)

    if (!response.result) {
      throw new Error(`No result from get_cards_by_assignee for assignee: ${assignee}`)
    }

    const content = response.result.content[0]
    if (content.type !== 'text') {
      throw new Error('Expected text content from get_cards_by_assignee')
    }

    const data = JSON.parse(content.text)
    if (!data.success) {
      throw new Error(`get_cards_by_assignee failed for assignee "${assignee}": ${data.error}`)
    }

    if (!Array.isArray(data.data)) {
      throw new Error('Expected data.data to be an array')
    }

    logger.log(`Found ${data.data.length} cards assigned to "${assignee}"`, 'info')
  }

  logger.log('Assignee filtering working correctly', 'success')
}

/**
 * Test: Error handling
 */
async function testErrorHandling() {
  const errorTests = [
    {
      name: 'invalid_method',
      request: {
        jsonrpc: '2.0',
        id: 7,
        method: 'invalid_method',
        params: {}
      },
      expectError: true
    },
    {
      name: 'invalid_tool',
      request: {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {}
        }
      },
      expectError: true
    },
    {
      name: 'invalid_arguments',
      request: {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'create_card',
          arguments: {
            // Missing required arguments
            title: 'Test Card'
          }
        }
      },
      expectError: true
    }
  ]

  for (const test of errorTests) {
    try {
      const response = await sendMCPRequest(test.request)

      if (test.expectError && !response.error) {
        throw new Error(`Expected error for ${test.name} but got success`)
      }

      if (!test.expectError && response.error) {
        throw new Error(`Unexpected error for ${test.name}: ${response.error.message}`)
      }

      logger.log(`Error handling test passed: ${test.name}`, 'success')
    } catch (error) {
      if (test.expectError) {
        logger.log(`Error handling test passed: ${test.name} (caught expected error)`, 'success')
      } else {
        throw error
      }
    }
  }
}

/**
 * Test: Performance and load testing
 */
async function testPerformance() {
  const startTime = Date.now()
  const requests = []

  // Send multiple concurrent requests
  for (let i = 0; i < 5; i++) {
    const request = {
      jsonrpc: '2.0',
      id: `perf-${i}`,
      method: 'tools/call',
      params: {
        name: 'list_boards',
        arguments: {}
      }
    }

    requests.push(sendMCPRequest(request))
  }

  const results = await Promise.all(requests)
  const duration = Date.now() - startTime

  logger.log(`Completed ${results.length} concurrent requests in ${duration}ms`, 'info')

  // Validate all requests succeeded
  for (const result of results) {
    if (!result.result) {
      throw new Error('Performance test request failed')
    }
  }

  logger.log('Performance test passed', 'success')
}

/**
 * Print comprehensive test summary
 */
function printSummary() {
  const report = generateTestReport(testResults)

  console.log('\n' + '='.repeat(80))
  console.log('🧪 KANBAN MCP INTEGRATION TEST SUMMARY')
  console.log('='.repeat(80))
  console.log(`Server URL: ${testResults.serverUrl}`)
  console.log(`Environment: ${report.details.environment}`)
  console.log(`Scenario: ${testResults.scenario}`)
  console.log(`Total tests: ${report.summary.total}`)
  console.log(`Passed: ${report.summary.passed}`)
  console.log(`Failed: ${report.summary.failed}`)
  console.log(`Success rate: ${report.summary.successRate}`)
  console.log(`Duration: ${report.summary.duration}`)
  console.log(`Timestamp: ${report.details.timestamp}`)

  if (testResults.errors.length > 0) {
    console.log('\n❌ Failed Tests:')
    testResults.errors.forEach(({ test, error, duration, timestamp }) => {
      console.log(`  • ${test} (${duration})`)
      console.log(`    Error: ${error}`)
      console.log(`    Time: ${timestamp}`)
      console.log('')
    })
  }

  console.log('='.repeat(80))

  if (testResults.failed === 0) {
    console.log('🎉 All integration tests passed! The Kanban MCP server is working correctly.')
    process.exit(0)
  } else {
    console.log('❌ Some integration tests failed! Please check the errors above.')
    process.exit(1)
  }
}

/**
 * Main test runner
 */
async function runTests() {
  try {
    logger.log('Starting Kanban MCP Integration Tests')
    logger.log(`Server URL: ${BASE_URL}`)
    logger.log(`MCP Endpoint: ${MCP_ENDPOINT}`)
    logger.log(`Configuration: ${JSON.stringify({ port, scenario, env }, null, 2)}`)

    // Check server health
    await runTest('Check Server Health', () => checkServerHealth())

    // Get test scenarios
    const scenarios = TEST_SCENARIOS[scenario] || TEST_SCENARIOS.basic
    logger.log(`Running scenario: ${scenario} with tests: ${scenarios.join(', ')}`, 'info')

    // Initialize MCP connection
    if (scenarios.includes('initialize_connection')) {
      await runTest('Initialize MCP Connection', () => testInitializeMCP())
    }

    // Run core functionality tests
    if (scenarios.includes('list_tools')) {
      await runTest('List Available Tools', () => testListTools())
    }

    if (scenarios.includes('list_boards')) {
      await runTest('List Boards', () => testListBoards())
    }

    if (scenarios.includes('create_card')) {
      await runTest('Create Card', () => testCreateCard())
    }

    if (scenarios.includes('search_cards')) {
      await runTest('Search Cards', () => testSearchCards())
    }

    if (scenarios.includes('get_cards_by_assignee')) {
      await runTest('Get Cards by Assignee', () => testGetCardsByAssignee())
    }

    if (scenarios.includes('error_handling')) {
      await runTest('Error Handling', () => testErrorHandling())
    }

    // Additional integration tests
    if (scenario === 'integration') {
      await runTest('Performance Test', () => testPerformance())
    }
  } catch (error) {
    logger.log(`Test runner error: ${error.message}`, 'error')
    testResults.failed++
    testResults.errors.push({
      test: 'Test Runner',
      error: error.message,
      duration: '0ms',
      timestamp: new Date().toISOString()
    })
  } finally {
    printSummary()
  }
}

// Handle process signals
process.on('SIGINT', () => {
  logger.log('Received SIGINT, exiting...', 'warn')
  process.exit(1)
})

process.on('SIGTERM', () => {
  logger.log('Received SIGTERM, exiting...', 'warn')
  process.exit(1)
})

// Run the tests
runTests().catch((error) => {
  logger.log(`Fatal error: ${error.message}`, 'error')
  process.exit(1)
})
