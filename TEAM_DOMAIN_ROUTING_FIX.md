# Team Domain Routing Fix

## Summary

Fixed two critical issues related to team domains:

1. **Predefined Koompls** now display the correct team domain email on the `/agents` page
2. **Inbound email routing** now determines the team from the email domain (not just agent lookup)

## Changes

### 1. Agents Page - Display Correct Emails (`app/pages/agents/index.vue`)

**Problem:**
Predefined Koompls were displaying placeholder emails like `chris-coordinator@koompl.local` instead of the actual team domain emails like `chris-coordinator@agents.delta-mind.at`.

**Root Cause:**
The UI was displaying emails from the predefined Koompl definitions (static data from the composable) instead of the actual created agent records.

**Fix:**
```typescript
// Before: Used predefined definition email
const enabledPredefined = computed(() => {
  const agentsList = agents.value || []
  return predefinedKoompls.map(pk => ({
    ...pk,
    enabled: isPredefinedEnabled(pk.id, agentsList)
  }))
})

// After: Uses actual agent email with team domain
const enabledPredefined = computed(() => {
  const agentsList = agents.value || []
  return predefinedKoompls.map(pk => {
    const actualAgent = agentsList.find(a => a.id === pk.id && a.isPredefined)
    return {
      ...pk,
      // Use actual agent email if it exists (has team domain), otherwise use default
      email: actualAgent?.email || pk.email,
      enabled: !!actualAgent
    }
  })
})
```

**Result:**
- ✅ Enabled predefined Koompls now show: `chris-coordinator@agents.delta-mind.at`
- ✅ Disabled predefined Koompls show placeholder: `chris-coordinator@koompl.local`
- ✅ Correctly reflects the actual agent data

---

### 2. Inbound Route - Team Determination (`server/api/mailgun/inbound.post.ts`)

**Problem:**
The inbound route was finding agents by email address only, without considering which team they belong to. This could lead to:
- Security issues if multiple teams had similar agent names
- Inability to properly scope agents to teams
- Not leveraging the unique domain-per-team architecture

**Root Cause:**
The code was searching all agents globally:
```typescript
const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
const agent = agents.find((a) => a.email.toLowerCase() === toEmail)
```

**Fix:**
Now the inbound route:
1. **Extracts the domain** from the recipient email
2. **Looks up the team** by matching the domain
3. **Filters agents to that team** before searching
4. **Finds the agent** within the team's agents

```typescript
// Extract domain from recipient email
const recipientDomain = toEmail?.split('@')[1]?.toLowerCase()
if (!recipientDomain) {
  console.log('[Inbound] No domain found in recipient email:', toEmail)
  return { ok: true, error: 'Invalid recipient email' }
}

// Look up team by domain (domains are unique per team)
const { getIdentity } = await import('../../utils/identityStorage')
const identity = await getIdentity()
const team = identity.teams.find(t => t.domain?.toLowerCase() === recipientDomain)

if (!team) {
  console.log('[Inbound] No team found for domain:', recipientDomain)
  return { ok: true, error: 'Team not found for domain' }
}

console.log('[Inbound] Found team for domain:', { 
  teamId: team.id, 
  teamName: team.name, 
  domain: recipientDomain 
})

// Load agents and filter by team
const agents = (await agentsStorage.getItem<Agent[]>('agents.json')) || []
const teamAgents = agents.filter((a) => a.teamId === team.id)

// Find agent by email within the team
const agent = toEmail
  ? teamAgents.find((a) => String(a?.email || '').toLowerCase() === toEmail)
  : undefined

if (!agent) {
  console.log('[Inbound] No agent found for email in team:', { 
    email: toEmail, 
    teamId: team.id 
  })
  return { ok: true, error: 'Agent not found' }
}

console.log('[Inbound] Found agent:', { 
  agentId: agent.id, 
  agentEmail: agent.email, 
  teamId: agent.teamId 
})
```

**Result:**
- ✅ Team is determined from the email domain
- ✅ Agents are scoped to the correct team
- ✅ Better security (team isolation)
- ✅ Leverages unique domain-per-team architecture
- ✅ Better logging for debugging

---

## Benefits

### 1. **Security & Isolation**
- Teams are completely isolated by domain
- No cross-team agent access
- Domain uniqueness is enforced and utilized

### 2. **Correctness**
- Email addresses always show the correct team domain
- Inbound routing is deterministic based on domain
- Proper team context for all operations

### 3. **Architecture Alignment**
- Fully leverages the "one domain per team" model
- Domain becomes the primary identifier for team lookup
- Clean separation of concerns

### 4. **Debugging**
- Enhanced logging shows team lookup process
- Clear error messages for each failure point
- Easy to trace email routing

---

## Example Flow

### Before:
```
Email arrives: chris-coordinator@agents.delta-mind.at
  ↓
Search ALL agents for this email
  ↓
Found agent? Process email
```

**Problems:**
- No team context
- Could match wrong agent if duplicates exist
- Not using domain information

### After:
```
Email arrives: chris-coordinator@agents.delta-mind.at
  ↓
Extract domain: agents.delta-mind.at
  ↓
Look up team by domain
  ↓
Team found: "Acme Inc" (id: 1)
  ↓
Filter agents to this team only
  ↓
Search team agents for: chris-coordinator@agents.delta-mind.at
  ↓
Found agent in team? Process email
```

**Benefits:**
- ✅ Team context from domain
- ✅ Proper isolation
- ✅ Uses domain uniqueness
- ✅ Better error handling

---

## Testing Checklist

- [x] Predefined Koompls show correct domain in UI
- [x] Inbound emails route to correct team
- [x] Team lookup by domain works
- [x] Agent lookup scoped to team
- [x] Logging shows full trace
- [x] No linter errors

---

## Related Files

### Modified:
1. `app/pages/agents/index.vue` - Display actual agent emails
2. `server/api/mailgun/inbound.post.ts` - Team routing by domain

### Related:
- `server/utils/identityStorage.ts` - Team domain storage
- `server/api/agents/index.ts` - Agent creation with team domain
- `server/utils/shared.ts` - Email generation with domain

---

## Migration Notes

**No migration required!**

This is a pure logic fix that:
- Uses existing data structures
- No database changes needed
- Backward compatible
- Works with existing agents and teams

---

## Future Enhancements

1. **Domain Validation**
   - Verify domain ownership before allowing team creation
   - Check DNS records for domain

2. **Multi-Domain Support** (if needed)
   - Currently one domain per team
   - Could extend to multiple domains per team

3. **Domain Aliases**
   - Allow multiple domains to point to same team
   - Useful for organizations with multiple domains

4. **Domain-based Authentication**
   - Use domain to pre-select team during login
   - Smoother UX for single-domain organizations

