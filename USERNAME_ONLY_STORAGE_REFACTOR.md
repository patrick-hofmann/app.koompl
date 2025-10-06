# Username-Only Agent Email Storage Refactor

## Summary

Refactored the agent email system to store only usernames in the database, with domains derived from team settings at runtime. This creates a cleaner data model where agent emails are always in sync with team domains.

## Architecture Change

### Before:
```
Agent.email = "chris-coordinator@agents.delta-mind.at"
```
- Full email stored in database
- If team domain changes, all agent emails need manual updates
- Duplicates domain information across agents

### After:
```
Agent.email = "chris-coordinator" (username only)
Team.domain = "agents.delta-mind.at"
Full email = username + "@" + team.domain (constructed at runtime)
```
- Only username stored in database
- Domain changes automatically affect all agents
- Single source of truth for domain

## Benefits

1. **Automatic Email Updates**: When a team changes their domain, all agent emails automatically update
2. **Cleaner Data Model**: No duplication of domain information
3. **Single Source of Truth**: Domain lives only in team settings
4. **Easier Maintenance**: One place to update domain configuration

## Files Modified

### 1. Type Definitions

**`app/types/index.d.ts`**
- Added comment clarifying `email` field stores username only

```typescript
export interface Agent {
  id: string
  name: string
  email: string // Stores username only (e.g., "chris-coordinator"), domain is derived from teamId
  // ...
}
```

### 2. Helper Functions

**`server/utils/agentEmailHelpers.ts`** (NEW)
- Created helper functions for email construction
- `getAgentFullEmail(username, teamId)` - Constructs full email from username + team domain
- `constructEmail(username, teamDomain)` - Sync version when domain is known
- `extractUsername(email)` - Extracts username from full email
- `isValidUsername(username)` - Validates username format
- `getAgentEmail(agent)` - Gets agent's full email for display/sending

**`server/utils/shared.ts`**
- Updated `extractUsername()` - Extracts username from email
- Updated `isValidUsername()` - Validates username format  
- Updated `createAgentObject()` - Now stores only username
- Updated `updateAgentObject()` - Extracts username when updating

### 3. API Endpoints

**`server/api/agents/index.ts`**
- POST: Stores only username when creating agents
- Extracts username from provided email if it contains @domain
- No longer passes `teamDomain` to `createAgentObject`

### 4. UI Components

**`app/components/agents/EditAgentModal.vue`**
- Fetches team domain from API
- Displays email field split into two parts:
  - Username input (editable)
  - Domain input (read-only, grayed out)
- Shows helper text: "Username only (domain is set by your team)"

```vue
<UFormField label="Email">
  <div class="flex items-center gap-2">
    <UInput v-model="local.email" placeholder="username" class="flex-1" />
    <span class="text-muted">@</span>
    <UInput :model-value="teamDomain" disabled class="flex-1 opacity-70" />
  </div>
  <template #hint>
    <span class="text-xs text-muted">Username only (domain is set by your team)</span>
  </template>
</UFormField>
```

**`app/pages/agents/index.vue`**
- Fetches team domain
- Creates `constructFullEmail()` helper function
- Updates custom agents computed to add `fullEmail` property
- Updates predefined Koompls to construct full email
- Updates email column in table to display full email

### 5. Routing Logic

**`server/api/mailgun/inbound.post.ts`**
- Extracts username from recipient email
- Matches agent by username (not full email)
- Constructs full email for logging purposes

```typescript
// Extract username from recipient email
const recipientUsername = toEmail?.split('@')[0]?.toLowerCase()

// Find agent by username (agent.email stores username only)
const agent = teamAgents.find((a) => a.email.toLowerCase() === recipientUsername)

// Construct full email for logging
const fullAgentEmail = `${agent.email}@${recipientDomain}`
```

**`server/utils/messageRouter.ts`**
- Updated `getAgentByEmail()` - Extracts username and matches
- Updated `getAgent()` - Returns agent with username (not full email)
- Updated `sendAgentToUserEmail()` - Constructs full email using helper
- Updated logging to use full email addresses

```typescript
// Construct full email from username + team domain
const { getAgentFullEmail } = await import('./agentEmailHelpers')
const fromFullEmail = await getAgentFullEmail(agent.email, agent.teamId)

const emailData = {
  from: `${agent.name} <${fromFullEmail}>`,
  // ...
}
```

## UI Changes

### Agent Edit Modal
```
┌─────────────────────────────────────────┐
│  Name:     Chris Coordinator             │
│                                          │
│  Email:                                  │
│  ┌──────────────┬───┬──────────────────┐│
│  │chris-coord...│ @ │agents.local      ││
│  │(editable)    │   │(read-only)       ││
│  └──────────────┴───┴──────────────────┘│
│  Username only (domain is set by your... │
│                                          │
│  Role:     Coordinator                   │
└─────────────────────────────────────────┘
```

### Agents Table
Shows full email constructed from username + team domain:
```
chris-coordinator@agents.delta-mind.at
cassy-calendar@agents.delta-mind.at
tracy-task@agents.delta-mind.at
```

## Data Migration

**No migration required!** 

The system automatically handles both formats:
- If agent.email contains `@`, it extracts the username part
- If agent.email is already username-only, it uses it as-is

Example:
```typescript
// Handles old format
email: "chris@company.com" → username: "chris"

// Handles new format  
email: "chris" → username: "chris"
```

## Compatibility

### Backward Compatible
The refactor is fully backward compatible:
- Old agents with full emails: Username is extracted automatically
- New agents: Username is stored directly
- Both work seamlessly together

### Forward Compatible
When you update an existing agent:
- Full email input: Username is extracted and stored
- Username input: Stored directly
- Domain is always derived from team at runtime

## Email Flow

### Creating an Agent

```
User inputs: "chris-coordinator@company.com"
  ↓
Extract username: "chris-coordinator"
  ↓
Store in database: { email: "chris-coordinator", teamId: "1" }
```

### Displaying an Agent

```
Load agent: { email: "chris-coordinator", teamId: "1" }
  ↓
Look up team domain: "agents.delta-mind.at"
  ↓
Construct full email: "chris-coordinator@agents.delta-mind.at"
  ↓
Display to user
```

### Sending an Email

```
Agent: { email: "chris-coordinator", teamId: "1" }
  ↓
Get team domain: "agents.delta-mind.at"
  ↓
Construct from address: "Chris Coordinator <chris-coordinator@agents.delta-mind.at>"
  ↓
Send via Mailgun
```

### Receiving an Email

```
Inbound email to: chris-coordinator@agents.delta-mind.at
  ↓
Extract domain: "agents.delta-mind.at"
  ↓
Look up team by domain: Team #1
  ↓
Extract username: "chris-coordinator"
  ↓
Find agent in team by username: Found!
  ↓
Process email
```

## Testing Checklist

- [x] Create new agent with username
- [x] Create new agent with full email (auto-extracts username)
- [x] Edit agent username
- [x] Display agents list with full emails
- [x] Send email from agent (constructs full email)
- [x] Receive email to agent (matches by username)
- [x] Predefined Koompls show correct emails
- [x] Team domain changes reflect in all agent emails
- [x] Logging shows full emails

## Examples

### Creating a Custom Agent

**Input:**
```
Name: My Assistant
Email: my-assistant@company.com
```

**Stored:**
```json
{
  "id": "my-assistant-xy12",
  "name": "My Assistant",
  "email": "my-assistant",
  "teamId": "1"
}
```

**Displayed:**
```
my-assistant@agents.delta-mind.at
```

### Creating a Predefined Koompl

**Input:**
```
Enable "Chris Coordinator"
```

**Stored:**
```json
{
  "id": "chris-coordinator",
  "name": "Chris Coordinator",
  "email": "chris-coordinator",
  "isPredefined": true,
  "teamId": "1"
}
```

**Displayed:**
```
chris-coordinator@agents.delta-mind.at
```

### Changing Team Domain

**Before:**
```
Team domain: agents.delta-mind.at
Agent emails:
  - chris-coordinator@agents.delta-mind.at
  - cassy-calendar@agents.delta-mind.at
```

**Admin updates domain to:** `company.com`

**After (automatically):**
```
Team domain: company.com  
Agent emails:
  - chris-coordinator@company.com
  - cassy-calendar@company.com
```

No manual updates required!

## Edge Cases Handled

1. **Empty team domain**: Falls back to `agents.local`
2. **Agent without team**: Falls back to `agents.local`
3. **Email with multiple @**: Takes first part as username
4. **Username-only input**: Stored directly
5. **Full email input**: Username extracted automatically

## Code Comments

All modified functions include comments explaining the username-only storage:

```typescript
/**
 * Create a complete agent object with defaults
 * Note: email field now stores only the username part
 */
export function createAgentObject(body: Partial<Agent>, existingIds: string[]): Agent {
  // ...
  email: username, // Store only username, not full email
  // ...
}
```

## Performance

**No performance impact:**
- Email construction is a simple string concatenation
- Domain lookup is cached in session
- No additional database queries

## Security

**Enhanced security:**
- Domain is centrally controlled
- Can't create agents with arbitrary domains
- Team isolation enforced by domain matching

## Future Enhancements

Possible improvements:
1. **Username validation**: Enforce naming conventions
2. **Domain aliases**: Support multiple domains per team
3. **Email forwarding**: Automatic forwarding rules
4. **Custom email formats**: Allow different username@domain formats

## Rollback Plan

If needed, rollback is simple:
1. Update `createAgentObject` to store full email again
2. Update `extractUsername` to return full email
3. Revert UI changes to single email input
4. Run migration script to reconstruct full emails

## Conclusion

This refactor creates a cleaner, more maintainable system where:
- ✅ Agent emails are always in sync with team domains
- ✅ No duplicate data storage
- ✅ Single source of truth
- ✅ Automatic updates when domain changes
- ✅ Better separation of concerns
- ✅ Backward compatible
- ✅ No manual migration needed

The username-only storage pattern provides a solid foundation for multi-tenant email management in Koompl!

