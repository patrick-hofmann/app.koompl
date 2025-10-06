# Multi-Round Agent System - Implementation Complete ✅

## What Was Implemented

The complete multi-round agent system with inter-agent communication has been implemented successfully. This document summarizes what was built.

---

## ✅ Completed Components

### 1. Core Engine (`server/utils/agentFlowEngine.ts`)

The AgentFlowEngine manages the complete lifecycle of multi-round conversations:

**Key Features:**
- ✅ Start new flows from incoming emails
- ✅ Execute rounds with AI-powered decision making
- ✅ Resume flows after waiting for responses
- ✅ Complete flows with final responses
- ✅ Fail flows with error handling
- ✅ Process timeouts automatically
- ✅ Agent-scoped flow storage (complete isolation)
- ✅ Flow state persistence across rounds

**Methods:**
- `startFlow()` - Initialize new flow
- `executeRound()` - Run decision-making round
- `resumeFlow()` - Continue after async operation
- `completeFlow()` - Send final response and mark complete
- `failFlow()` - Handle failures gracefully
- `processTimeouts()` - Clean up expired flows
- `getFlow()` - Retrieve flow details
- `listAgentFlows()` - List flows for an agent

### 2. Decision Engine (`server/utils/decisionEngine.ts`)

AI-powered intelligent decision making:

**Key Features:**
- ✅ Analyzes flow state and makes decisions
- ✅ Calls OpenAI GPT-4-mini for decision making
- ✅ Structured JSON output parsing
- ✅ Decision types: CONTINUE, WAIT_FOR_AGENT, COMPLETE, FAIL
- ✅ Confidence scoring
- ✅ Context-aware prompts
- ✅ Action summarization
- ✅ Information gathering tracking

**Decision Process:**
1. Build comprehensive prompt with context
2. Call AI model with structured output format
3. Parse JSON response
4. Validate decision structure
5. Return actionable decision

### 3. Message Router (`server/utils/messageRouter.ts`)

Email routing and request/response matching:

**Key Features:**
- ✅ Route incoming emails to correct handler
- ✅ Match responses to waiting flows using request IDs
- ✅ Send agent-to-agent emails with request tracking
- ✅ Send agent-to-user emails
- ✅ Extract request IDs from subject lines
- ✅ Mailgun integration for email sending
- ✅ Agent authorization checking
- ✅ Email activity logging

**Request ID Format:**
```
Subject: [Req: req-abc123] Original Subject
```

**Matching Logic:**
1. Extract request ID from subject
2. Find flows waiting for that request ID
3. Verify sender matches expected agent
4. Check temporal validity
5. Return matched flow or null

### 4. Updated Inbound Handler (`server/api/mailgun/inbound.post.ts`)

Multi-round flow support in email handler:

**Key Features:**
- ✅ Check if email is response to existing flow
- ✅ Resume flows when responses arrive
- ✅ Start new flows for multi-round agents
- ✅ Fall back to single-round for non-multi-round agents
- ✅ Logging of all activity
- ✅ Complete agent isolation

**Flow:**
```
Email arrives → Extract recipient → Find agent
             → Check if flow response
             → YES: Resume flow
             → NO: Check multi-round enabled
             → YES: Start new flow
             → NO: Single-round processing
```

### 5. API Endpoints

Complete REST API for flow management:

**Endpoints:**
- `POST /api/agent-flows` - Start new flow
- `GET /api/agent-flows?agentId=x` - List agent's flows
- `GET /api/agent-flows/{id}?agentId=x` - Get flow details
- `POST /api/agent-flows/{id}/resume` - Resume flow
- `POST /api/agent-flows/{id}/complete` - Complete flow
- `POST /api/agent-flows/{id}/fail` - Fail flow

**Security:**
- All endpoints require `agentId` parameter
- Flows are isolated per agent
- No cross-agent access allowed

### 6. Agent Type Extension

Updated Agent type with multi-round configuration:

```typescript
interface MultiRoundConfig {
  enabled: boolean
  maxRounds: number
  timeoutMinutes: number
  canCommunicateWithAgents: boolean
  allowedAgentIds?: string[]
  autoResumeOnResponse: boolean
}

interface Agent {
  // ... existing fields
  multiRoundConfig?: MultiRoundConfig
}
```

### 7. Timeout Manager (`server/utils/timeoutManager.ts`)

Automatic timeout handling:

**Key Features:**
- ✅ Process timeouts for all active flows
- ✅ Send timeout notifications to users
- ✅ Mark flows as timed out
- ✅ Extend timeouts when needed
- ✅ Cron job endpoint for periodic execution

**Cron Endpoint:**
- `GET /api/cron/process-timeouts`
- Run every 5 minutes
- Protected with secret token

### 8. Type Definitions (`server/types/agent-flows.d.ts`)

Complete TypeScript types:

**Key Types:**
- `AgentFlow` - Flow state structure
- `FlowRound` - Round data
- `FlowDecision` - Decision structure
- `FlowStatus` - Flow states
- `EmailTrigger` - Trigger information
- `ResumeInput` - Resume parameters
- `MultiRoundConfig` - Agent configuration

---

## 🏗️ Architecture Highlights

### Agent Flow Isolation

**Critical Design Principle:**
> Each agent maintains its own flows. Agent B does NOT access Agent A's flows.

**Storage Structure:**
```
agent-flows/
  agent-a/flows/flow-A-123.json  ← Only Agent A accesses
  agent-b/flows/flow-B-456.json  ← Only Agent B accesses
```

### Request ID Tracking

**How It Works:**
1. Agent A generates request ID: `req-abc123`
2. Agent A includes in subject: `[Req: req-abc123] Question`
3. Agent B responds with same: `Re: [Req: req-abc123] Answer`
4. Agent A matches response to flow using request ID

### Multi-Round Flow

**Example Flow:**
```
Round 1: User → Agent A
         Agent A decides: WAIT_FOR_AGENT
         Agent A → Agent B (with req-789)
         Status: WAITING

[Agent B processes independently]

Round 2: Agent B → Agent A (Re: req-789)
         Agent A resumes
         Agent A decides: COMPLETE
         Agent A → User
         Status: COMPLETED
```

---

## 📝 Configuration Examples

### Enable Multi-Round for Agent

```json
{
  "id": "agent-a",
  "name": "Customer Support Coordinator",
  "email": "agent-a@example.com",
  "prompt": "You are a customer support coordinator...",
  "multiRoundConfig": {
    "enabled": true,
    "maxRounds": 10,
    "timeoutMinutes": 60,
    "canCommunicateWithAgents": true,
    "allowedAgentIds": ["agent-b", "agent-c"],
    "autoResumeOnResponse": true
  }
}
```

### Test the System

```bash
# 1. Send test email to Agent A
curl -X POST http://localhost:3000/api/mailgun/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "from": "user@example.com",
    "to": "agent-a@example.com",
    "subject": "Question about pricing",
    "Message-Id": "test-123",
    "stripped-text": "What is the Enterprise plan pricing?"
  }'

# 2. List flows for Agent A
curl "http://localhost:3000/api/agent-flows?agentId=agent-a"

# 3. Get specific flow
curl "http://localhost:3000/api/agent-flows/flow-agent-a-abc123?agentId=agent-a"
```

---

## 🚀 How to Use

### 1. Create Multi-Round Agents

Update your agents to enable multi-round:

```javascript
// In your agent configuration
multiRoundConfig: {
  enabled: true,
  maxRounds: 10,
  timeoutMinutes: 60,
  canCommunicateWithAgents: true,
  allowedAgentIds: ['agent-b', 'agent-c']
}
```

### 2. Set Up Cron Job

Schedule the timeout processor:

**Option A: Vercel Cron (vercel.json)**
```json
{
  "crons": [{
    "path": "/api/cron/process-timeouts",
    "schedule": "*/5 * * * *"
  }]
}
```

**Option B: External Cron**
```bash
*/5 * * * * curl -H "Authorization: Bearer YOUR_SECRET" https://your-domain.com/api/cron/process-timeouts
```

### 3. Configure Environment

```bash
# .env
OPENAI_API_KEY=sk-...
MAILGUN_API_KEY=key-...
MAILGUN_DOMAIN=mg.yourdomain.com
CRON_SECRET=your-secret-token
```

### 4. Monitor Flows

Access flow data:
```javascript
// List active flows
GET /api/agent-flows?agentId=agent-a&status=active

// View flow details
GET /api/agent-flows/flow-id?agentId=agent-a
```

---

## 🧪 Testing

### Load Test Agents

Use the provided test agents from `examples/test-agents.json`:
- Agent A: Customer Support Coordinator (orchestrator)
- Agent B: Product Specialist
- Agent C: Technical Support

### Test Scenario

1. User emails Agent A: "What's the Enterprise pricing?"
2. Agent A creates flow, asks Agent B
3. Agent B responds with pricing
4. Agent A combines info and responds to user

**Expected:**
- Agent A: 1 flow, 2 rounds, status=completed
- Agent B: 0 flows (single-round)
- User receives complete answer

---

## 📊 Monitoring

### Check Flow Status

```bash
# Active flows
curl "http://localhost:3000/api/agent-flows?agentId=agent-a&status=active"

# Completed flows
curl "http://localhost:3000/api/agent-flows?agentId=agent-a&status=completed"

# Failed/timed out
curl "http://localhost:3000/api/agent-flows?agentId=agent-a&status=failed"
curl "http://localhost:3000/api/agent-flows?agentId=agent-a&status=timeout"
```

### Logs

Look for these log entries:
- `[AgentFlowEngine] Started flow ...`
- `[AgentFlowEngine] Executing round ...`
- `[MessageRouter] Matched email to flow ...`
- `[DecisionEngine] Decision: ...`

---

## 🔐 Security Features

### Flow Isolation
- ✅ Agent-scoped storage paths
- ✅ Ownership verification on resume
- ✅ No cross-agent flow access

### Authorization
- ✅ Agent allowlist (`allowedAgentIds`)
- ✅ Communication permission checks
- ✅ Cron endpoint protected

### Email Validation
- ✅ Request ID verification
- ✅ Sender verification
- ✅ Temporal checks (timeout window)

---

## 📈 What's Next?

### Recommended Enhancements

1. **UI Dashboard**
   - Visual flow timeline
   - Real-time status updates
   - Flow debugging tools

2. **Advanced Features**
   - Parallel agent queries
   - Conditional branching
   - Human-in-the-loop approval

3. **Performance**
   - Redis for active flow state
   - Flow indexing for faster queries
   - Caching for agent lookup

4. **Monitoring**
   - Flow success metrics
   - Average duration tracking
   - Confidence score analytics

---

## 🎉 Success!

The multi-round agent system is fully implemented and ready to use!

**Key Achievements:**
- ✅ Complete flow isolation between agents
- ✅ AI-powered decision making
- ✅ Request ID tracking for reliable matching
- ✅ Timeout management
- ✅ Comprehensive API
- ✅ Production-ready code
- ✅ Full TypeScript support
- ✅ Detailed documentation

**Start using it:**
1. Configure your agents with `multiRoundConfig`
2. Set up the cron job
3. Send test emails
4. Monitor flows via API

Enjoy your new multi-round agent system! 🚀

