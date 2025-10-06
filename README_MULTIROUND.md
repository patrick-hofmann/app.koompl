# Multi-Round Agent System - Quick Start 🚀

## ✅ Implementation Status: COMPLETE

The multi-round agent system with inter-agent communication is fully implemented and ready to use!

---

## 📦 What Was Built

### Core Components (All Implemented ✅)

1. **AgentFlowEngine** - Complete flow lifecycle management
2. **DecisionEngine** - AI-powered decision making
3. **MessageRouter** - Email routing and matching
4. **TimeoutManager** - Automatic timeout handling
5. **API Endpoints** - Full REST API for flow management
6. **Type Definitions** - Complete TypeScript support

### Key Files

**Core Logic:**
- `/server/utils/agentFlowEngine.ts` - Flow engine
- `/server/utils/decisionEngine.ts` - Decision making
- `/server/utils/messageRouter.ts` - Email routing
- `/server/utils/timeoutManager.ts` - Timeout handling

**API Endpoints:**
- `/server/api/agent-flows/index.post.ts` - Start flow
- `/server/api/agent-flows/index.get.ts` - List flows
- `/server/api/agent-flows/[id].get.ts` - Get flow
- `/server/api/agent-flows/[id]/resume.post.ts` - Resume flow
- `/server/api/agent-flows/[id]/complete.post.ts` - Complete flow
- `/server/api/agent-flows/[id]/fail.post.ts` - Fail flow
- `/server/api/cron/process-timeouts.get.ts` - Timeout processor

**Updated Files:**
- `/server/api/mailgun/inbound.post.ts` - Multi-round support
- `/app/types/index.d.ts` - Agent type with multiRoundConfig
- `/server/types/agent-flows.d.ts` - Flow type definitions

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Configure Environment

```bash
# .env
OPENAI_API_KEY=sk-...           # Required for decision making
MAILGUN_API_KEY=key-...          # Required for email sending
MAILGUN_DOMAIN=mg.yourdomain.com # Your Mailgun domain
CRON_SECRET=your-secret-token    # For cron job security
```

### Step 2: Enable Multi-Round for an Agent

Update your agent configuration:

```json
{
  "id": "agent-a",
  "name": "Customer Support Coordinator",
  "email": "agent-a@yourdomain.com",
  "prompt": "You are a customer support coordinator. You can ask other agents for information when needed.",
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

### Step 3: Set Up Cron Job

**Option A: Vercel (add to vercel.json):**
```json
{
  "crons": [{
    "path": "/api/cron/process-timeouts",
    "schedule": "*/5 * * * *"
  }]
}
```

**Option B: External Cron:**
```bash
*/5 * * * * curl -H "Authorization: Bearer YOUR_SECRET" https://your-domain.com/api/cron/process-timeouts
```

### Step 4: Test It!

Send a test email:

```bash
curl -X POST http://localhost:3000/api/mailgun/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "from": "customer@example.com",
    "to": "agent-a@yourdomain.com",
    "subject": "Question about pricing",
    "Message-Id": "test-123",
    "stripped-text": "What is the Enterprise plan pricing?"
  }'
```

Check the flow:

```bash
curl "http://localhost:3000/api/agent-flows?agentId=agent-a"
```

---

## 💡 How It Works

### The Flow

```
1. User emails Agent A
   └─> Agent A creates Flow-A-123

2. Agent A analyzes request
   └─> Decision: Need info from Agent B

3. Agent A emails Agent B with [Req: req-789]
   └─> Flow-A-123: status = WAITING

4. Agent B receives email
   └─> Treats as NEW REQUEST (independent)
   └─> Responds with [Req: req-789]

5. Agent A receives response
   └─> Matches req-789 to Flow-A-123
   └─> Flow-A-123: status = ACTIVE

6. Agent A completes
   └─> Emails user with combined answer
   └─> Flow-A-123: status = COMPLETED
```

### Key Principle

> **Each agent manages its own flows independently.**
> Agent B does NOT access Agent A's flows.
> Communication is via email with request ID tracking.

---

## 📚 Documentation

### For Quick Reference
- **This File** - Quick start and basics
- `IMPLEMENTATION_COMPLETE.md` - Full implementation details
- `QUICKSTART.md` - Original quick start guide

### For Architecture
- `ARCHITECTURE_CORRECTION.md` - **Critical design principles**
- `ARCHITECTURE_DIAGRAM.md` - Visual diagrams
- `IMPLEMENTATION_PLAN.md` - Complete specification

### For Development
- `server/types/agent-flows.d.ts` - TypeScript types
- `examples/test-agents.json` - Test agent configs

---

## 🎯 Use Cases Supported

### ✅ Simple Information Request
```
User asks Agent A about pricing
→ Agent A asks Agent B (product specialist)
→ Agent B responds
→ Agent A answers user
```

### ✅ Complex Multi-Agent Request
```
User asks Agent A about SSO + pricing
→ Agent A asks Agent C (technical)
→ Agent C responds with SSO info
→ Agent A asks Agent B (sales)
→ Agent B responds with pricing
→ Agent A combines both and answers user
```

### ✅ Error Handling
```
Agent B doesn't respond in time
→ Flow times out after 60 minutes
→ User receives timeout notification
```

---

## 🔧 API Reference

### Start Flow
```bash
POST /api/agent-flows
{
  "agentId": "agent-a",
  "trigger": { ... },
  "maxRounds": 10,
  "timeoutMinutes": 60
}
```

### List Flows
```bash
GET /api/agent-flows?agentId=agent-a&status=active
```

### Get Flow
```bash
GET /api/agent-flows/flow-id?agentId=agent-a
```

### Resume Flow
```bash
POST /api/agent-flows/flow-id/resume
{
  "agentId": "agent-a",
  "input": {
    "type": "email_response",
    "email": { ... }
  }
}
```

---

## 🐛 Troubleshooting

### Flow Not Starting?
- ✅ Check `multiRoundConfig.enabled = true`
- ✅ Verify OpenAI API key is set
- ✅ Check agent email matches recipient

### Flow Stuck in "waiting"?
- ✅ Check if target agent has config
- ✅ Verify request ID in email subject
- ✅ Check timeout hasn't expired
- ✅ Review logs for errors

### Timeouts?
- ✅ Increase `timeoutMinutes` in config
- ✅ Verify cron job is running
- ✅ Check agent response times

---

## 📊 Monitoring

### Check Flow Status
```bash
# All active flows
curl "http://localhost:3000/api/agent-flows?agentId=agent-a&status=active"

# Failed flows
curl "http://localhost:3000/api/agent-flows?agentId=agent-a&status=failed"

# Timed out flows
curl "http://localhost:3000/api/agent-flows?agentId=agent-a&status=timeout"
```

### View Flow Details
```bash
curl "http://localhost:3000/api/agent-flows/flow-id?agentId=agent-a" | jq
```

### Check Logs
Look for:
- `[AgentFlowEngine] Started flow ...`
- `[DecisionEngine] Decision: ...`
- `[MessageRouter] Matched email to flow ...`

---

## ✨ Example: Customer Support Scenario

### Agent Configuration

**Agent A (Coordinator):**
```json
{
  "id": "agent-a",
  "name": "Support Coordinator",
  "email": "support@company.com",
  "prompt": "You coordinate customer support. Ask Agent B (sales) for pricing, Agent C (tech) for technical issues.",
  "multiRoundConfig": {
    "enabled": true,
    "maxRounds": 10,
    "timeoutMinutes": 60,
    "canCommunicateWithAgents": true,
    "allowedAgentIds": ["agent-b", "agent-c"]
  }
}
```

**Agent B (Sales):**
```json
{
  "id": "agent-b",
  "name": "Sales Specialist",
  "email": "sales@company.com",
  "prompt": "You provide pricing information. Enterprise: $299/month, Pro: $99/month, Starter: $29/month.",
  "multiRoundConfig": {
    "enabled": false
  }
}
```

### Test Flow

1. **Customer emails:** "What's the Enterprise pricing?"
2. **Agent A Round 1:** Decides to ask Agent B
3. **Agent B:** Responds with pricing details
4. **Agent A Round 2:** Completes with full answer
5. **Customer receives:** Complete pricing information

**Result:**
- Response time: ~30-60 seconds
- Agent A: 1 flow, 2 rounds
- Agent B: 0 flows (single response)
- Customer: Complete answer

---

## 🎉 You're Ready!

The system is fully implemented and operational. Start by:

1. ✅ Configuring your agents
2. ✅ Setting up the cron job
3. ✅ Testing with sample emails
4. ✅ Monitoring flows via API

For detailed information, see:
- `IMPLEMENTATION_COMPLETE.md` - Full implementation details
- `ARCHITECTURE_CORRECTION.md` - Design principles
- `IMPLEMENTATION_PLAN.md` - Complete specification

**Happy multi-round agent building! 🚀**

