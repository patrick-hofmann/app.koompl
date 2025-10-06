# Builtin MCP Server Auto-Initialization

## Problem

When testing predefined Koompls (especially Cassy Calendar) with the prompt test, the MCP tools weren't being used. The AI generated placeholder responses like:

```
Here are your calendar entries for this week:
- **[Event Title]** on [Date] at [Time]
```

Instead of actually querying the calendar and returning real events.

## Root Cause

The predefined Koompls reference MCP servers by ID:
- Cassy Calendar: `mcpServerIds: ['builtin-calendar']`
- Tracy Task: `mcpServerIds: ['builtin-kanban']`

However, these MCP server entries didn't exist in the MCP servers storage (`mcp/servers.json`). The code needs actual MCP server records to:
1. Load server configurations
2. Pass them to the agent responder
3. Execute MCP tools

Without these records, the agent responder skipped MCP tool execution and fell back to basic OpenAI completion without tools.

## Solution

Created an auto-initialization utility that ensures builtin MCP servers exist before processing agent responses.

### New File: `server/utils/ensureBuiltinServers.ts`

```typescript
export async function ensureBuiltinServers(): Promise<void> {
  const mcpStorage = useStorage('mcp')
  const servers = (await mcpStorage.getItem<StoredMcpServer[]>('servers.json')) || []

  let modified = false

  // Ensure builtin-kanban exists
  if (!servers.find(s => s.id === 'builtin-kanban')) {
    servers.push({
      id: 'builtin-kanban',
      name: 'Team Kanban Board',
      provider: 'builtin-kanban',
      category: 'productivity',
      // ... full config
    })
    modified = true
  }

  // Ensure builtin-calendar exists
  if (!servers.find(s => s.id === 'builtin-calendar')) {
    servers.push({
      id: 'builtin-calendar',
      name: 'Team Calendar',
      provider: 'builtin-calendar',
      category: 'calendar',
      // ... full config
    })
    modified = true
  }

  if (modified) {
    await mcpStorage.setItem('servers.json', servers)
  }
}
```

### Modified: `server/utils/agentResponder.ts`

Added auto-initialization at the start of `generateAgentResponse()`:

```typescript
export async function generateAgentResponse(payload: AgentRespondRequest) {
  try {
    // ... parameter extraction

    // Ensure builtin MCP servers exist
    const { ensureBuiltinServers } = await import('./ensureBuiltinServers')
    await ensureBuiltinServers()

    // ... rest of function
  }
}
```

## How It Works

1. **First Request**: When any agent response is generated (test, roundtrip, or real email), the system checks if builtin MCP servers exist.

2. **Auto-Creation**: If `builtin-kanban` or `builtin-calendar` don't exist, they are automatically created with proper configuration.

3. **Normal Operation**: The agent responder then proceeds with MCP tool execution as normal.

4. **Subsequent Requests**: The check is fast (just a find operation), and if servers exist, nothing is modified.

## Builtin Server Configuration

### builtin-kanban
```json
{
  "id": "builtin-kanban",
  "name": "Team Kanban Board",
  "provider": "builtin-kanban",
  "category": "productivity",
  "description": "Built-in Kanban board for task management...",
  "auth": {
    "type": "bearer",
    "token": "builtin"
  },
  "metadata": {
    "builtin": true
  }
}
```

### builtin-calendar
```json
{
  "id": "builtin-calendar",
  "name": "Team Calendar",
  "provider": "builtin-calendar",
  "category": "calendar",
  "description": "Built-in team calendar for event management...",
  "auth": {
    "type": "bearer",
    "token": "builtin"
  },
  "metadata": {
    "builtin": true
  }
}
```

## Testing Flow

### Before Fix

```
User: "what are my calendar-entries this week?"
  ↓
Agent Responder: Load agent (cassy-calendar)
  ↓
Check MCP servers: Look for id='builtin-calendar'
  ↓
Not found! ❌
  ↓
Fall back to basic OpenAI (no tools)
  ↓
Result: Generic placeholder response
```

### After Fix

```
User: "what are my calendar-entries this week?"
  ↓
Agent Responder: ensureBuiltinServers()
  ↓
Check if builtin-calendar exists → No
  ↓
Auto-create builtin-calendar ✅
  ↓
Load agent (cassy-calendar)
  ↓
Check MCP servers: Look for id='builtin-calendar'
  ↓
Found! ✅
  ↓
Load calendar tools: list_events, create_event, etc.
  ↓
Use handleBuiltinCalendarWithFunctionCalling()
  ↓
OpenAI Function Calling with calendar tools
  ↓
AI: "I'll check your calendar..." → calls list_events
  ↓
Execute list_events(teamId, userId, startDate, endDate)
  ↓
Return real calendar events
  ↓
AI formats response with actual events ✅
```

## Impact

### Cassy Calendar

Now when you test Cassy Calendar with "what are my calendar-entries this week?", it will:
1. Actually query the calendar storage
2. Return real events (or "no events" if calendar is empty)
3. Use calendar tool functions properly

### Tracy Task

Similarly, Tracy Task will now:
1. Access the kanban board
2. Create, read, update tasks
3. Use kanban tool functions properly

### User Experience

- **No Manual Setup**: Users don't need to manually create builtin MCP servers
- **Automatic**: Works out of the box with predefined Koompls
- **Reliable**: Ensures consistency across all environments

## Benefits

1. **Zero Configuration**: Builtin servers are created automatically
2. **Idempotent**: Safe to call multiple times, only creates if missing
3. **Non-Breaking**: Existing servers are never modified
4. **Transparent**: Logged when servers are created
5. **Fast**: Simple existence check, minimal overhead

## Alternative Approaches Considered

### 1. Manual Creation via UI
❌ Requires users to manually add builtin servers
❌ Error-prone
❌ Poor user experience

### 2. Database Migration
❌ Requires migration scripts
❌ Hard to maintain
❌ Doesn't help new installations

### 3. Initialization at Startup
❌ Requires server restart
❌ Doesn't handle deleted servers
❌ More complex setup

### 4. Auto-Init on First Use ✅ (Chosen)
✅ Works immediately
✅ Self-healing (recreates if deleted)
✅ No user action required
✅ Simple implementation

## Testing

### Test Cassy Calendar

1. Navigate to `/agents`
2. Enable "Cassy Calendar"
3. Click the flask icon (🧪 Test Prompt)
4. Enter: "what are my calendar-entries this week?"
5. Click "Run Test"
6. **Expected**: AI uses `list_events` tool and returns real calendar data

### Test Tracy Task

1. Navigate to `/agents`
2. Enable "Tracy Task"
3. Click the flask icon (🧪 Test Prompt)
4. Enter: "what tasks are in the backlog?"
5. Click "Run Test"
6. **Expected**: AI uses `list_cards` tool and returns real tasks

## Console Output

When builtin servers are created, you'll see:

```
[EnsureBuiltinServers] Creating builtin-kanban server
[EnsureBuiltinServers] Creating builtin-calendar server
[EnsureBuiltinServers] Builtin servers initialized
```

Then when using them:

```
[AgentResponder] Using direct Calendar tool executor (production-ready)
[BuiltinCalendar] Loaded 8 tools
[BuiltinCalendar] Using OpenAI function calling with calendar tools
```

## Future Enhancements

1. **Verify Integrity**: Check if builtin server configs are corrupted
2. **Update on Change**: Automatically update server configs if definitions change
3. **Version Management**: Track builtin server versions
4. **Health Checks**: Verify builtin servers are functional

## Conclusion

The auto-initialization ensures that predefined Koompls work out of the box without manual setup. Cassy Calendar can now actually access calendar data, and Tracy Task can manage tasks on the kanban board.

Key achievements:
- ✅ Builtin MCP servers auto-created
- ✅ Predefined Koompls work immediately
- ✅ No manual configuration required
- ✅ Self-healing if servers are deleted
- ✅ Zero impact on existing functionality

Now when you test Cassy Calendar, you'll see real calendar interactions instead of placeholder responses!

