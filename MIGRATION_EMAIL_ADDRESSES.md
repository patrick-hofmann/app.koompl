# Migration: Agent IDs to Email Addresses

## Overview
The multi-round agent system has been updated to use **email addresses** instead of agent IDs for inter-agent communication. This change improves reliability, clarity, and consistency with the email-based routing system.

## What Changed

### Type Definitions
**Before:**
```typescript
interface MultiRoundConfig {
  allowedAgentIds?: string[]  // e.g., ['agent-a', 'agent-b']
}
```

**After:**
```typescript
interface MultiRoundConfig {
  allowedAgentEmails?: string[]  // e.g., ['agent-a@koompl.local', 'agent-b@koompl.local']
}
```

### Decision Engine
**Before:**
```json
{
  "decision": "WAIT_FOR_AGENT",
  "target_agent": {
    "agent_id": "agent-b"
  }
}
```

**After:**
```json
{
  "decision": "WAIT_FOR_AGENT",
  "target_agent": {
    "agent_email": "agent-b@koompl.local"
  }
}
```

### Message Router
**Before:**
```typescript
sendAgentToAgentEmail({
  fromAgentId: 'agent-a',
  toAgentId: 'agent-b',
  ...
})
```

**After:**
```typescript
sendAgentToAgentEmail({
  fromAgentEmail: 'agent-a@koompl.local',
  toAgentEmail: 'agent-b@koompl.local',
  ...
})
```

## Benefits

### 1. **More Reliable**
- Email addresses are unique and stable identifiers
- No ambiguity with ID-to-email mapping
- Eliminates "agent not found" errors from ID mismatches

### 2. **More Natural**
- Email addresses like `bobby@koompl.local` are clearer than `agent-bobby`
- AI can understand and use email addresses more naturally
- Matches how humans think about agents

### 3. **Consistent with System**
- Incoming emails are already routed by email address
- Email is the primary identifier throughout the system
- Unifies all agent references under one identifier type

### 4. **Better UX**
- Users select agents by email in the UI (already visible)
- Email addresses are displayed prominently
- No need to remember or look up agent IDs

## Backwards Compatibility

The system maintains backwards compatibility with legacy agent IDs:

### In AgentFlowEngine
```typescript
// Supports both new email format and legacy ID format
let toAgentEmail = decision.targetAgent.agentEmail
if (!toAgentEmail && decision.targetAgent.agentId) {
  // Legacy support: look up email by ID
  const toAgent = agents.find(a => a?.id === decision.targetAgent?.agentId)
  toAgentEmail = toAgent.email
}
```

### In FlowDecision Type
```typescript
targetAgent?: {
  agentId?: string      // Legacy: agent ID
  agentEmail?: string   // Preferred: agent email address
  messageSubject: string
  messageBody: string
  question: string
}
```

## Migration for Existing Data

### If You Have Existing Agents with `allowedAgentIds`

The system will continue to work, but you should migrate to `allowedAgentEmails`:

**Option 1: Update via UI**
1. Edit each agent
2. Open the Multi-Round Configuration
3. Re-select the allowed agents (now by email)
4. Save

**Option 2: Manual Data Migration**
If you have direct access to the agents.json file:

```javascript
// Example migration script
const agents = JSON.parse(fs.readFileSync('agents.json'))

for (const agent of agents) {
  if (agent.multiRoundConfig?.allowedAgentIds) {
    // Convert IDs to emails
    agent.multiRoundConfig.allowedAgentEmails = 
      agent.multiRoundConfig.allowedAgentIds.map(id => {
        const targetAgent = agents.find(a => a.id === id)
        return targetAgent?.email || null
      }).filter(Boolean)
    
    // Optionally remove old field
    delete agent.multiRoundConfig.allowedAgentIds
  }
}

fs.writeFileSync('agents.json', JSON.stringify(agents, null, 2))
```

## Technical Details

### New Helper Methods

#### `getAgentByEmail(email: string)`
```typescript
// Looks up agent by email address (case-insensitive)
const agent = await messageRouter.getAgentByEmail('agent-a@koompl.local')
```

#### `getAvailableAgents(agent)`
```typescript
// Now returns formatted list with emails:
// - agent-b@koompl.local (Bobby - Product Specialist)
// - agent-c@koompl.local (Charlie - Tech Support)
```

### Updated Validation

The permission check now compares emails:
```typescript
const allowedEmails = fromAgent.multiRoundConfig.allowedAgentEmails || []
if (allowedEmails.length > 0 && !allowedEmails.includes(toAgentEmail.toLowerCase())) {
  throw createError({ statusCode: 403, statusMessage: 'Not allowed' })
}
```

## Testing

### Test Agent Communication
1. Create two agents with multi-round enabled
2. Configure Agent A to allow communication with Agent B (by email)
3. Send a test email to Agent A
4. Verify Agent A can successfully contact Agent B
5. Check logs for email-based routing: `[MessageRouter] Sending agent-to-agent email from agent-a@koompl.local to agent-b@koompl.local`

### Expected Log Output
```
[MessageRouter] Sending agent-to-agent email from agent-a@koompl.local to agent-b@koompl.local
[AgentFlowEngine] Flow abc123 now waiting for response from agent agent-b@koompl.local with requestId: req-xyz789
```

## Summary

This change makes the multi-round agent system:
- ✅ More reliable (no ID mismatch errors)
- ✅ More intuitive (email addresses are clearer)
- ✅ More consistent (unified with email routing)
- ✅ More maintainable (single identifier type)
- ✅ Backwards compatible (legacy IDs still supported)

All existing functionality is preserved while improving the developer and user experience.

