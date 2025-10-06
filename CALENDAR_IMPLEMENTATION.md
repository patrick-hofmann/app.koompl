# Team Calendar Implementation

This document describes the implementation of the team calendar feature in the app.koompl project.

## Overview

The calendar feature allows team members to create, view, and manage calendar events. Each team has one calendar overview, but each team member has their own calendar entries. Users can view their own events and selectively view events from other team members.

## Architecture

The calendar implementation follows the same pattern as the Kanban boards feature:

### 1. Storage Layer
- **File**: `server/utils/calendarStorage.ts`
- **Storage**: Uses Nitro's identity storage (`useStorage('identity')`)
- **Key Format**: `calendar:team:{teamId}`
- **Functions**:
  - `getTeamCalendarEvents()` - Get all events for a team
  - `getUserCalendarEvents()` - Get events for specific user
  - `getUsersCalendarEvents()` - Get events for multiple users
  - `getCalendarEventsByDateRange()` - Get events within date range
  - `createCalendarEvent()` - Create new event
  - `updateCalendarEvent()` - Update existing event
  - `deleteCalendarEvent()` - Delete event
  - `searchCalendarEvents()` - Search events by query

### 2. Type Definitions
- **File**: `server/types/calendar.d.ts`
- **Types**:
  - `CalendarEvent` - Individual calendar event
  - `TeamCalendar` - Team calendar structure
  - `CalendarEventList` - Dictionary of events

### 3. MCP Server Integration

#### MCP Functions (`server/utils/mcpCalendar.ts`)
- `fetchCalendarContext()` - Get calendar summary for context
- `listEvents()` - List all events (with optional filters)
- `getEventById()` - Get specific event
- `createEvent()` - Create new event
- `modifyEvent()` - Update event (owner only)
- `removeEvent()` - Delete event (owner only)
- `searchEvents()` - Search events
- `getEventsByUser()` - Get events for specific user
- `getEventsByUsers()` - Get events for multiple users

#### Built-in MCP Server (`server/utils/builtinCalendarMcpServer.ts`)
- Standalone MCP server executable
- Implements Model Context Protocol
- Exposes calendar tools to AI agents
- Environment variables:
  - `CALENDAR_TEAM_ID` - Team context
  - `CALENDAR_USER_ID` - User context
  - `CALENDAR_AGENT_ID` - Optional agent ID

#### Built-in Tools Executor (`server/utils/builtinCalendarTools.ts`)
- Direct tool execution without HTTP overhead
- Export `getCalendarTools()` - Returns tool definitions
- Export `executeCalendarTool()` - Executes tools directly

### 4. API Endpoints

All endpoints require authentication and team membership.

#### GET `/api/calendar/events`
- List calendar events
- Query params:
  - `startDate` - Filter by start date (ISO 8601)
  - `endDate` - Filter by end date (ISO 8601)
  - `userIds` - Filter by user IDs (string or array)

#### POST `/api/calendar/events`
- Create new calendar event
- Body: Event data (title, startDate, endDate required)

#### GET `/api/calendar/events/[eventId]`
- Get specific event details

#### PATCH `/api/calendar/events/[eventId]`
- Update event (owner only)
- Body: Partial event data

#### DELETE `/api/calendar/events/[eventId]`
- Delete event (owner only)

#### POST `/api/calendar/builtin-calendar.post.ts`
- MCP server endpoint for agents
- Spawns built-in calendar MCP server
- Handles JSON-RPC requests

### 5. Frontend Components

#### CalendarView (`app/components/calendar/CalendarView.vue`)
- Month view calendar display
- Shows events on appropriate days
- Features:
  - Month navigation (prev/next/today)
  - Day highlighting
  - Event display with colors
  - Click to view/edit events
  - Click on day to create event

#### EventModal (`app/components/calendar/EventModal.vue`)
- Create/edit event modal
- Fields:
  - Title (required)
  - Description
  - Start/End dates (datetime-local inputs)
  - All-day toggle
  - Location
  - Color picker
  - Tags (add/remove)
- Actions:
  - Save (create or update)
  - Delete (edit mode only)
  - Cancel

#### Calendar Page (`app/pages/calendar.vue`)
- Main calendar page
- Sidebar with user filtering:
  - "Show All" checkbox
  - Individual user checkboxes
  - Color legend for each user
- Calendar view area
- New Event button
- Integration with toast notifications

### 6. Navigation

Calendar link added to main sidebar navigation:
- Icon: `i-lucide-calendar-days`
- Route: `/calendar`
- Position: After Kanban, before MCP Servers

### 7. MCP Server Template

Added to `server/utils/mcpStorage.ts`:
- Provider: `builtin-calendar`
- Category: `calendar`
- Template ID: `builtin-calendar-template`
- Icon: `i-lucide-calendar-days`
- Color: `blue`

## Features

### User Features
1. **View Calendar** - Monthly view of all team events
2. **Filter by User** - Select which team members' events to display
3. **Create Events** - Click on a day or "New Event" button
4. **Edit Events** - Click on event to edit (own events only)
5. **Delete Events** - Delete button in edit modal (own events only)
6. **Search Events** - Search by title, description, location, tags
7. **Color Coding** - Each user has a consistent color
8. **All-Day Events** - Support for all-day events
9. **Tags** - Add tags to categorize events
10. **Locations** - Add location information

### Agent Features (via MCP)
1. **List Events** - Get all team events or filtered by date/user
2. **View Event** - Get specific event details
3. **Create Events** - Create events on behalf of user
4. **Update Events** - Modify existing events (permission checked)
5. **Delete Events** - Remove events (permission checked)
6. **Search Events** - Find events by keywords
7. **User Events** - Get events for specific users

## Permissions

- Users can only edit/delete their own events
- Users can view events from all team members (with filtering)
- Agents can only modify events for the user they're acting on behalf of

## Data Structure

### CalendarEvent
```typescript
{
  id: string                    // Unique event ID
  teamId: string               // Team this event belongs to
  userId: string               // Owner of the event
  title: string                // Event title
  description?: string         // Optional description
  startDate: string            // ISO 8601 datetime
  endDate: string              // ISO 8601 datetime
  allDay?: boolean             // All-day event flag
  location?: string            // Event location
  attendees?: string[]         // List of attendee IDs
  color?: string               // Color for display (hex)
  tags?: string[]              // Tags for categorization
  recurrence?: {...}           // Recurrence pattern (future)
  createdAt: string            // Creation timestamp
  updatedAt: string            // Last update timestamp
  createdBy: string            // Creator user ID
}
```

## Future Enhancements

1. **Recurrence** - Recurring events (daily, weekly, monthly, yearly)
2. **Attendees** - Invite other team members to events
3. **Reminders** - Email/push notifications for upcoming events
4. **Event Types** - Different event categories (meeting, deadline, etc.)
5. **iCal Export** - Export to calendar applications
6. **Week/Day Views** - Additional calendar view options
7. **Drag & Drop** - Move events between days
8. **Time Zone Support** - Handle different time zones
9. **Event Templates** - Reusable event templates
10. **Calendar Sync** - Sync with external calendars (Google, Outlook)

## Testing

To test the calendar feature:

1. **Manual Testing**:
   - Navigate to `/calendar`
   - Create a new event
   - Edit an existing event
   - Delete an event
   - Filter by users
   - Test all-day events
   - Test with multiple team members

2. **Agent Testing**:
   - Add "Team Calendar" MCP server in MCP Servers page
   - Configure an agent to use the calendar server
   - Test agent creating/viewing/modifying events

3. **API Testing**:
   ```bash
   # List events
   GET /api/calendar/events
   
   # Create event
   POST /api/calendar/events
   Content-Type: application/json
   {
     "title": "Team Meeting",
     "startDate": "2024-01-15T10:00:00Z",
     "endDate": "2024-01-15T11:00:00Z"
   }
   
   # Update event
   PATCH /api/calendar/events/{eventId}
   Content-Type: application/json
   {
     "title": "Updated Meeting Title"
   }
   
   # Delete event
   DELETE /api/calendar/events/{eventId}
   ```

## Implementation Summary

The calendar feature has been fully implemented with:
- ✅ Backend storage layer
- ✅ Type definitions
- ✅ MCP server integration
- ✅ API endpoints
- ✅ Frontend components
- ✅ Navigation integration
- ✅ User filtering
- ✅ Permission system
- ✅ Built-in MCP template

The implementation follows the same proven pattern as the Kanban boards, ensuring consistency and maintainability.

