# Server Features

This directory contains feature-based functionality modules that provide a clean, reusable abstraction layer for business logic. These features can be used anywhere in the application: REST API endpoints, MCP servers, CRUD operations, and other server utilities.

## Architecture

Each feature module follows a consistent pattern:

1. **Context Interface**: Defines the execution context (teamId, userId, agentId, etc.)
2. **Feature Functions**: Business logic functions that wrap storage/utility operations
3. **Clean API**: Consistent, well-documented interface that abstracts storage details

## Available Features

### 📁 datasafe.ts
Secure team file vault with hierarchical organization, attachment capture, and rule-based placement.

**Key Functions:**
- `listFolder()` - List files and folders
- `uploadFile()` - Upload files with metadata
- `downloadFile()` - Retrieve file contents
- `recommendPlacement()` - Get rule-based folder recommendations
- `moveFile()` - Move files between folders
- `listRules()` / `updateRules()` - Manage organization rules
- `getStats()` - Get datasafe statistics

### 📋 kanban.ts
Team Kanban board management for task tracking and workflow visualization.

**Key Functions:**
- `listBoards()` / `getBoard()` - Retrieve boards
- `createBoard()` / `updateBoard()` / `deleteBoard()` - Board CRUD
- `createCard()` / `updateCard()` / `moveCard()` / `deleteCard()` - Card management
- `createColumn()` / `deleteColumn()` - Column management
- `getBoardStats()` - Get board statistics
- `searchCards()` - Search across all boards

### 📅 calendar.ts
Team calendar event management with availability checking.

**Key Functions:**
- `listEvents()` / `getEvent()` - Retrieve events
- `createEvent()` / `updateEvent()` / `deleteEvent()` - Event CRUD
- `getUserEvents()` / `getUsersEvents()` - User-specific events
- `getEventsByDateRange()` - Date-filtered events
- `getUpcomingEvents()` - Future events for a user
- `checkAvailability()` - Check scheduling conflicts
- `searchEvents()` - Search calendar events
- `getCalendarStats()` - Get calendar statistics

### 🤖 agent.ts
AI agent management with capabilities, directory, and communication policies.

**Key Functions:**
- `listAgents()` / `getAgent()` - Retrieve agents
- `createAgent()` / `updateAgent()` / `deleteAgent()` - Agent CRUD
- `getAgentByEmail()` - Find agent by email/username
- `getAgentDirectory()` - Get agents with capabilities
- `findAgentsByCapabilities()` - Search by capability
- `getAgentsWithMcpServer()` - Find agents using specific MCP server
- `canCommunicateWith()` - Check agent communication permissions
- `getAgentStats()` - Get agent statistics

### 🔌 mcp.ts
Model Context Protocol server management and agent execution.

**Key Functions:**
- `listServers()` / `getServer()` - Retrieve MCP servers
- `createServer()` / `updateServer()` / `deleteServer()` - Server CRUD
- `getServersByCategory()` / `getServersByProvider()` - Filtered retrieval
- `getBuiltinServers()` / `getExternalServers()` - Server type filtering
- `listProviderPresets()` / `listServerTemplates()` - Available configurations
- `createServerFromTemplate()` - Create from template
- `runAgent()` - Execute MCP agent with servers
- `checkServerHealth()` - Verify server accessibility
- `getServerStats()` - Get MCP server statistics

### 👥 team.ts
Team, user, and membership management with role-based access control.

**Key Functions:**
- `listUsers()` / `getUser()` / `getUserByEmail()` - User retrieval
- `saveUser()` / `removeUser()` - User management
- `listTeams()` / `getTeam()` / `getTeamByDomain()` - Team retrieval
- `saveTeam()` / `removeTeam()` - Team management
- `listMemberships()` / `getMembership()` - Membership retrieval
- `saveMembership()` / `removeMembership()` - Membership management
- `getTeamMembers()` / `getUserTeams()` - Cross-references
- `isTeamMember()` / `isTeamAdmin()` - Access checks
- `listSuperAdmins()` / `isSuperAdmin()` - Super admin management
- `validateTeamAccess()` - Team access validation
- `getTeamStats()` - Get team statistics

## Usage Examples

### From REST API Endpoints

```typescript
// server/api/kanban/boards.get.ts
import { listBoards } from '../../features/kanban'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const boards = await listBoards({ 
    teamId: session.team.id,
    userId: session.user.id
  })
  return { boards }
})
```

### From MCP Server Operations

```typescript
// server/mcp/builtin/kanban/operations.ts
import { createCard } from '../../../features/kanban'

export async function handleCreateCard(context, params) {
  return await createCard(
    { teamId: context.teamId, userId: context.userId },
    params.boardId,
    params.columnId,
    { title: params.title, description: params.description }
  )
}
```

### From Agent Helpers

```typescript
// server/utils/agentHelper.ts
import { getAgentDirectory } from '../features/agent'

export async function findBestAgent(capability: string, teamId: string) {
  const directory = await getAgentDirectory(teamId)
  return directory.find(agent => 
    agent.capabilities.includes(capability)
  )
}
```

## Context Pattern

All features use a consistent context pattern:

```typescript
interface FeatureContext {
  teamId: string      // Required: Team context
  userId?: string     // Optional: User performing action
  agentId?: string    // Optional: Agent performing action
}
```

This provides:
- **Team Isolation**: All operations are team-scoped
- **Audit Trail**: Track who (user/agent) performed actions
- **Permission Context**: Enable fine-grained access control

## Benefits

1. **Reusability**: Use the same logic across REST APIs, MCPs, and utilities
2. **Consistency**: Uniform interface and behavior
3. **Testability**: Business logic is isolated and easy to test
4. **Maintainability**: Changes to business logic happen in one place
5. **Type Safety**: Full TypeScript support with proper types
6. **Documentation**: Self-documenting through consistent patterns

## Adding New Features

To add a new feature module:

1. Create `server/features/your-feature.ts`
2. Define a context interface (if needed)
3. Implement feature functions following the established pattern
4. Export functions with clear documentation
5. Update this README with your feature

## Best Practices

- ✅ Keep feature functions focused and single-purpose
- ✅ Always use context for team/user scoping
- ✅ Validate inputs at the feature layer
- ✅ Return typed results or throw meaningful errors
- ✅ Document complex business logic
- ✅ Use storage layer functions for data access
- ✅ Add statistics/analytics functions when useful
- ❌ Don't include HTTP-specific logic (use event handlers for that)
- ❌ Don't mix storage implementation with business logic
- ❌ Don't duplicate logic across feature modules

