# Team Domains Implementation

## Overview

This document describes the implementation of team-level domain management, where each team has a unique domain and Koompls use emails in the format `agent-id@team-domain.tld`.

## Key Changes

### 1. Domain as Team-Level Setting

**Before:**
- Domains were managed separately through Mailgun API
- No connection between teams and domains
- Agents used generic emails like `agent-id@agents.local`

**After:**
- Each team has ONE unique domain stored on the Team object
- No two teams can have the same domain
- Agents automatically use their team's domain for email addresses
- Format: `agent-id@team-domain.tld`

## Implementation Details

### 1. Data Model Changes

#### Team Interface Updates
**Files Modified:**
- `app/types/index.d.ts`
- `server/utils/identityStorage.ts`

```typescript
export interface Team {
  id: string
  name: string
  description?: string
  domain?: string // NEW: Team's unique domain (e.g., "company.com")
  createdAt?: string
  updatedAt?: string
}
```

### 2. Domain Uniqueness Validation

**Location:** `server/utils/identityStorage.ts`

The `upsertTeam` function now enforces domain uniqueness:

```typescript
// Check for domain uniqueness if domain is provided
if (domain) {
  const domainConflict = teams.find(
    (team) => team.domain?.toLowerCase() === domain && team.id !== payload.id
  )
  if (domainConflict) {
    throw createError({ 
      statusCode: 409, 
      statusMessage: 'Domain already in use by another team' 
    })
  }
}
```

### 3. Agent Email Generation

**Location:** `server/utils/shared.ts`

New function to generate agent emails with team domain:

```typescript
export function generateAgentEmail(agentId: string, teamDomain?: string): string {
  if (teamDomain) {
    return `${agentId}@${teamDomain}`
  }
  // Fallback to agents.local if no team domain
  return `${agentId}@agents.local`
}
```

Updated `createAgentObject` to accept `teamDomain` parameter and use it for email generation.

### 4. Agent Creation with Team Domain

**Location:** `server/api/agents/index.ts`

When creating an agent:
1. Get the teamId from session or request body
2. Look up the team to find its domain
3. Use the team domain when creating the agent email

```typescript
// Get team domain if team exists
let teamDomain: string | undefined
if (teamId) {
  const { getIdentity } = await import('../../utils/identityStorage')
  const identity = await getIdentity()
  const team = identity.teams.find(t => t.id === teamId)
  teamDomain = team?.domain
}

// Use team domain when creating agent
agent = createAgentObject(
  body,
  existingAgents.map((a) => a.id),
  teamDomain
)
```

### 5. Predefined Koompls with Team Domain

**Location:** `app/composables/usePredefinedKoompls.ts`

Predefined Koompls now automatically use the team's domain:
- Email is set on the server-side during agent creation
- Uses the same domain logic as custom agents

**Examples:**
- Without team domain: `chris-coordinator@agents.local`
- With team domain (company.com): `chris-coordinator@company.com`

### 6. Super Admin Domain Management API

#### Set/Update Team Domain
**Endpoint:** `PATCH /api/admin/teams/:id/domain`

**Access:** Super admin only

**Body:**
```json
{
  "domain": "company.com"
}
```

**Validation:**
- Domain format: `example.com` (basic validation)
- Domain uniqueness across all teams
- Only super admins can modify

#### Get Team Domain
**Endpoint:** `GET /api/admin/teams/:id/domain`

**Access:** Super admin only

**Response:**
```json
{
  "teamId": "team-123",
  "teamName": "My Team",
  "domain": "company.com"
}
```

### 7. Admin UI Updates

**Location:** `app/pages/admin/index.vue`

**Teams Section Enhancements:**

1. **Domain Display:**
   - Shows domain badge next to team name
   - Green badge if domain is set
   - Gray "No domain" badge if not set
   - Displays: "Koompls will use @domain.com emails"

2. **Domain Management:**
   - Added domain field to team creation/edit form
   - Placeholder: "example.com"
   - Help text: "Koompls will use emails like agent-id@domain.com"
   - Domain validation on submit

3. **Visual Feedback:**
   - Teams with domains highlighted with green badges
   - Clear indication of domain usage

## User Workflow

### Setting a Team Domain (Super Admin)

1. Navigate to `/admin` page
2. Find the "Teams" section
3. Either:
   - **Create new team:** Fill in Name, Description, and Domain
   - **Edit existing team:** Click "Edit" and update Domain field
4. Enter domain in format: `company.com` (no http://, no @)
5. Click "Add team" or "Update team"

### Domain Validation

The system validates:
- **Format:** Must be valid domain format (e.g., `company.com`)
- **Uniqueness:** No other team can use the same domain
- **Case-insensitive:** `Company.com` and `company.com` are treated as the same

### Agent Email Behavior

#### When Team Has Domain Set:
- **New agents:** Automatically get `agent-id@team-domain.com`
- **Predefined Koompls:** Use `chris-coordinator@team-domain.com`
- **All emails:** Routed to agents via team domain

#### When Team Has No Domain:
- **New agents:** Fall back to `agent-id@agents.local`
- **Legacy behavior:** Works exactly as before
- **Backwards compatible:** Existing setups unaffected

## Examples

### Example 1: Company "Acme Inc" with domain "acme.com"

**Team Setup:**
```json
{
  "id": "team-acme",
  "name": "Acme Inc",
  "domain": "acme.com"
}
```

**Custom Agent:**
```json
{
  "id": "sales-bot",
  "name": "Sales Bot",
  "email": "sales-bot@acme.com", // Auto-generated
  "teamId": "team-acme"
}
```

**Predefined Koompls:**
- Chris Coordinator: `chris-coordinator@acme.com`
- Cassy Calendar: `cassy-calendar@acme.com`
- Tracy Task: `tracy-task@acme.com`

### Example 2: Multiple Teams with Different Domains

```json
[
  {
    "id": "team-1",
    "name": "Acme Inc",
    "domain": "acme.com"
  },
  {
    "id": "team-2",
    "name": "Beta Corp",
    "domain": "beta.com"
  }
]
```

**Result:**
- Team 1 agents: `*@acme.com`
- Team 2 agents: `*@beta.com`
- Domains are isolated and unique

### Example 3: Team Without Domain (Legacy Mode)

```json
{
  "id": "team-legacy",
  "name": "Legacy Team",
  "domain": null
}
```

**Result:**
- Agents use: `agent-id@agents.local`
- Works exactly as before
- Backwards compatible

## Mailgun Configuration

### Inbound Email Routing

**Current System:**
- Mailgun receives emails at `*@your-domain.com`
- Routes to webhook: `/api/mailgun/inbound`
- System matches email address to agent
- Agent processes the email

**With Team Domains:**
- Same routing mechanism
- Agents now have domain-specific emails
- Mailgun must be configured for all team domains
- Each domain routes to the same webhook

**Setup Required:**
1. Add each team domain to Mailgun
2. Configure inbound routing for each domain
3. All domains point to same webhook endpoint
4. System automatically matches agent emails

### Domain Verification

**Process:**
1. Super admin adds domain to team
2. Domain must be verified in Mailgun
3. DNS records must be configured
4. Once verified, emails can be received

**Note:** The `/domains` page still shows all Mailgun domains for reference and testing.

## Security & Permissions

### Domain Management Access
- **Super Admins:** Can set/update any team's domain
- **Team Admins:** Cannot modify domain (super admin only)
- **Team Members:** Can only view their team's domain

### Domain Validation
- Format validation prevents invalid domains
- Uniqueness check prevents conflicts
- Case-insensitive comparison
- Domains are stored in lowercase

## Migration Path

### Existing Installations

**No Migration Required:**
- Existing agents keep their current emails
- Teams without domains work as before
- Backwards compatible with `@agents.local`

**Optional Migration:**
1. Super admin sets domain for each team
2. Optionally update existing agent emails manually
3. Or let new agents use team domain naturally

### Best Practices

1. **Set domains early:** Configure team domains before creating many agents
2. **Consistent naming:** Use company domains for professional appearance
3. **Verify in Mailgun:** Ensure domains are verified before use
4. **Document domains:** Keep track of which domain belongs to which team

## Benefits

### 1. Professional Email Addresses
- `sales-bot@acme.com` instead of `sales-bot@agents.local`
- Client-facing emails look professional
- Brand consistency

### 2. Multi-Tenancy Support
- Each team has isolated domain
- Clear separation between organizations
- Easier to manage multiple clients

### 3. Simplified Configuration
- Domain set once at team level
- All agents automatically use correct domain
- No manual email configuration per agent

### 4. Better Organization
- Domain indicates which team owns the agent
- Easy to identify agents by email
- Clear ownership and responsibility

## Troubleshooting

### Agent Email Not Using Team Domain

**Possible Causes:**
1. Agent created before domain was set
2. Team doesn't have domain configured
3. Email was manually overridden

**Solution:**
- Edit agent and update email manually
- Or delete and recreate agent to get new email

### Domain Already In Use Error

**Cause:** Another team is using the same domain

**Solution:**
1. Check which team has the domain
2. Either use a different domain
3. Or remove domain from other team first

### Emails Not Being Received

**Possible Causes:**
1. Domain not verified in Mailgun
2. DNS records not configured
3. Webhook URL not set correctly

**Solution:**
1. Verify domain in Mailgun dashboard
2. Configure DNS records as per Mailgun instructions
3. Ensure webhook points to `/api/mailgun/inbound`

## Future Enhancements

Potential improvements for future iterations:

1. **Subdomain Support:** Allow teams to use subdomains (e.g., `agents.company.com`)
2. **Multiple Domains:** Allow teams to have multiple domains
3. **Domain Aliases:** Support domain aliases for same team
4. **Auto-Update Emails:** Automatically update existing agent emails when domain changes
5. **Domain Validation:** Real-time DNS validation during setup
6. **Domain Templates:** Suggest domains based on team name
7. **Bulk Operations:** Update all agent emails in a team at once

## Conclusion

Team-level domains provide a professional, organized way to manage agent email addresses. The implementation maintains backwards compatibility while offering powerful new capabilities for multi-tenant deployments.

Key takeaways:
- One domain per team (unique across all teams)
- Agents automatically use team domain
- Super admin manages domains
- Backwards compatible with existing setups
- Professional, branded email addresses

