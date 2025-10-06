# Kanban Board Feature

## Overview

The Kanban Board feature provides a comprehensive task management system with team-based access control and AI agent integration through a built-in MCP (Model Context Protocol) server.

## Features

### 1. Team-Based Kanban Boards
- **Multi-board support**: Create and manage multiple Kanban boards per team
- **Customizable columns**: Define your own workflow stages
- **Rich card properties**:
  - Title and description
  - Assignee
  - Priority (Low, Medium, High)
  - Tags
  - Ticket references (e.g., MC-2037)
  - Timestamps (created/updated)

### 2. User Interface
- **Drag-and-drop**: Move cards between columns with intuitive drag-and-drop
- **Board selector**: Switch between multiple boards easily
- **Card modals**: Rich editing interface for cards
- **Responsive design**: Works on desktop and tablet devices
- **Real-time updates**: Changes are immediately reflected

### 3. Built-in MCP Server for AI Agents

The Kanban board includes a built-in MCP server that allows AI agents to interact with team boards. This is a **default MCP server** that doesn't require external setup.

#### Agent Capabilities

Agents with the Kanban MCP server enabled can:

1. **View Boards**: List all team boards and their structure
2. **Read Cards**: Access card details including title, description, assignee, priority, tags, and tickets
3. **Create Cards**: Add new cards to any column
4. **Update Cards**: Modify card properties
5. **Move Cards**: Change card status by moving between columns
6. **Delete Cards**: Remove cards when needed
7. **Search Cards**: Find cards by title, description, assignee, or ticket number
8. **Filter by Assignee**: Get all cards assigned to a specific user

## Architecture

### Data Storage
- **Storage Backend**: Uses Nitro's `identity` storage namespace
- **Persistence**: Data is stored per team in the format `kanban:team:{teamId}`
- **Structure**: JSON-based storage with boards, columns, and cards

### API Endpoints

#### Board Management
- `GET /api/kanban/boards` - List all boards for current team
- `POST /api/kanban/boards` - Create a new board
- `GET /api/kanban/boards/:id` - Get a specific board
- `PATCH /api/kanban/boards/:id` - Update board metadata
- `DELETE /api/kanban/boards/:id` - Delete a board

#### Card Management
- `POST /api/kanban/boards/:id/cards` - Create a new card
- `PATCH /api/kanban/boards/:id/cards/:cardId` - Update a card
- `DELETE /api/kanban/boards/:id/cards/:cardId` - Delete a card
- `POST /api/kanban/boards/:id/cards/move` - Move a card between columns

#### Column Management
- `POST /api/kanban/boards/:id/columns` - Add a new column
- `DELETE /api/kanban/boards/:id/columns/:columnId` - Delete a column

### MCP Integration

The Kanban MCP server is integrated into the agent system at multiple levels:

1. **Type System**: Added `builtin-kanban` to `McpProvider` type and `productivity` to `McpCategory`
2. **Storage**: Registered in `mcpStorage.ts` with provider presets and templates
3. **Client Handler**: Integrated in `mcpClients.ts` to fetch Kanban context
4. **Agent Responder**: Passes team and user context to enable Kanban access
5. **Context Fetching**: Provides board summaries to agents automatically

## Usage

### For Users

#### Creating a Board
1. Navigate to the Kanban page from the main navigation
2. Click "New Board"
3. Enter board name, description, and define columns
4. Click "Create Board"

#### Managing Cards
1. Click "Add Card" in any column
2. Fill in card details (title, description, assignee, priority, tags, ticket)
3. Drag and drop cards between columns to update status
4. Click on a card to edit or delete it

#### Working with Multiple Boards
1. Use the board selector dropdown to switch between boards
2. Delete boards using the "Delete Board" button

### For Agents

#### Enabling Kanban Access
1. Go to MCP Servers page
2. Add "Team Kanban Board" from templates
3. Go to Agents page
4. Edit an agent and add the Kanban MCP server to its configuration
5. The agent will now have access to team Kanban boards

#### Agent Interactions

Agents can interact with Kanban boards naturally through conversation:

**Example prompts:**
- "Show me all our Kanban boards"
- "What cards are assigned to John?"
- "Create a new card in the 'To Do' column for implementing user authentication"
- "Move the authentication card to 'In Progress'"
- "What's the status of ticket MC-2037?"
- "List all high-priority cards"
- "Update the description of the user auth card"

The agent receives board context automatically and can perform actions through the MCP server functions.

## Technical Details

### MCP Server Functions

The built-in Kanban MCP server (`server/utils/mcpKanban.ts`) provides:

- `fetchKanbanContext()` - Get board summaries for agent context
- `listBoards()` - List all team boards
- `getBoardByIdOrName()` - Get board by ID or name (flexible lookup)
- `listCards()` - List cards from a board, optionally filtered by column
- `createCard()` - Add a new card to a column
- `modifyCard()` - Update card properties
- `moveCardToColumn()` - Move a card to a different column
- `removeCard()` - Delete a card
- `searchCards()` - Search cards by query
- `getCardsByAssignee()` - Filter cards by assignee

### Security

- **Team Isolation**: Each team can only access their own boards
- **Session-Based**: Uses user session for authentication
- **Built-in Trust**: The Kanban MCP server is built-in and trusted by default

### Data Model

```typescript
interface KanbanBoard {
  id: string
  teamId: string
  name: string
  description?: string
  columns: KanbanColumn[]
  createdAt: string
  updatedAt: string
}

interface KanbanColumn {
  id: string
  title: string
  cards: KanbanCard[]
  order: number
}

interface KanbanCard {
  id: string
  title: string
  description?: string
  assignee?: string
  priority?: 'Low' | 'Medium' | 'High'
  tags?: string[]
  ticket?: string
  createdAt: string
  updatedAt: string
  createdBy: string
}
```

## Future Enhancements

Possible improvements for the Kanban board feature:

1. **Advanced Filtering**: Filter cards by priority, tags, or assignee in the UI
2. **Card Comments**: Add discussion threads to cards
3. **Due Dates**: Add deadlines and calendar integration
4. **Card Attachments**: Upload files to cards
5. **Board Templates**: Predefined board structures for common workflows
6. **Activity Log**: Track all changes to boards and cards
7. **Notifications**: Alert users when assigned to cards or mentioned
8. **Card Dependencies**: Link related cards
9. **Time Tracking**: Log time spent on cards
10. **Export/Import**: Export boards to JSON or import from other systems
11. **Swimlanes**: Horizontal organization of cards
12. **WIP Limits**: Set work-in-progress limits per column
13. **Board Permissions**: Fine-grained access control
14. **Webhooks**: Trigger external actions on card events

## Integration Examples

### Example: Agent Creating a Card

When an agent receives: "Create a task for implementing dark mode with high priority"

The agent (with Kanban MCP enabled) will:
1. Access the team's Kanban boards through the MCP context
2. Identify the appropriate board and column
3. Call `createCard()` with the details
4. Respond with confirmation

### Example: Agent Status Update

When asked: "What's the status of our sprint?"

The agent can:
1. Fetch all cards from the current sprint board
2. Analyze distribution across columns
3. Identify high-priority items
4. Report on assignee workload
5. Provide a comprehensive status summary

## Troubleshooting

### Cards Not Showing
- Verify you're viewing the correct board
- Check that your team context is set properly
- Refresh the page

### Agent Can't Access Kanban
- Ensure the Kanban MCP server is added to the MCP Servers page
- Verify the agent has the Kanban MCP server in its configuration
- Check that the agent has team context (works for authenticated users)

### Drag and Drop Not Working
- Ensure JavaScript is enabled
- Try refreshing the page
- Check browser console for errors

## Files Overview

### Backend
- `server/types/kanban.d.ts` - TypeScript type definitions
- `server/utils/kanbanStorage.ts` - Storage operations and CRUD functions
- `server/utils/mcpKanban.ts` - Built-in MCP server implementation
- `server/api/kanban/**/*.ts` - API endpoints

### Frontend
- `app/pages/kanban.vue` - Main Kanban page
- `app/components/kanban/KanbanBoard.vue` - Board display component
- `app/components/kanban/CardModal.vue` - Card editing modal
- `app/components/kanban/NewBoardModal.vue` - Board creation modal

### Integration
- `app/types/index.d.ts` - Updated with Kanban types
- `server/utils/mcpStorage.ts` - Kanban MCP provider registration
- `server/utils/mcpClients.ts` - Kanban MCP client integration
- `server/utils/agentResponder.ts` - Team context passing
- `app/layouts/default.vue` - Navigation link

## Conclusion

The Kanban Board feature provides a powerful, team-based task management system with seamless AI agent integration. The built-in MCP server allows agents to interact with boards naturally, making it easy to automate workflow management and keep projects organized.

