# Multi-Round Configuration UI Implementation

## Overview
This document describes the implementation of the Multi-Round Configuration UI for agents, allowing users to configure complex, multi-step conversations with inter-agent communication.

## Changes Made

### 1. Frontend Components

#### A. Unified EditAgentModal.vue (`app/components/agents/EditAgentModal.vue`)

Created a single, reusable modal component that handles **both creating and editing** agents with multi-round configuration. This eliminates code duplication and ensures consistency.

**Key Features:**
- Automatically detects if it's in "create" or "edit" mode based on whether `agent.id` exists
- Dynamic title and button labels ("Add Koompl" vs "Edit Koompl", "Create" vs "Save")
- Handles POST requests for new agents and PATCH requests for updates
- Shows avatar refresh button only in edit mode
- Scrollable content area (max 70vh height) for long forms

#### B. Agent Index Page (`app/pages/agents/index.vue`)

Updated to use the unified `EditAgentModal` component for both creating and editing agents, removing ~150 lines of duplicate code.

Features implemented in the modal:

#### Features Implemented:
- **Collapsible Accordion Section**: "Multi-Round Configuration" with visual status indicator (Enabled/Disabled)
- **Enable Toggle**: Master switch to enable/disable multi-round processing
- **Max Rounds Input**: Number input (1-50) to set maximum conversation rounds (default: 10)
- **Timeout Input**: Number input (1-1440 minutes) for flow timeout (default: 60 minutes)
- **Inter-Agent Communication Toggle**: Enable/disable agent-to-agent communication
- **Allowed Agents Selection**: 
  - Multi-select checkboxes with agent avatars, names, emails, and roles
  - Real-time agent list loading with refresh button
  - Visual feedback when no specific agents are selected (means "all agents allowed")
  - Filters out the current agent from the selection list
- **Auto-Resume Toggle**: Enable/disable automatic flow resumption on response

#### UX Features:
- Clear descriptions for each field explaining what it does
- Sensible default values pre-populated
- Progressive disclosure (fields only show when relevant)
- Loading states and skeleton loaders
- Empty states with helpful messages
- Visual badges showing agent status
- Information alerts to guide users
- Consistent styling with the rest of the application

### 2. Backend: Agent API (`server/api/agents/index.ts`)

Updated the POST endpoint to properly handle `multiRoundConfig` when creating new agents:
- Now includes `multiRoundConfig` in the agent creation payload
- Ensures the configuration is persisted alongside other agent properties

### 3. Type Safety

The implementation uses the existing type definitions from:
- `app/types/index.d.ts` - Contains the `MultiRoundConfig` interface
- `server/types/agent-flows.d.ts` - Contains extended type definitions

## Configuration Options

The `MultiRoundConfig` interface includes:

```typescript
interface MultiRoundConfig {
  enabled: boolean                    // Enable multi-round processing
  maxRounds: number                   // Max rounds per flow (default: 10)
  timeoutMinutes: number              // Flow timeout in minutes (default: 60)
  canCommunicateWithAgents: boolean   // Can this agent message other agents?
  allowedAgentIds?: string[]          // Whitelist of agents (empty = all allowed)
  autoResumeOnResponse: boolean       // Auto-resume flow on response
}
```

## How to Use

### Creating a New Agent with Multi-Round Config

1. Navigate to the Agents page
2. Click "Add Koompl"
3. Fill in the basic agent details (Name, Email, Role, System Prompt)
4. Scroll to the "Multi-Round Configuration" section
5. Click the accordion to expand
6. Toggle "Enable Multi-Round Processing"
7. Configure the settings as needed:
   - Set maximum rounds (how many back-and-forth exchanges)
   - Set timeout (how long before the flow expires)
   - Enable inter-agent communication if needed
   - Select specific agents to allow communication with (or leave empty for all)
   - Choose whether to auto-resume flows
8. Click "Create" to create the agent with multi-round config

### Editing an Existing Agent

1. Navigate to the Agents page
2. Click "Edit" on any agent
3. Scroll to the "Multi-Round Configuration" section
4. Click the accordion to expand
5. Toggle "Enable Multi-Round Processing"
6. Configure the settings as needed (same options as above)
7. Click "Save" to persist the configuration

## Default Values

When multi-round configuration is enabled for the first time, these defaults are used:
- **enabled**: `false`
- **maxRounds**: `10`
- **timeoutMinutes**: `60`
- **canCommunicateWithAgents**: `false`
- **allowedAgentIds**: `[]` (empty array = all agents allowed)
- **autoResumeOnResponse**: `true`

## Technical Notes

### Data Flow
1. User opens EditAgentModal → `resetLocal()` initializes multiRoundConfig with defaults
2. User modifies settings → Reactive Vue bindings update `local.multiRoundConfig`
3. User clicks Save → `save()` sends PATCH request with full agent data including multiRoundConfig
4. Server receives update → Merges multiRoundConfig into existing agent data
5. Storage layer persists the updated agent

### State Management
- Uses Vue 3 Composition API with reactive state
- Properly handles missing or incomplete multiRoundConfig (fills in defaults)
- Avoids variable shadowing in v-for loops
- Fetches fresh agent list when modal opens

### Validation
- Number inputs have min/max constraints
- Arrays are properly initialized before modification
- Null/undefined checks for safety

## Files Modified

1. `app/components/agents/EditAgentModal.vue` - Unified modal component for both creating and editing agents with multi-round configuration
2. `app/pages/agents/index.vue` - Refactored to use the unified modal component, eliminating ~150 lines of duplicate code
3. `server/api/agents/index.ts` - Added multiRoundConfig to POST endpoint
4. `MULTIROUND_UI_IMPLEMENTATION.md` - This documentation file

## Architecture Improvements

### Code Deduplication
The original implementation had duplicate multi-round configuration UI in two places:
- Inline modal in `pages/agents/index.vue` for creating agents
- `EditAgentModal.vue` component for editing agents

This caused maintenance issues where any change or bug fix had to be applied in both places.

### Unified Solution
The refactored implementation uses a single `EditAgentModal` component that:
- Detects the operation mode automatically (`isCreating` computed property)
- Adapts its UI and behavior based on the mode
- Eliminates code duplication
- Ensures consistency between create and edit flows

**Benefits:**
- ✅ Single source of truth for agent forms
- ✅ Easier maintenance (fix once, works everywhere)
- ✅ Consistent UX between create and edit
- ✅ ~150 lines of code eliminated
- ✅ Reduced bundle size

## Testing Recommendations

1. **Create New Agent**: Verify multiRoundConfig is saved when creating a new agent
2. **Edit Existing Agent**: Verify multiRoundConfig can be updated on existing agents
3. **Default Values**: Verify defaults are properly applied for agents without multiRoundConfig
4. **Agent Selection**: Verify that:
   - Current agent is excluded from allowed agents list
   - Multiple agents can be selected/deselected
   - Empty selection displays "all agents allowed" message
5. **Progressive Disclosure**: Verify fields show/hide based on toggle states
6. **Data Persistence**: Verify changes are saved and persist after page reload

## Future Enhancements

Potential improvements for future iterations:
- Visual preview of agent communication network
- Import/export multi-round configurations
- Configuration templates for common patterns
- Real-time validation of agent availability
- Advanced timeout strategies (per-round timeouts)
- Agent communication history/logs viewer

