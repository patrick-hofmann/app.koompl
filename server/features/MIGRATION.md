# API Endpoints Migration to Features

This document tracks the migration of API endpoints from direct storage/utility imports to using the new feature modules.

## Migration Status

### ✅ Completed (9 endpoints)

#### Kanban
- ✅ `/api/kanban/boards.get.ts` - using `listBoards()`
- ✅ `/api/kanban/boards.post.ts` - using `createBoard()`
- ✅ `/api/kanban/boards/[id].get.ts` - using `getBoard()`

#### Calendar
- ✅ `/api/calendar/events.get.ts` - using `listEvents()`, `getEventsByDateRange()`, `getUsersEvents()`
- ✅ `/api/calendar/events.post.ts` - using `createEvent()`

#### Agent
- ✅ `/api/agents/index.ts` - using `listAgents()`, `createAgent()`, `updateAgent()`, `deleteAgent()`

#### Datasafe
- ✅ `/api/datasafe/tree.get.ts` - using `getTree()`
- ✅ `/api/datasafe/upload.post.ts` - using `uploadFile()`
- ✅ `/api/datasafe/download.get.ts` - using `downloadFile()`

### 🔄 In Progress (31 endpoints remaining)

#### Datasafe (4 more)
- 🔄 `/api/datasafe/folders.post.ts` - needs `createFolder()`
- 🔄 `/api/datasafe/move.post.ts` - needs `moveFile()`
- 🔄 `/api/datasafe/recommend.post.ts` - needs `recommendPlacement()`
- 🔄 `/api/datasafe/rules.get.ts` - needs `listRules()`
- 🔄 `/api/datasafe/rules.post.ts` - needs `updateRules()`

#### Calendar (3 more)
- 🔄 `/api/calendar/events/[eventId].get.ts` - needs `getEvent()`
- 🔄 `/api/calendar/events/[eventId].patch.ts` - needs `updateEvent()`
- 🔄 `/api/calendar/events/[eventId].delete.ts` - needs `deleteEvent()`

#### Kanban (9 more)
- 🔄 `/api/kanban/boards/[id].patch.ts` - needs `updateBoard()`
- 🔄 `/api/kanban/boards/[id].delete.ts` - needs `deleteBoard()`
- 🔄 `/api/kanban/boards/[id]/cards.post.ts` - needs `createCard()`
- 🔄 `/api/kanban/boards/[id]/cards/[cardId].patch.ts` - needs `updateCard()`
- 🔄 `/api/kanban/boards/[id]/cards/[cardId].delete.ts` - needs `deleteCard()`
- 🔄 `/api/kanban/boards/[id]/cards/move.post.ts` - needs `moveCard()`
- 🔄 `/api/kanban/boards/[id]/columns.post.ts` - needs `createColumn()`
- 🔄 `/api/kanban/boards/[id]/columns/[columnId].delete.ts` - needs `deleteColumn()`

#### Team/Admin (15 more)
- 🔄 `/api/members.ts` - needs `getTeamMembers()`
- 🔄 `/api/team/domain.get.ts` - needs `getTeam()`
- 🔄 `/api/admin/teams/index.post.ts` - needs `saveTeam()`
- 🔄 `/api/admin/teams/[id].patch.ts` - needs `saveTeam()`
- 🔄 `/api/admin/teams/[id].delete.ts` - needs `removeTeam()`
- 🔄 `/api/admin/teams/[id]/domain.get.ts` - needs `getTeam()`
- 🔄 `/api/admin/teams/[id]/domain.patch.ts` - needs `saveTeam()`
- 🔄 `/api/admin/users/index.post.ts` - needs `saveUser()`
- 🔄 `/api/admin/users/[id].patch.ts` - needs `saveUser()`
- 🔄 `/api/admin/users/[id].delete.ts` - needs `removeUser()`
- 🔄 `/api/admin/super-admins/index.post.ts` - needs `makeSuperAdmin()`
- 🔄 `/api/admin/super-admins/[id].delete.ts` - needs `revokeSuperAdmin()`
- 🔄 `/api/admin/memberships/index.post.ts` - needs `saveMembership()`
- 🔄 `/api/admin/memberships/[id].patch.ts` - needs `saveMembership()`
- 🔄 `/api/admin/memberships/[id].delete.ts` - needs `removeMembership()`

#### Agent/MCP (4 more)
- 🔄 `/api/agent/[email]/inbound.post.ts` - complex, may need multiple features
- 🔄 `/api/agent/[email]/prompt.post.ts` - needs `getAgentByEmail()`, MCP features
- 🔄 `/api/agents/test.ts` - needs agent and MCP features
- 🔄 `/api/admin/agents.get.ts` - needs `listAgents()`

### Migration Pattern

**Before:**
```typescript
import { getTeamBoards } from '../../utils/kanbanStorage'
const boards = await getTeamBoards(teamId)
```

**After:**
```typescript
import { listBoards } from '../../features/kanban'
const boards = await listBoards({ teamId, userId: session.user?.id })
```

### Benefits of Migration

1. **Consistent API** - All endpoints use the same context pattern
2. **Better Tracking** - userId context enables better audit trails
3. **Reusable Logic** - Business logic centralized in features
4. **Type Safety** - Full TypeScript support with exported types
5. **Maintainability** - Changes to business logic in one place

### Next Steps

1. Continue migrating remaining endpoints systematically
2. Test each migrated endpoint to ensure functionality
3. Update integration tests to use feature functions
4. Document any breaking changes (none expected)
5. Consider deprecating direct storage imports

