# MCP Development Mode Authentication

## Overview

All MCP endpoints now support flexible authentication for development and testing:

- **Production**: Requires `x-team-id` and `x-user-id` headers
- **Development**: Multiple authentication options for easier testing

---

## Authentication Methods

### 1. 🔑 Debug Bearer Token (Recommended for Testing)

Use a bearer token to authenticate without setting up team/user IDs.

#### Environment Variables

```bash
# Set custom values in .env
MCP_DEBUG_TOKEN=your-secret-debug-token
MCP_DEV_TEAM_ID=1
MCP_DEV_USER_ID=1
```

#### Usage

```bash
curl -X POST http://localhost:3000/api/mcp/builtin-datasafe \
  -H "Authorization: Bearer debug-mcp-local-dev-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

#### MCP Inspector Configuration

```json
{
  "mcpServers": {
    "datasafe": {
      "url": "http://localhost:3000/api/mcp/builtin-datasafe",
      "transport": {
        "type": "streamable-http",
        "headers": {
          "Authorization": "Bearer debug-mcp-local-dev-token"
        }
      }
    }
  }
}
```

---

### 2. 🌐 Localhost Auto-Detection

When accessing from localhost, headers are optional - defaults will be used.

#### With Headers

```bash
curl -X POST http://localhost:3000/api/mcp/builtin-kanban \
  -H "x-team-id: 123" \
  -H "x-user-id: 456" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

#### Without Headers (uses defaults)

```bash
curl -X POST http://localhost:3000/api/mcp/builtin-kanban \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

This will automatically use:
- Team ID: `1` (or `MCP_DEV_TEAM_ID`)
- User ID: `1` (or `MCP_DEV_USER_ID`)

---

### 3. 🔒 Production Headers

Always required in production (non-development) environments.

```bash
curl -X POST https://production.example.com/api/mcp/builtin-calendar \
  -H "x-team-id: 123" \
  -H "x-user-id: 456" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

---

## MCP Endpoints

All builtin MCP servers support dev mode authentication:

| Endpoint | Path |
|----------|------|
| Datasafe | `/api/mcp/builtin-datasafe` |
| Kanban | `/api/mcp/builtin-kanban` |
| Calendar | `/api/mcp/builtin-calendar` |
| Agents | `/api/mcp/builtin-agents` |
| Email | `/api/mcp/builtin-email` |

---

## Configuration Examples

### mcp.config (MCP Inspector)

```json
{
  "mcpServers": {
    "datasafe": {
      "url": "http://localhost:3000/api/mcp/builtin-datasafe",
      "transport": {
        "type": "streamable-http",
        "headers": {
          "Authorization": "Bearer debug-mcp-local-dev-token"
        }
      }
    },
    "kanban": {
      "url": "http://localhost:3000/api/mcp/builtin-kanban",
      "transport": {
        "type": "streamable-http",
        "headers": {
          "x-team-id": "1",
          "x-user-id": "1"
        }
      }
    }
  }
}
```

### .env Configuration

```bash
# Development Mode
NODE_ENV=development

# Custom Debug Token (optional)
MCP_DEBUG_TOKEN=my-secret-token-123

# Default IDs for localhost (optional)
MCP_DEV_TEAM_ID=1
MCP_DEV_USER_ID=1
```

---

## Security Notes

⚠️ **Important Security Information**:

1. **Debug token only works in development mode** (`NODE_ENV=development`)
2. **Localhost auto-detection only works in development**
3. **Production always requires proper headers**
4. **Never commit your debug token to version control**
5. **Use environment variables for sensitive configuration**

---

## Troubleshooting

### Issue: "Missing x-team-id header"

**Solution**: Either:
- Set `NODE_ENV=development`
- Use the debug bearer token
- Access from localhost
- Or provide the required headers

### Issue: "Bearer token not working"

**Check**:
1. `NODE_ENV=development` is set
2. Token matches `MCP_DEBUG_TOKEN` (default: `debug-mcp-local-dev-token`)
3. Header format: `Authorization: Bearer YOUR_TOKEN`

### Issue: "Localhost not being recognized"

**Check**:
1. Using `localhost` or `127.0.0.1` in URL
2. `NODE_ENV=development` is set
3. Server is running on the correct port

---

## Testing with curl

```bash
# Test Datasafe (with bearer token)
curl -X POST http://localhost:3000/api/mcp/builtin-datasafe \
  -H "Authorization: Bearer debug-mcp-local-dev-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Test Kanban (with headers)
curl -X POST http://localhost:3000/api/mcp/builtin-kanban \
  -H "x-team-id: 1" \
  -H "x-user-id: 1" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Test Calendar (localhost auto-detect)
curl -X POST http://localhost:3000/api/mcp/builtin-calendar \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

---

**Status**: ✅ Ready for Development
**Last Updated**: 2025-10-10

