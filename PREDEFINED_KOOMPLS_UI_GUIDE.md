# Predefined Koompls - UI Guide

## Page Layout

The Koompls page (`/agents`) is now organized into two distinct sections:

### 1. Predefined Koompls Section (Top)

```
┌─────────────────────────────────────────────────────────────────┐
│  Predefined Koompls                                              │
│  Enable specialized Koompls for your team                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                   │
│  │ Chris     │  │ Cassy     │  │ Tracy     │                   │
│  │ Coordinator│  │ Calendar  │  │ Task      │                   │
│  │           │  │           │  │           │                   │
│  │ [✓] Enable│  │ [ ] Enable│  │ [✓] Enable│                   │
│  │ [Info]    │  │ [Info]    │  │ [Info]    │                   │
│  └───────────┘  └───────────┘  └───────────┘                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Custom Koompls Section (Bottom)

```
┌─────────────────────────────────────────────────────────────────┐
│  Custom Koompls                                                   │
│  Your custom-created Koompls                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Search: Filter emails...]              [+ Add Custom Koompl]  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Table with custom Koompls                                │    │
│  │ ID | Name | Email | Role | Prompt | Actions             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Predefined Koompl Tile Design

Each predefined Koompl appears as an attractive card with:

```
┌────────────────────────────────────────────────┐
│  ┌────┐                                    [✓] │ ← Checkbox
│  │ 👥 │  Chris Coordinator                     │ ← Icon & Name
│  └────┘  chris@koompls.local                   │ ← Email
│                                                 │
│  [Coordinator]                                  │ ← Role Badge
│                                                 │
│  Knows all active Koompls and delegates        │ ← Description
│  mails to the right specialist                 │
│                                                 │
│  ✨ Predefined                [View Prompt]    │ ← Footer
└────────────────────────────────────────────────┘
```

### Visual Features:
- **Background gradient** that pulses on hover
- **Color-coded** by function:
  - 🔵 Blue for Chris (Coordination)
  - 🟢 Green for Cassy (Calendar)
  - 🟣 Purple for Tracy (Tasks)
- **Elevation effect** when enabled (ring + shadow)
- **Smooth animations** on all interactions

## Koompl Details (States)

### Disabled State
- Muted colors
- No ring or shadow
- Checkbox unchecked
- Hover reveals subtle highlight

### Enabled State
- Vibrant colors
- Primary-colored ring (2px)
- Elevated shadow
- Slightly scaled up (1.02x)
- Checkbox checked

### Loading State
- Semi-transparent overlay
- Spinning loader icon
- All interactions disabled

## Info Modal

When clicking "View Prompt" button:

```
┌─────────────────────────────────────────────────┐
│  Chris Coordinator                          [×] │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌────┐                                         │
│  │ 👥 │  Chris Coordinator                      │
│  └────┘  chris@koompls.local                    │
│          [Coordinator]                          │
│                                                  │
│  Description                                    │
│  ─────────────────────────────────────────────  │
│  Knows all active Koompls and delegates         │
│  mails to the right specialist                  │
│                                                  │
│  ─────────────────────────────────────────────  │
│                                                  │
│  💬 System Prompt                               │
│  ┌──────────────────────────────────────────┐  │
│  │ You are Chris Coordinator, the central   │  │
│  │ coordination agent for the Koompl team.  │  │
│  │                                           │  │
│  │ Your primary responsibilities:            │  │
│  │ - Know all active Koompls...             │  │
│  │ ...                                       │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  ⚙️ Configuration                               │
│  Max Rounds: 10                                 │
│  Timeout: 60 minutes                            │
│  Inter-Agent Communication: ✅ Enabled          │
│  Auto-Resume: ✅ Enabled                        │
│                                                  │
│  🔌 MCP Servers                                 │
│  (None configured)                              │
│                                                  │
│                                   [Close]       │
└─────────────────────────────────────────────────┘
```

## Interaction Flow

### Enabling a Predefined Koompl:
1. User clicks checkbox on a disabled tile
2. Tile shows loading state
3. API creates the agent with predefined settings
4. Tile transitions to enabled state
5. Agent now appears in the system (but not in custom list)

### Disabling a Predefined Koompl:
1. User unchecks checkbox on an enabled tile
2. Tile shows loading state
3. API deletes the agent
4. Tile transitions to disabled state
5. Agent removed from system

### Viewing Prompt:
1. User clicks "View Prompt" button
2. Modal slides in from center
3. Shows complete agent configuration
4. User can read but not edit
5. Click outside or "Close" to dismiss

## Edit Restrictions

When editing a predefined Koompl (via actions menu):

```
┌─────────────────────────────────────────────────┐
│  Edit Koompl                                [×] │
├─────────────────────────────────────────────────┤
│                                                  │
│  ℹ️ Predefined Koompl                           │
│  Core properties (name, email, role, prompt)    │
│  cannot be modified.                            │
│                                                  │
│  Name: Chris Coordinator        [disabled]     │
│  Email: chris@koompls.local     [disabled]     │
│  Role: Coordinator              [disabled]     │
│  System Prompt:                 [disabled]     │
│  ┌──────────────────────────────────────────┐  │
│  │ You are Chris Coordinator...             │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  MCP Server                     [enabled] ✅    │
│  ☐ builtin-calendar                             │
│  ☐ builtin-kanban                               │
│                                                  │
│  Flow Configuration             [enabled] ✅    │
│  ...                                            │
│                                                  │
│                        [Cancel]  [Save]         │
└─────────────────────────────────────────────────┘
```

Only MCP servers and flow configuration can be modified for predefined Koompls.

## Responsive Behavior

### Desktop (1024px+):
- 3 columns of predefined Koompl tiles
- Full table width for custom Koompls
- Side-by-side layout

### Tablet (768px - 1023px):
- 2 columns of predefined Koompl tiles
- Full table width for custom Koompls

### Mobile (< 768px):
- 1 column of predefined Koompl tiles
- Horizontal scroll for custom Koompls table
- Stacked layout

## Color Palette

### Chris Coordinator (Blue)
- Background: `bg-blue-500/10`
- Text: `text-blue-600 dark:text-blue-400`
- Badge: `color="blue"`

### Cassy Calendar (Green)
- Background: `bg-green-500/10`
- Text: `text-green-600 dark:text-green-400`
- Badge: `color="green"`

### Tracy Task (Purple)
- Background: `bg-purple-500/10`
- Text: `text-purple-600 dark:text-purple-400`
- Badge: `color="purple"`

## Accessibility

- All interactive elements have proper ARIA labels
- Keyboard navigation fully supported
- Focus states clearly visible
- Color contrast meets WCAG AA standards
- Screen reader friendly
- Disabled states clearly indicated

## Animation Timings

- Hover scale: `300ms ease`
- Loading fade: `200ms ease`
- Modal slide: `300ms ease-in-out`
- Checkbox toggle: `150ms ease`
- Card elevation: `300ms ease`

## Icons Used

- **Chris Coordinator**: `i-lucide-users-round` (people/coordination)
- **Cassy Calendar**: `i-lucide-calendar` (calendar)
- **Tracy Task**: `i-lucide-kanban-square` (kanban board)
- **Info**: `i-lucide-info` (information)
- **Sparkles**: `i-lucide-sparkles` (predefined indicator)
- **Settings**: `i-lucide-settings` (configuration)
- **Message**: `i-lucide-message-square-code` (system prompt)
- **Plug**: `i-lucide-plug` (MCP servers)

## User Feedback

- ✅ Visual confirmation on enable/disable
- 🔄 Loading indicators during API calls
- ℹ️ Info alerts for restrictions
- ❌ Error messages if operations fail
- ✨ Smooth transitions for all state changes

