# Kanban MCP Server Automated Testing

This document describes the automated testing setup for the builtin Kanban MCP server using the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) and direct MCP communication.

## Overview

The testing suite provides comprehensive validation of the builtin Kanban MCP server functionality, including:

- **MCP Protocol Compliance**: Validates proper MCP server implementation
- **Tool Functionality**: Tests all available Kanban tools
- **Error Handling**: Ensures proper error responses
- **Data Validation**: Verifies correct data structures and responses
- **Integration Testing**: Tests real-world usage scenarios

## Test Files

### Core Test Files

- `test-kanban-config.js` - Test configuration and utilities
- `test-kanban-integration.js` - Integration testing against the running Nuxt server

### Test Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `test-kanban-integration.js` | Integration testing against localhost:3000 | `npm run test:kanban:integration` |
| MCP Inspector | Interactive testing tool | `npm run test:kanban:inspect` |

## Quick Start

### Prerequisites

1. **Node.js**: Ensure Node.js is installed
2. **Dependencies**: Install project dependencies with `pnpm install`
3. **Environment**: Set up required environment variables (see Configuration section)

### Running Tests

#### Integration Tests

#### Integration Testing
```bash
# Run integration test against running server
npm run test:kanban:integration

# Run full integration test scenario
npm run test:kanban:integration:full

# Run performance integration test
npm run test:kanban:integration:perf

# Run with custom port
node test-kanban-integration.js --port=3001 --scenario=full
```

#### Interactive Testing with MCP Inspector
```bash
# Launch MCP Inspector for interactive testing
npm run test:kanban-mcp:inspect
```

## Testing Approaches

### Integration Testing
Tests the MCP server through the running Nuxt application:
- Connects to `http://localhost:3000/api/mcp/builtin-kanban`
- Tests real HTTP requests and responses
- Validates authentication and session handling
- Tests performance under load
- Good for end-to-end testing

### Interactive Testing
Uses the MCP Inspector for manual testing:
- Visual interface for testing tools
- Real-time response inspection
- Debugging and exploration
- Good for development and debugging

## Test Scenarios

### Basic Scenario
Tests core functionality:
- Initialize MCP connection
- List available tools
- List boards
- Search cards
- Get cards by assignee

### Full Scenario
Comprehensive testing including:
- All basic tests
- Create card functionality
- Modify card functionality
- Move card functionality
- Remove card functionality
- Error handling validation

### Integration Scenario
Real-world usage testing:
- All full scenario tests
- Create multiple cards
- Move cards between columns
- Search and filter operations
- Modify card properties
- Cleanup test data

## Configuration

### Environment Variables

The tests use the following environment variables:

```bash
# Required for MCP server
KANBAN_TEAM_ID=your-team-id
KANBAN_USER_ID=your-user-id
KANBAN_AGENT_ID=your-agent-id  # Optional

# S3 Configuration (for storage)
S3_BUCKET_AGENTS=your-agents-bucket
S3_BUCKET_SETTINGS=your-settings-bucket
S3_BUCKET_IDENTITY=your-identity-bucket
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_REGION=us-east-1
S3_ENDPOINT=https://s3.amazonaws.com
```

### Test Environments

The test suite supports multiple environments:

#### Development Environment
```bash
node test-kanban-mcp-enhanced.js --env=development
```
- Uses test data buckets
- More verbose logging
- Extended timeouts

#### Test Environment
```bash
node test-kanban-mcp-enhanced.js --env=test
```
- Isolated test data
- Standard timeouts
- Production-like configuration

## Test Features

### Comprehensive Validation

The integration test suite validates:

1. **MCP Protocol Compliance**
   - Proper JSON-RPC 2.0 implementation
   - Correct request/response format
   - Error handling standards

2. **Tool Functionality**
   - All 9 Kanban tools are available
   - Tool schemas are valid
   - Tool responses are properly formatted

3. **Data Structure Validation**
   - Board structure integrity
   - Card data completeness
   - Column organization

4. **Error Handling**
   - Invalid tool names
   - Missing required arguments
   - Malformed requests

### Advanced Features

- **Retry Logic**: Automatic retry for failed requests
- **Timeout Handling**: Configurable timeouts for different operations
- **Comprehensive Logging**: Detailed logging with timestamps and colors
- **Test Reporting**: Detailed test results and error reporting
- **Resource Cleanup**: Proper cleanup of test resources

## MCP Inspector Integration

### Using the MCP Inspector

The MCP Inspector provides an interactive interface for testing:

1. **Launch Inspector**:
   ```bash
   npm run test:kanban:inspect
   ```

2. **Test Tools**: Use the Tools tab to test individual Kanban tools
3. **Validate Responses**: Check tool responses and data structures
4. **Debug Issues**: Use the Inspector to debug specific problems

### Inspector Features

- **Tool Testing**: Interactive tool execution
- **Response Validation**: Visual response inspection
- **Error Debugging**: Detailed error information
- **Real-time Monitoring**: Live server output monitoring

## Test Results

### Success Criteria

Tests pass when:
- All MCP protocol requirements are met
- All tools respond correctly
- Data structures are valid
- Error handling works properly
- No critical errors occur

### Test Output

The test suite provides:
- **Real-time Progress**: Live test execution feedback
- **Detailed Results**: Comprehensive test summary
- **Error Reporting**: Specific error details and timestamps
- **Performance Metrics**: Test execution times

### Example Output

```
🧪 KANBAN MCP SERVER ENHANCED TEST SUMMARY
================================================================================
Environment: development
Scenario: full
Total tests: 8
Passed: 8
Failed: 0
Success rate: 100.0%
Duration: 2,456ms
Timestamp: 2024-01-15T10:30:45.123Z
================================================================================
🎉 All tests passed! The Kanban MCP server is working correctly.
```

## Troubleshooting

### Common Issues

1. **Server Startup Timeout**
   - Check environment variables
   - Verify S3 credentials
   - Check network connectivity

2. **Tool Execution Failures**
   - Verify test data exists
   - Check S3 bucket permissions
   - Review server logs

3. **MCP Protocol Errors**
   - Ensure proper JSON-RPC format
   - Check request structure
   - Verify tool schemas

### Debug Mode

Enable verbose logging by running with a terminal that shows the logger output in the integration script.

### Manual Testing

For manual testing and debugging:
```bash
# Launch interactive Inspector
npm run test:kanban-mcp:inspect

# Check server logs
node server/utils/builtinKanbanMcpServer.ts
```

## Development Workflow

### Running Tests During Development

1. **Before Commits**: Run full integration test suite
   ```bash
   npm run test:kanban:integration:full
   ```

2. **Quick Validation**: Run basic integration tests
   ```bash
   npm run test:kanban:integration
   ```

3. **Interactive Debugging**: Use MCP Inspector
   ```bash
   npm run test:kanban:inspect
   ```

### Continuous Integration

The test suite is designed to run in CI environments:

```yaml
# Example GitHub Actions workflow
- name: Test Kanban MCP Server
  run: |
    npm run test:kanban:integration:full
  env:
    KANBAN_TEAM_ID: ${{ secrets.KANBAN_TEAM_ID }}
    KANBAN_USER_ID: ${{ secrets.KANBAN_USER_ID }}
    S3_ACCESS_KEY_ID: ${{ secrets.S3_ACCESS_KEY_ID }}
    S3_SECRET_ACCESS_KEY: ${{ secrets.S3_SECRET_ACCESS_KEY }}
```

## Best Practices

### Test Development

1. **Add New Tests**: Extend the test scenarios in `test-kanban-config.js`
2. **Validate Data**: Always validate response data structures
3. **Handle Errors**: Test both success and error cases
4. **Clean Up**: Ensure proper resource cleanup

### MCP Server Development

1. **Follow Standards**: Adhere to MCP protocol specifications
2. **Validate Inputs**: Always validate tool arguments
3. **Handle Errors**: Provide meaningful error messages
4. **Log Activity**: Include appropriate logging

## References

- [MCP Inspector Documentation](https://modelcontextprotocol.io/docs/tools/inspector)
- [MCP Protocol Specification](https://modelcontextprotocol.io/docs/specification)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Project Architecture](./ARCHITECTURE_DIAGRAM.md)
