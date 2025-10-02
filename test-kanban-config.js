/**
 * Test Configuration for Kanban MCP Server
 *
 * This file contains test configuration and utilities for testing
 * the builtin kanban MCP server in development mode.
 */

export const TEST_ENVIRONMENTS = {
  development: {
    // Integration tests hit the running server and don't need storage envs
    KANBAN_TEAM_ID: 'test-team-dev-123',
    KANBAN_USER_ID: 'test-user-dev-456',
    KANBAN_AGENT_ID: 'test-agent-dev-789'
  },

  test: {
    KANBAN_TEAM_ID: 'test-team-123',
    KANBAN_USER_ID: 'test-user-456',
    KANBAN_AGENT_ID: 'test-agent-789'
  }
}

export const TEST_DATA = {
  boards: [
    {
      name: 'Test Board',
      description: 'A test board for automated testing',
      columns: [
        { title: 'To Do', position: 0 },
        { title: 'In Progress', position: 1 },
        { title: 'Done', position: 2 }
      ]
    },
    {
      name: 'Development Board',
      description: 'A board for development tasks',
      columns: [
        { title: 'Backlog', position: 0 },
        { title: 'Sprint Planning', position: 1 },
        { title: 'In Development', position: 2 },
        { title: 'Code Review', position: 3 },
        { title: 'Testing', position: 4 },
        { title: 'Deployed', position: 5 }
      ]
    }
  ],

  cards: [
    {
      title: 'Test Card 1',
      description: 'This is a test card created by automated test',
      assignee: 'testuser',
      priority: 'High',
      tags: ['test', 'automated'],
      ticket: 'TEST-001'
    },
    {
      title: 'Test Card 2',
      description: 'Another test card for comprehensive testing',
      assignee: 'testuser2',
      priority: 'Medium',
      tags: ['test', 'integration'],
      ticket: 'TEST-002'
    },
    {
      title: 'Bug Fix Card',
      description: 'A card for testing bug fix scenarios',
      assignee: 'developer',
      priority: 'High',
      tags: ['bug', 'urgent'],
      ticket: 'BUG-123'
    }
  ]
}

export const TEST_TIMEOUTS = {
  CONNECTION_TIMEOUT: 15000,
  TOOL_TIMEOUT: 10000,
  CLEANUP_TIMEOUT: 5000,
  SERVER_STARTUP_TIMEOUT: 20000
}

export const EXPECTED_TOOLS = [
  'list_boards',
  'get_board',
  'list_cards',
  'create_card',
  'modify_card',
  'move_card',
  'remove_card',
  'search_cards',
  'get_cards_by_assignee'
]

export const TEST_SCENARIOS = {
  basic: [
    'initialize_connection',
    'list_tools',
    'list_boards',
    'search_cards',
    'get_cards_by_assignee'
  ],

  full: [
    'initialize_connection',
    'list_tools',
    'list_boards',
    'create_card',
    'modify_card',
    'move_card',
    'search_cards',
    'get_cards_by_assignee',
    'remove_card',
    'error_handling'
  ],

  integration: [
    'initialize_connection',
    'list_tools',
    'list_boards',
    'create_multiple_cards',
    'move_cards_between_columns',
    'search_and_filter_cards',
    'modify_card_properties',
    'cleanup_test_data'
  ]
}

/**
 * Get test environment configuration
 */
export function getTestEnvironment(env = 'development') {
  const config = TEST_ENVIRONMENTS[env] || TEST_ENVIRONMENTS.development
  return {
    ...config,
    NODE_ENV: env
  }
}

/**
 * Validate test environment
 */
export function validateTestEnvironment() {
  // Integration tests don't require any specific env vars; server handles storage.
  return true
}

/**
 * Generate test report
 */
export function generateTestReport(results) {
  const duration = Date.now() - results.startTime
  const total = results.passed + results.failed
  const successRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0

  return {
    summary: {
      total,
      passed: results.passed,
      failed: results.failed,
      successRate: `${successRate}%`,
      duration: `${duration}ms`
    },
    details: {
      errors: results.errors,
      environment: results.environment,
      timestamp: new Date().toISOString()
    }
  }
}
