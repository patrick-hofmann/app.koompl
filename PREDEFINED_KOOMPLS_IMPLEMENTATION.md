# Predefined Koompls Implementation

## Overview

This document describes the implementation of predefined Koompls - specialized, pre-configured AI agents that can be easily enabled or disabled by users.

## Features Implemented

### 1. Agent Type Extension
- Added `isPredefined` field to the `Agent` type to distinguish predefined from custom Koompls
- Located in: `app/types/index.d.ts`

### 2. Predefined Koompl Definitions
Created three predefined Koompls with specific roles and configurations:

#### Chris Coordinator
- **Email**: `chris@koompls.local`
- **Role**: Coordinator
- **Purpose**: Knows all active Koompls and delegates emails to the right specialist
- **Configuration**:
  - Max Rounds: 10
  - Timeout: 60 minutes
  - Inter-Agent Communication: Enabled
  - Can coordinate between multiple Koompls

#### Cassy Calendar
- **Email**: `cassy@koompls.local`
- **Role**: Calendar Manager
- **Purpose**: Manages calendar and schedules using the built-in calendar MCP
- **Configuration**:
  - Max Rounds: 5
  - Timeout: 30 minutes
  - MCP Servers: `builtin-calendar`
  - Specialized in calendar operations

#### Tracy Task
- **Email**: `tracy@koompls.local`
- **Role**: Task Manager
- **Purpose**: Manages taskboard using the built-in kanban MCP
- **Configuration**:
  - Max Rounds: 5
  - Timeout: 30 minutes
  - MCP Servers: `builtin-kanban`
  - Specialized in task and project management

### 3. UI Components

#### PredefinedKoomplTile Component
- **Location**: `app/components/agents/PredefinedKoomplTile.vue`
- **Features**:
  - Beautiful card design with color-coded themes
  - Checkbox to enable/disable the Koompl
  - Shows Koompl name, email, role, and description
  - Info button to view system prompt
  - Loading state during enable/disable operations
  - Decorative gradient background
  - Hover effects and animations

#### PredefinedKoomplInfoModal Component
- **Location**: `app/components/agents/PredefinedKoomplInfoModal.vue`
- **Features**:
  - Displays complete Koompl information
  - Shows system prompt in a formatted code block
  - Configuration details (max rounds, timeout, etc.)
  - MCP server assignments
  - Clean, readable layout

### 4. Updated Agents Page
- **Location**: `app/pages/agents/index.vue`
- **Changes**:
  - Split into two sections: "Predefined Koompls" and "Custom Koompls"
  - Predefined Koompls shown as attractive tiles at the top
  - Custom Koompls remain in table format below
  - Enable/disable predefined Koompls with one click
  - Predefined agents automatically filtered from custom list

### 5. API Enhancements

#### Agent Creation API (`server/api/agents/index.ts`)
- Supports creating predefined agents with fixed IDs
- Prevents duplicate predefined agents
- Preserves predefined status during operations

#### Agent Update API (`server/api/agents/[id].ts`)
- Prevents changing `isPredefined` status
- Restricts editing of core properties for predefined agents

#### Edit Agent Modal (`app/components/agents/EditAgentModal.vue`)
- Shows info alert for predefined agents
- Disables editing of name, email, role, and prompt for predefined agents
- Allows editing of MCP servers and flow configuration

### 6. Composable for Predefined Koompls
- **Location**: `app/composables/usePredefinedKoompls.ts`
- **Exports**:
  - `PREDEFINED_KOOMPLS`: Array of predefined Koompl definitions
  - `getPredefinedKoompls()`: Get all predefined Koompls
  - `getPredefinedKoompl(id)`: Get a specific predefined Koompl
  - `predefinedToAgent(predefined, teamId)`: Convert to Agent object
  - `isPredefinedEnabled(id, agents)`: Check if enabled

## User Experience

### Enabling a Predefined Koompl
1. Navigate to the Koompls page
2. See predefined Koompls as attractive tiles at the top
3. Click the checkbox to enable
4. Koompl is immediately created and ready to receive emails

### Disabling a Predefined Koompl
1. Uncheck the checkbox on an enabled predefined Koompl
2. Koompl is removed from active agents
3. Can be re-enabled at any time

### Viewing Predefined Koompl Details
1. Click "View Prompt" button on any predefined Koompl tile
2. Modal opens showing:
   - Complete system prompt
   - Configuration settings
   - MCP server assignments
   - Role and description

### Custom vs Predefined
- **Predefined Koompls**: Cannot be deleted permanently, only disabled
- **Custom Koompls**: Can be fully created, edited, and deleted
- Clear visual separation between the two types

## Technical Details

### Data Flow
1. Predefined definitions stored in `usePredefinedKoompls` composable
2. When enabled, creates a regular `Agent` with `isPredefined: true`
3. When disabled, deletes the agent (can be recreated)
4. UI filters predefined agents from custom agent list

### Security & Validation
- Predefined agent IDs are fixed and cannot be changed
- Core properties (name, email, role, prompt) cannot be modified for predefined agents
- `isPredefined` status cannot be changed once set
- Duplicate predefined agents are prevented

## Design Highlights

### Color Scheme
- **Chris Coordinator**: Blue theme (coordination/networking)
- **Cassy Calendar**: Green theme (organization/scheduling)
- **Tracy Task**: Purple theme (productivity/tasks)

### Visual Elements
- Gradient backgrounds for depth
- Smooth hover animations
- Clear status indicators
- Consistent spacing and typography
- Responsive grid layout (1 column on mobile, 2 on tablet, 3 on desktop)

## Future Enhancements

Potential improvements for future iterations:
1. Allow teams to create their own predefined Koompls
2. Marketplace for sharing predefined Koompl templates
3. Import/export predefined Koompl definitions
4. Analytics on predefined Koompl usage
5. More predefined Koompls for common use cases
6. Customizable predefined Koompl prompts (with constraints)
7. Version control for predefined Koompl definitions

## Testing Recommendations

1. **Enable/Disable Flow**:
   - Enable each predefined Koompl
   - Verify they appear in agents list
   - Send test emails to their addresses
   - Disable and verify removal

2. **UI/UX Testing**:
   - Test responsive layout on different screen sizes
   - Verify all animations and hover effects
   - Check loading states during operations
   - Ensure info modal displays correctly

3. **Data Integrity**:
   - Verify predefined agents have correct IDs
   - Check that `isPredefined` flag is preserved
   - Ensure core properties cannot be modified
   - Test that MCP servers are correctly assigned

4. **Integration Testing**:
   - Test Chris Coordinator delegation
   - Test Cassy Calendar with calendar MCP
   - Test Tracy Task with kanban MCP
   - Verify inter-agent communication

## Conclusion

The predefined Koompls feature provides users with ready-to-use, specialized AI agents that can be enabled with a single click. The implementation maintains a clean separation between predefined and custom agents while providing an appealing and intuitive user interface.

