#!/usr/bin/env node

/**
 * Test Runner for Kanban MCP Server
 *
 * This script provides a unified interface for running all Kanban MCP tests
 * with proper environment setup and reporting.
 *
 * Usage:
 *   node test-runner.js [--type=integration|inspect] [--env=development|test] [--scenario=basic|full|integration]
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Parse command line arguments
const args = process.argv.slice(2)
const type = args.find((arg) => arg.startsWith('--type='))?.split('=')[1] || 'integration'
const env = args.find((arg) => arg.startsWith('--env='))?.split('=')[1] || 'development'
const scenario = args.find((arg) => arg.startsWith('--scenario='))?.split('=')[1] || 'basic'

// Test configurations
const TEST_CONFIGS = {
  integration: {
    script: 'test-kanban-integration.js',
    args: [`--scenario=${scenario}`, `--port=3000`]
  },
  inspect: {
    script: 'npx',
    args: ['@modelcontextprotocol/inspector', 'node', 'server/utils/builtinKanbanMcpServer.ts']
  }
}

/**
 * Logger for test runner
 */
class TestRunnerLogger {
  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    const prefix =
      type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warn' ? '⚠️' : 'ℹ️'
    console.log(`${prefix} [${timestamp}] ${message}`)
  }
}

const logger = new TestRunnerLogger()

/**
 * Check if required files exist
 */
function validateEnvironment() {
  const requiredFiles = [
    'test-kanban-integration.js',
    'test-kanban-config.js',
    'server/utils/builtinKanbanMcpServer.ts',
    'server/api/mcp/builtin-kanban.post.ts'
  ]

  for (const file of requiredFiles) {
    if (!existsSync(join(__dirname, file))) {
      throw new Error(`Required file not found: ${file}`)
    }
  }

  logger.log('Environment validation passed', 'success')
}

/**
 * Run a test command
 */
async function runTest(config) {
  return new Promise((resolve, reject) => {
    const { script, args } = config
    const fullArgs = script === 'npx' ? args : [script, ...args]

    logger.log(`Running test: ${script} ${args.join(' ')}`)

    const testProcess = spawn(script, fullArgs, {
      cwd: __dirname,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: env
      }
    })

    testProcess.on('close', (code) => {
      if (code === 0) {
        logger.log(`Test completed successfully`, 'success')
        resolve(code)
      } else {
        logger.log(`Test failed with exit code: ${code}`, 'error')
        reject(new Error(`Test failed with exit code: ${code}`))
      }
    })

    testProcess.on('error', (error) => {
      logger.log(`Test process error: ${error.message}`, 'error')
      reject(error)
    })

    // Handle process signals
    process.on('SIGINT', () => {
      logger.log('Received SIGINT, terminating test...', 'warn')
      testProcess.kill('SIGINT')
    })

    process.on('SIGTERM', () => {
      logger.log('Received SIGTERM, terminating test...', 'warn')
      testProcess.kill('SIGTERM')
    })
  })
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Kanban MCP Server Test Runner

Usage:
  node test-runner.js [options]

Options:
  --type=integration|inspect    Test type (default: integration)
  --env=development|test          Environment (default: development)
  --scenario=basic|full|integration  Test scenario (default: basic)

Examples:
  node test-runner.js                                    # Run integration test with basic scenario
  node test-runner.js --type=integration                # Run integration test against localhost:3000
  node test-runner.js --type=inspect                    # Launch MCP Inspector

Test Types:
  integration - Integration test against running server at localhost:3000
  inspect     - Interactive MCP Inspector for manual testing

Environments:
  development - Development environment with test data
  test        - Test environment with isolated data

Scenarios:
  basic        - Core functionality tests
  full         - Comprehensive test suite
  integration  - Real-world usage scenarios
`)
}

/**
 * Main test runner
 */
async function main() {
  try {
    // Check for help flag
    if (args.includes('--help') || args.includes('-h')) {
      printUsage()
      process.exit(0)
    }

    // Validate environment
    validateEnvironment()

    // Get test configuration
    const config = TEST_CONFIGS[type]
    if (!config) {
      throw new Error(
        `Invalid test type: ${type}. Valid types: ${Object.keys(TEST_CONFIGS).join(', ')}`
      )
    }

    logger.log(`Starting Kanban MCP Server Tests`)
    logger.log(`Type: ${type}`)
    logger.log(`Environment: ${env}`)
    logger.log(`Scenario: ${scenario}`)

    // Run the test
    await runTest(config)

    logger.log('All tests completed successfully!', 'success')
    process.exit(0)
  } catch (error) {
    logger.log(`Test runner failed: ${error.message}`, 'error')
    process.exit(1)
  }
}

// Run the test runner
main().catch((error) => {
  logger.log(`Fatal error: ${error.message}`, 'error')
  process.exit(1)
})
