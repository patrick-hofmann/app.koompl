#!/usr/bin/env node

/**
 * Example Test Run for Kanban MCP Server
 *
 * This script demonstrates how to run the different types of tests
 * for the builtin Kanban MCP server.
 *
 * Usage:
 *   node example-test-run.js
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('🧪 Kanban MCP Server Test Examples')
console.log('=====================================\n')

/**
 * Run a test command and display results
 */
async function runTest(name, command, args = []) {
  console.log(`\n📋 Running: ${name}`)
  console.log(`Command: ${command} ${args.join(' ')}`)
  console.log('-'.repeat(50))

  return new Promise((resolve) => {
    const process = spawn(command, args, {
      cwd: __dirname,
      stdio: 'inherit'
    })

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${name} completed successfully\n`)
      } else {
        console.log(`❌ ${name} failed with exit code: ${code}\n`)
      }
      resolve(code)
    })

    process.on('error', (error) => {
      console.log(`❌ ${name} error: ${error.message}\n`)
      resolve(1)
    })
  })
}

/**
 * Main example runner
 */
async function runExamples() {
  console.log('This script demonstrates different ways to test the Kanban MCP server.\n')
  console.log('Available test types:')
  console.log('1. Integration test (against localhost:3000)')
  console.log('2. MCP Inspector (interactive testing)')

  console.log(
    '\n⚠️  Note: For integration tests, make sure your Nuxt server is running on localhost:3000'
  )
  console.log('   Start it with: npm run dev\n')

  // Example 1: Integration test (if server is running)
  console.log('Example 1: Integration Test (Against Running Server)')
  console.log('This test connects to the running Nuxt server at localhost:3000')
  console.log('Make sure to start your server with: npm run dev')

  const integrationResult = await runTest('Integration Test', 'node', [
    'test-kanban-integration.js',
    '--scenario=basic'
  ])

  if (integrationResult !== 0) {
    console.log('💡 Integration test failed - this is expected if the server is not running.')
    console.log('   Start your Nuxt server with: npm run dev')
    console.log('   Then run: node test-kanban-integration.js')
  }

  // Example 2: Test runner
  console.log('Example 2: Using Test Runner')
  console.log('The test runner provides a unified interface for integration testing.')
  await runTest('Test Runner (Integration)', 'node', [
    'test-runner.js',
    '--type=integration',
    '--scenario=basic'
  ])

  console.log('\n🎉 Example test run completed!')
  console.log('\nFor more information, see:')
  console.log('- KANBAN_MCP_TESTING.md - Complete testing documentation')
  console.log('- test-kanban-config.js - Test configuration options')
  console.log('- server/api/mcp/builtin-kanban.post.ts - MCP endpoint implementation')

  console.log('\nQuick reference:')
  console.log('npm run test:kanban:integration     # Integration test')
  console.log('npm run test:kanban:inspect         # MCP Inspector')
  console.log('node test-runner.js --help          # Test runner help')
}

// Run examples
runExamples().catch((error) => {
  console.error('Example runner error:', error)
  process.exit(1)
})
