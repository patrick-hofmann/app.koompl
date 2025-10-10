# Feature Usage Examples

This document provides practical examples of using the feature modules across different parts of the application.

## Table of Contents

- [REST API Endpoints](#rest-api-endpoints)
- [MCP Server Operations](#mcp-server-operations)
- [Background Jobs & Utilities](#background-jobs--utilities)
- [Cross-Feature Workflows](#cross-feature-workflows)

## REST API Endpoints

### Example 1: Kanban Board Endpoint

```typescript
// server/api/kanban/boards/[id]/cards.post.ts
import { createCard } from '~/server/features/kanban'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const boardId = getRouterParam(event, 'id')
  const body = await readBody(event)
  
  const card = await createCard(
    {
      teamId: session.team.id,
      userId: session.user.id
    },
    boardId,
    body.columnId,
    {
      title: body.title,
      description: body.description,
      assignedTo: body.assignedTo,
      dueDate: body.dueDate,
      priority: body.priority,
      createdBy: session.user.id
    }
  )
  
  if (!card) {
    throw createError({ statusCode: 404, message: 'Board or column not found' })
  }
  
  return { card }
})
```

### Example 2: Calendar Event Endpoint with Availability Check

```typescript
// server/api/calendar/events/check-availability.post.ts
import { checkAvailability, createEvent } from '~/server/features/calendar'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { userId, startDate, endDate, title, description } = await readBody(event)
  
  // Check if user is available
  const availability = await checkAvailability(
    { teamId: session.team.id },
    userId,
    startDate,
    endDate
  )
  
  if (!availability.available) {
    return {
      success: false,
      conflicts: availability.conflicts,
      message: 'User has conflicting events'
    }
  }
  
  // Create the event
  const calendarEvent = await createEvent(
    {
      teamId: session.team.id,
      userId: session.user.id
    },
    {
      userId,
      title,
      description,
      startDate,
      endDate
    }
  )
  
  return { success: true, event: calendarEvent }
})
```

### Example 3: Agent Directory Search

```typescript
// server/api/agents/search.get.ts
import { findAgentsByCapabilities, getAgentDirectory } from '~/server/features/agent'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const query = getQuery(event)
  
  if (query.capability) {
    // Search by capability
    const agents = await findAgentsByCapabilities(
      String(query.capability),
      session.team.id
    )
    return { agents }
  }
  
  // Get all agents in directory
  const directory = await getAgentDirectory(session.team.id)
  return { directory }
})
```

## MCP Server Operations

### Example 1: Datasafe MCP Tool

```typescript
// server/mcp/builtin/datasafe/tools.ts
import { uploadFile, recommendPlacement } from '~/server/features/datasafe'

export const datasafeUploadTool = {
  name: 'datasafe_upload',
  description: 'Upload a file to the team datasafe with automatic folder placement',
  inputSchema: {
    type: 'object',
    properties: {
      filename: { type: 'string' },
      base64: { type: 'string' },
      mimeType: { type: 'string' }
    }
  },
  async execute(context: any, params: any) {
    // Get recommended folder based on rules
    const recommendation = await recommendPlacement(
      { teamId: context.teamId, agentId: context.agentId },
      {
        filename: params.filename,
        mimeType: params.mimeType,
        size: Buffer.from(params.base64, 'base64').length,
        data: params.base64,
        source: 'mcp'
      }
    )
    
    // Upload to recommended or default location
    const folderPath = recommendation?.folderPath || ''
    const filePath = folderPath ? `${folderPath}/${params.filename}` : params.filename
    
    const result = await uploadFile(
      { teamId: context.teamId, agentId: context.agentId },
      {
        path: filePath,
        base64: params.base64,
        mimeType: params.mimeType,
        size: Buffer.from(params.base64, 'base64').length,
        source: 'mcp',
        metadata: {
          agentId: context.agentId,
          uploadedAt: new Date().toISOString()
        }
      }
    )
    
    return {
      success: true,
      file: result,
      placedIn: folderPath || 'root',
      rulesApplied: recommendation?.ruleIds || []
    }
  }
}
```

### Example 2: Kanban MCP Tool

```typescript
// server/mcp/builtin/kanban/tools.ts
import { listBoards, searchCards } from '~/server/features/kanban'

export const kanbanSearchTool = {
  name: 'kanban_search',
  description: 'Search for cards across all Kanban boards',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' }
    }
  },
  async execute(context: any, params: any) {
    const results = await searchCards(
      { teamId: context.teamId, agentId: context.agentId },
      params.query
    )
    
    return {
      found: results.length,
      cards: results.map(r => ({
        board: r.board.name,
        column: r.column.title,
        card: {
          title: r.card.title,
          description: r.card.description,
          assignedTo: r.card.assignedTo,
          dueDate: r.card.dueDate
        }
      }))
    }
  }
}
```

## Background Jobs & Utilities

### Example 1: Daily Calendar Digest

```typescript
// server/utils/dailyDigest.ts
import { getUpcomingEvents } from '~/server/features/calendar'
import { getTeamMembers } from '~/server/features/team'

export async function sendDailyCalendarDigest(teamId: string) {
  const members = await getTeamMembers(teamId)
  
  for (const member of members) {
    // Get next 7 days of events
    const upcomingEvents = await getUpcomingEvents(
      { teamId },
      member.id,
      7
    )
    
    if (upcomingEvents.length === 0) continue
    
    // Send digest email
    await sendEmail(member.email, {
      subject: 'Your upcoming events',
      body: formatEventDigest(upcomingEvents)
    })
  }
}
```

### Example 2: Agent Health Check

```typescript
// server/utils/agentHealthCheck.ts
import { listAgents, getAgentStats } from '~/server/features/agent'
import { checkServerHealth } from '~/server/features/mcp'

export async function performAgentHealthCheck(teamId: string) {
  const agents = await listAgents({ teamId })
  const stats = await getAgentStats({ teamId })
  
  const healthReport = {
    timestamp: new Date().toISOString(),
    teamId,
    totalAgents: stats.totalAgents,
    agentStatus: [] as any[]
  }
  
  for (const agent of agents) {
    const serverHealth = await Promise.all(
      (agent.mcpServerIds || []).map(serverId => 
        checkServerHealth(serverId)
      )
    )
    
    healthReport.agentStatus.push({
      agentId: agent.id,
      name: agent.name,
      serverCount: agent.mcpServerIds?.length || 0,
      allServersHealthy: serverHealth.every(s => s.status === 'ok')
    })
  }
  
  return healthReport
}
```

## Cross-Feature Workflows

### Example 1: Email Attachment Processing

```typescript
// server/utils/emailProcessor.ts
import { storeAttachment } from '~/server/features/datasafe'
import { createEvent } from '~/server/features/calendar'
import { getAgentByEmail } from '~/server/features/agent'

export async function processIncomingEmail(teamId: string, email: any) {
  // 1. Check if sender is an agent
  const senderAgent = await getAgentByEmail(email.from, teamId)
  
  // 2. Process attachments
  const storedFiles = []
  for (const attachment of email.attachments || []) {
    const file = await storeAttachment(
      { teamId, agentId: senderAgent?.id },
      {
        filename: attachment.name,
        mimeType: attachment.contentType,
        size: attachment.size,
        data: attachment.content,
        source: 'email-attachment',
        emailMeta: {
          from: email.from,
          subject: email.subject,
          date: email.date
        }
      }
    )
    storedFiles.push(file)
  }
  
  // 3. Extract calendar invites
  const calendarInvite = parseCalendarInvite(email.body)
  if (calendarInvite) {
    await createEvent(
      { teamId, agentId: senderAgent?.id },
      {
        userId: calendarInvite.attendee,
        title: calendarInvite.title,
        description: calendarInvite.description,
        startDate: calendarInvite.start,
        endDate: calendarInvite.end,
        location: calendarInvite.location
      }
    )
  }
  
  return {
    filesStored: storedFiles.length,
    eventCreated: !!calendarInvite
  }
}
```

### Example 2: Project Creation Workflow

```typescript
// server/utils/projectWorkflow.ts
import { createBoard } from '~/server/features/kanban'
import { createEvent } from '~/server/features/calendar'
import { createFolder } from '~/server/features/datasafe'
import { getTeamMembers } from '~/server/features/team'

export async function createProject(
  teamId: string,
  userId: string,
  project: {
    name: string
    description: string
    kickoffDate: string
    dueDate: string
    members: string[]
  }
) {
  // 1. Create Kanban board
  const board = await createBoard(
    { teamId, userId },
    {
      name: project.name,
      description: project.description,
      initialColumns: ['Backlog', 'In Progress', 'Review', 'Done']
    }
  )
  
  // 2. Create project folder in datasafe
  const folder = await createFolder(
    { teamId, userId },
    `Projects/${project.name}`
  )
  
  // 3. Schedule kickoff meeting
  const kickoffEvent = await createEvent(
    { teamId, userId },
    {
      userId,
      title: `${project.name} - Kickoff Meeting`,
      description: project.description,
      startDate: project.kickoffDate,
      endDate: new Date(new Date(project.kickoffDate).getTime() + 60 * 60 * 1000).toISOString(),
      tags: ['kickoff', 'project']
    }
  )
  
  return {
    board,
    folder,
    kickoffEvent,
    projectUrl: `/kanban?board=${board.id}`
  }
}
```

### Example 3: Team Analytics Dashboard

```typescript
// server/api/analytics/dashboard.get.ts
import { getBoardStats } from '~/server/features/kanban'
import { getCalendarStats } from '~/server/features/calendar'
import { getAgentStats } from '~/server/features/agent'
import { getTeamStats } from '~/server/features/team'
import { getServerStats } from '~/server/features/mcp'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team.id
  
  const [kanban, calendar, agents, team, mcp] = await Promise.all([
    getBoardStats({ teamId }, 'primary-board'),
    getCalendarStats({ teamId }),
    getAgentStats({ teamId }),
    getTeamStats(teamId),
    getServerStats()
  ])
  
  return {
    teamId,
    generatedAt: new Date().toISOString(),
    kanban: {
      totalCards: kanban?.totalCards || 0,
      totalColumns: kanban?.totalColumns || 0
    },
    calendar: {
      totalEvents: calendar.totalEvents,
      upcomingEvents: calendar.upcomingEvents
    },
    agents: {
      total: agents.totalAgents,
      predefined: agents.predefinedAgents,
      custom: agents.customAgents
    },
    team: {
      members: team.totalUsers,
      admins: team.adminCount
    },
    mcp: {
      totalServers: mcp.totalServers,
      builtin: mcp.builtinServers,
      external: mcp.externalServers
    }
  }
})
```

## Best Practices

### ✅ DO:
- Always pass proper context (teamId, userId, agentId)
- Handle null/undefined returns gracefully
- Use TypeScript types for type safety
- Combine features for complex workflows
- Validate inputs before calling features
- Log errors with context information

### ❌ DON'T:
- Don't bypass features to access storage directly
- Don't hardcode team/user IDs
- Don't ignore error handling
- Don't mix HTTP logic with feature calls
- Don't create circular dependencies between features

