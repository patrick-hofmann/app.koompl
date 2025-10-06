# Predefined Koompl Testing Feature

## Summary

Added test functionality (prompt test and round-trip test) to predefined Koompls, allowing users to test Chris Coordinator, Cassy Calendar, and Tracy Task just like custom agents.

## Changes

### 1. Updated `PredefinedKoomplTile.vue`

Added test action buttons to the tile footer that appear **only when the Koompl is enabled**.

**New Emits:**
```typescript
const emit = defineEmits<{
  (e: 'toggle', value: boolean): void
  (e: 'info' | 'testPrompt' | 'testRoundTrip'): void
}>()
```

**UI Changes:**
```vue
<!-- Footer now includes test buttons when enabled -->
<div class="flex items-center gap-1">
  <!-- Test buttons (only when enabled) -->
  <template v-if="enabled">
    <UButton
      icon="i-lucide-flask-conical"
      size="xs"
      variant="ghost"
      title="Test prompt"
      @click.stop="emit('testPrompt')"
    />
    <UButton
      icon="i-lucide-rotate-ccw"
      size="xs"
      variant="ghost"
      title="Test round-trip"
      @click.stop="emit('testRoundTrip')"
    />
  </template>

  <!-- Info button (always visible) -->
  <UButton
    icon="i-lucide-info"
    title="View prompt"
    @click.stop="emit('info')"
  />
</div>
```

### 2. Updated `app/pages/agents/index.vue`

Added event handlers to wire up the test functionality.

**New Functions:**
```typescript
// Test predefined Koompl prompt
function testPredefinedPrompt(koompl: PredefinedKoompl) {
  if (!koompl.enabled) return
  testAgentId.value = koompl.id
  testOpen.value = true
}

// Test predefined Koompl round-trip
function testPredefinedRoundTrip(koompl: PredefinedKoompl) {
  if (!koompl.enabled) return
  roundTripAgentId.value = koompl.id
  roundTripOpen.value = true
}
```

**Updated Template:**
```vue
<AgentsPredefinedKoomplTile
  v-for="pk in enabledPredefined"
  :key="pk.id"
  :koompl="pk"
  :team-domain="teamDomain"
  :enabled="pk.enabled"
  :loading="togglingPredefined.has(pk.id)"
  @toggle="togglePredefinedKoompl(pk, $event)"
  @info="showInfo(pk)"
  @test-prompt="testPredefinedPrompt(pk)"
  @test-round-trip="testPredefinedRoundTrip(pk)"
/>
```

## Features

### Test Prompt (🧪 Flask Icon)

Tests the agent's AI response without sending actual emails.

**What it does:**
1. Opens the `TestAgentModal`
2. Allows user to input a test subject and body
3. Calls the agent's prompt generation
4. Shows the AI-generated response
5. No emails are sent

**Use case:** Quickly verify that the agent's system prompt is working correctly.

### Test Round-Trip (🔄 Rotate Icon)

Simulates a complete email flow (inbound → process → outbound).

**What it does:**
1. Opens the `RoundTripAgentModal`
2. Simulates an inbound email to the agent
3. Agent processes the email using its full multi-round flow
4. Agent generates and "sends" an outbound response
5. Shows the complete flow result

**Use case:** Test the full email processing pipeline including multi-round logic.

## UI Visual

### Disabled Predefined Koompl
```
┌─────────────────────────────────────┐
│  🌐  Chris Coordinator               │
│  chris-coordinator@company.com      │
│  □ Disabled                         │
│                                     │
│  Coordinates between agents         │
│                                     │
│  ✨ Predefined        [ℹ️ Info]     │
└─────────────────────────────────────┘
```

### Enabled Predefined Koompl
```
┌─────────────────────────────────────┐
│  🌐  Chris Coordinator        ✓     │
│  chris-coordinator@company.com      │
│  ☑ Enabled                          │
│                                     │
│  Coordinates between agents         │
│                                     │
│  ✨ Predefined  [🧪] [🔄] [ℹ️]     │
└─────────────────────────────────────┘
                    ↑    ↑    ↑
              Test  │    │    │
              Prompt│    │    View
                    │    │    Prompt
                    │    Test
                    │    Round-trip
```

## Button States

| State | Test Buttons Visible | Clickable |
|-------|---------------------|-----------|
| Disabled | ❌ No | N/A |
| Enabled | ✅ Yes | ✅ Yes |
| Loading | ✅ Yes | ✅ Yes |

**Note:** Test buttons only appear after the Koompl is enabled (checkbox is checked).

## User Workflow

### Testing a Predefined Koompl

1. **Enable the Koompl**
   - Navigate to `/agents`
   - Find the predefined Koompl (e.g., "Chris Coordinator")
   - Check the checkbox to enable it
   - Wait for confirmation

2. **Test the Prompt**
   - Click the flask icon (🧪) on the enabled Koompl tile
   - Enter test subject and body
   - Click "Run Test"
   - View the AI-generated response

3. **Test Round-Trip**
   - Click the rotate icon (🔄) on the enabled Koompl tile
   - Configure test email details
   - Click "Run Round-trip"
   - View the complete flow result (inbound + outbound)

## Technical Details

### Reused Components

The implementation reuses existing test modals:
- `TestAgentModal.vue` - For prompt testing
- `RoundTripAgentModal.vue` - For round-trip testing

### API Endpoints Used

Both tests use the same API endpoints as custom agents:
- `POST /api/agents/[id]/test` - Prompt test
- `POST /api/agents/[id]/roundtrip` - Round-trip test

No new API endpoints were needed!

### Agent ID

Predefined Koompls use their predefined ID (e.g., `chris-coordinator`), which is used to:
1. Look up the agent in storage
2. Route test requests
3. Identify the agent in the UI

## Examples

### Testing Chris Coordinator

**Prompt Test:**
```
Subject: Customer Question
Body: Hi, I need help with pricing information.

Result: 
"I'll help you with that. Let me contact our Product Specialist 
to get the latest pricing information for you..."
```

**Round-Trip Test:**
```
From: customer@example.com
To: chris-coordinator@company.com
Subject: Pricing inquiry

Flow Result:
✓ Inbound email received
✓ Agent analyzed request
✓ Agent delegated to product specialist
✓ Outbound response generated
```

### Testing Cassy Calendar

**Prompt Test:**
```
Subject: Schedule Meeting
Body: Can you schedule a team meeting for tomorrow at 2 PM?

Result:
"I'll check the calendar availability and schedule that meeting.
Let me access the calendar system..."
```

**Round-Trip Test:**
```
From: manager@example.com
To: cassy-calendar@company.com
Subject: Meeting request

Flow Result:
✓ Calendar MCP server accessed
✓ Availability checked
✓ Meeting scheduled
✓ Confirmation sent
```

### Testing Tracy Task

**Prompt Test:**
```
Subject: Create Task
Body: Create a task for reviewing the Q4 report.

Result:
"I'll create that task in the project board. Task created:
'Review Q4 Report' - Added to backlog..."
```

**Round-Trip Test:**
```
From: pm@example.com
To: tracy-task@company.com
Subject: New task

Flow Result:
✓ Kanban MCP server accessed
✓ Task created
✓ Board updated
✓ Confirmation sent
```

## Benefits

### 1. **Consistency**
Predefined and custom Koompls have the same testing capabilities.

### 2. **Easy Debugging**
Quick way to verify predefined Koompls are working correctly after enabling.

### 3. **User Confidence**
Users can test before relying on predefined Koompls in production.

### 4. **No Code Duplication**
Reuses existing test infrastructure and modals.

### 5. **Clean UI**
Test buttons only appear when relevant (Koompl is enabled).

## Edge Cases Handled

1. **Disabled Koompl**: Test buttons hidden
2. **Loading State**: Test buttons remain visible and clickable
3. **Click Propagation**: `@click.stop` prevents card toggle when clicking test buttons
4. **Predefined Check**: Functions verify Koompl is enabled before opening modal

## Future Enhancements

Possible improvements:
1. **Test History**: Show previous test results
2. **Batch Testing**: Test all enabled Koompls at once
3. **Scheduled Tests**: Automatic periodic testing
4. **Test Reports**: Detailed analytics on test results
5. **Compare Results**: Compare responses across different prompts

## Accessibility

- **Tooltips**: All test buttons have descriptive `title` attributes
- **Icon-only**: Uses standard Lucide icons for universal recognition
- **Keyboard**: All buttons are keyboard accessible
- **Screen readers**: Proper ARIA labels through Nuxt UI

## Conclusion

The predefined Koompl testing feature provides parity with custom agents, allowing users to thoroughly test Chris Coordinator, Cassy Calendar, and Tracy Task before using them in production. The implementation is clean, reuses existing infrastructure, and maintains a consistent user experience across all agent types.

Key achievements:
- ✅ Prompt testing for predefined Koompls
- ✅ Round-trip testing for predefined Koompls
- ✅ Clean UI with conditional visibility
- ✅ Reuses existing test modals and APIs
- ✅ No code duplication
- ✅ All linter checks pass

Users can now confidently enable and test predefined Koompls just like their custom agents!

