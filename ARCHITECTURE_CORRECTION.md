# Architecture Correction: Flow Isolation Between Agents

## The Issue

The initial implementation plan had a fundamental architectural flaw regarding flow ownership and access between agents.

### ❌ Wrong Approach (Original)

```
User → Agent A
     ↓
Agent A creates Flow-123
     ↓
Agent A emails Agent B
     ↓
Agent B receives email and RESUMES Flow-123  ← WRONG!
     ↓
Agent B modifies Flow-123 directly           ← WRONG!
     ↓
Agent A sees updated Flow-123
```

**Problems:**
1. Agent B has access to Agent A's internal flow state
2. Tight coupling between agents
3. Security issue: agents can see each other's contexts
4. Violation of encapsulation
5. Complex state management across agent boundaries

## The Correction

### ✅ Correct Approach (Updated)

```
User → Agent A
     ↓
Agent A creates Flow-A-123 (Agent A's flow)
     ↓
Agent A emails Agent B with request ID: req-789
     ↓
Agent B receives email as NEW REQUEST
     ↓
Agent B processes independently (single-round or Flow-B-456)
     ↓
Agent B responds with req-789 in subject/header
     ↓
Agent A matches req-789 to Flow-A-123
     ↓
Agent A resumes Flow-A-123 with Agent B's response
```

**Benefits:**
1. Complete flow isolation between agents
2. Loose coupling via email communication
3. Each agent manages only its own flows
4. Clean separation of concerns
5. Scalable and secure architecture

---

## Key Principles

### 1. Flow Ownership
- **Each flow belongs to exactly ONE agent**
- Flows are stored per-agent: `agent-flows/{agentId}/flows/{flowId}.json`
- No cross-agent flow access

### 2. Communication via Email Only
- Agents communicate through standard email
- Request tracking via request IDs in subject/headers
- No direct API calls between agents' flow engines

### 3. Request ID Tracking
- Agent A generates unique request ID: `req-abc123`
- Includes in email subject: `[Req: req-abc123] Original Subject`
- Agent B includes request ID in reply for matching
- Agent A uses request ID to match response to its flow

### 4. Independent Processing
- Agent B treats Agent A's request like any other incoming email
- Agent B decides: single-round OR start its own flow
- Agent B's processing is completely independent of Agent A's flow
- Agent B responds when ready

---

## Example Flow Comparison

### Scenario: Customer asks Agent A about pricing

#### ❌ Wrong (Original Design)

```
Step 1: User → Agent A
  - Flow-123 created

Step 2: Agent A → Agent B
  - Email with flowId: flow-123
  
Step 3: Agent B processes
  - Load Flow-123 (Agent A's flow) ← WRONG
  - Modify Flow-123 ← WRONG
  - Resume Flow-123 ← WRONG
  
Step 4: Agent A sees updated Flow-123
  - Continues from where Agent B left off
```

**Storage:**
```
agent-flows/
  flows/
    flow-123.json  ← Both agents access this
```

#### ✅ Correct (Updated Design)

```
Step 1: User → Agent A
  - Flow-A-123 created (Agent A's flow)

Step 2: Agent A → Agent B
  - Email with requestId: req-789
  - Subject: "[Req: req-789] Pricing question"
  
Step 3: Agent B processes
  - Sees as NEW REQUEST
  - Processes independently (no flow or Flow-B-456)
  - Responds with req-789 in subject
  
Step 4: Agent A receives response
  - Matches req-789 to Flow-A-123
  - Resumes Flow-A-123
  - Uses Agent B's response as context
```

**Storage:**
```
agent-flows/
  agent-a/
    flows/
      flow-A-123.json  ← Only Agent A accesses
  agent-b/
    flows/
      flow-B-456.json  ← Only Agent B accesses (if needed)
```

---

## Implementation Changes

### 1. Storage Path Structure

**Before:**
```
agent-flows/flows/{flowId}.json
```

**After:**
```
agent-flows/{agentId}/flows/{flowId}.json
```

### 2. Agent Flow Engine

**Key Methods Updated:**

```typescript
// Load flow - requires agentId for security
private async loadFlow(flowId: string, agentId: string): Promise<AgentFlow>

// List flows - scoped to specific agent
private async listFlows(filters: {
  agentId: string  // Required!
  status?: FlowStatus[]
}): Promise<AgentFlow[]>

// Resume flow - verifies ownership
async resumeFlow(
  flowId: string, 
  input: ResumeInput, 
  agentId: string  // Required!
): Promise<void>
```

### 3. Message Router

**Updated Email Matching:**

```typescript
async matchEmailToFlow(
  email: InboundEmail,
  agentId: string  // Only match THIS agent's flows
): Promise<AgentFlow | null>
```

**Matching Logic:**
1. Extract request ID from subject: `[Req: req-789]`
2. Load flows for THIS agent only
3. Find flow with status=WAITING and matching requestId
4. Verify sender matches expected agent
5. Return matched flow OR null

### 4. Inbound Email Handler

**Updated Flow:**

```typescript
// 1. Determine recipient agent
const agent = await resolveAgentFromEmail(email.to)

// 2. Check if response to THIS AGENT's flow
const flow = await messageRouter.matchEmailToFlow(email, agent.id)

if (flow) {
  // Resume THIS agent's flow
  await flowEngine.resumeFlow(flow.id, { email }, agent.id)
} else {
  // New request for THIS agent
  await flowEngine.startFlow({ agentId: agent.id, trigger: email })
}
```

### 5. Wait for Agent Handler

**Updated to Include Request ID:**

```typescript
private async handleWaitForAgent(flow: AgentFlow, decision: FlowDecision) {
  // Generate request ID
  const requestId = `req-${nanoid(8)}`
  
  // Send email with request ID
  await sendEmail({
    to: decision.targetAgent.agentId,
    subject: `[Req: ${requestId}] ${decision.targetAgent.messageSubject}`,
    body: decision.targetAgent.messageBody
  })
  
  // Update flow with request ID for matching
  flow.waitingFor = {
    type: 'agent_response',
    agentId: decision.targetAgent.agentId,
    requestId: requestId  // For matching response
  }
}
```

---

## Security Implications

### ✅ Correct Design Provides

1. **Privacy:** Agents cannot see each other's flow state
2. **Isolation:** Failure in one agent doesn't affect others' flows
3. **Scalability:** Agents can be distributed independently
4. **Auditability:** Clear ownership of each flow
5. **Access Control:** Agent can only access its own flows

### ❌ Wrong Design Would Allow

1. Agent B could read Agent A's private context
2. Agent B could manipulate Agent A's flow state
3. Circular dependencies between agents
4. Race conditions on shared flow state
5. Security vulnerabilities

---

## Testing Considerations

### Unit Tests Should Verify

1. **Flow Isolation:**
   - Agent A cannot load Agent B's flows
   - Agent B cannot load Agent A's flows

2. **Request ID Matching:**
   - Correct matching of response to request
   - Handling of missing request IDs
   - Handling of expired request IDs

3. **Independent Processing:**
   - Agent B processes as new request
   - Agent B's response doesn't depend on Agent A's flow

### Integration Tests Should Verify

1. **Full Round Trip:**
   - User → Agent A → Agent B → Agent A → User
   - Verify complete flow isolation throughout

2. **Concurrent Flows:**
   - Multiple Agent A flows waiting for Agent B
   - Agent B responds to different Agent A flows
   - Correct matching in all cases

3. **Error Scenarios:**
   - Agent B never responds (timeout)
   - Agent B responds without request ID
   - Agent B responds with wrong request ID

---

## Migration from Wrong to Correct

If you already implemented the wrong approach, here's how to migrate:

### Step 1: Update Storage Structure

```bash
# Move existing flows to agent-scoped directories
for flow in agent-flows/flows/*.json; do
  flowId=$(basename "$flow")
  agentId=$(jq -r '.agentId' "$flow")
  mkdir -p "agent-flows/${agentId}/flows"
  mv "$flow" "agent-flows/${agentId}/flows/${flowId}"
done
```

### Step 2: Update Code

1. Update `AgentFlowEngine.loadFlow()` to require `agentId`
2. Update `AgentFlowEngine.listFlows()` to filter by `agentId`
3. Update `MessageRouter.matchEmailToFlow()` to accept `agentId`
4. Update inbound handler to pass `agentId` everywhere

### Step 3: Add Request ID Support

1. Generate request IDs in `handleWaitForAgent()`
2. Store request IDs in flow's `waitingFor` field
3. Extract request IDs from email subjects in matcher
4. Match responses using request IDs

### Step 4: Update Tests

1. Test flow isolation
2. Test request ID matching
3. Test independent processing

---

## Frequently Asked Questions

### Q: Why not use webhooks instead of request IDs?

**A:** Request IDs are simpler and more reliable:
- No webhook registration/expiration to manage
- Works with standard email threading
- Easier to debug (visible in subject line)
- No infrastructure dependencies

### Q: What if Agent B needs context from Agent A's flow?

**A:** Agent A should include necessary context in the email body:

```typescript
{
  messageBody: `
    Customer Question: "${originalCustomerQuestion}"
    
    Context:
    - Customer: ${customerEmail}
    - Previous interaction: ${summary}
    
    Please provide: Enterprise pricing details
  `
}
```

### Q: Can Agent B create its own flow?

**A:** Absolutely! Agent B can:
- Process in single-round (simple response)
- Create Flow-B-456 if it needs multiple rounds
- Both are valid and independent of Agent A's flow

### Q: What if we need transactional consistency?

**A:** This design trades transactional consistency for:
- Scalability
- Independence
- Resilience

If you need transactions, use event sourcing or saga pattern instead.

### Q: How do we handle circular dependencies?

**A:** The system prevents them naturally:
- Each agent maintains its own flows
- No shared state = no circular dependencies
- If Agent A waits for Agent B, and Agent B waits for Agent A:
  - Both flows timeout independently
  - No deadlock in flow state

---

## Conclusion

This architectural correction is **critical** for building a robust, scalable multi-agent system. The key insight is:

> **Each agent is a sovereign entity with its own flow state. Inter-agent communication happens through standard email channels with request tracking, not through shared flow state.**

This design pattern is similar to:
- Microservices (each service owns its data)
- Actor model (actors communicate via messages)
- Event-driven architecture (loose coupling via events)

The corrected design provides:
- ✅ Complete flow isolation
- ✅ Independent scaling
- ✅ Clear security boundaries
- ✅ Simple debugging
- ✅ Resilient to failures

---

**Related Documents:**
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Updated with corrections
- [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md) - Updated diagrams
- [server/utils/agentFlowEngine.skeleton.ts](./server/utils/agentFlowEngine.skeleton.ts) - Updated code


