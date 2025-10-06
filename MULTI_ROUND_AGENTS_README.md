# Multi-Round Agent System - Complete Documentation

## 📋 Overview

This documentation package provides a comprehensive implementation plan for building a sophisticated multi-round agent system with inter-agent communication, persistent flows, webhook support, and intelligent decision-making.

### What's Included

This system enables agents to:
- ✅ Execute multi-step workflows across multiple rounds
- ✅ Communicate with other agents to gather information
- ✅ Make intelligent decisions about next actions using AI
- ✅ Persist state across async operations (email responses, webhooks)
- ✅ Handle timeouts and failures gracefully
- ✅ Support complex use cases like: "Agent A asks Agent B for info, then responds to user"

---

## 📚 Documentation Structure

### 1. **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** 📘
**The Complete Guide - Read This First**

The comprehensive 12-week implementation plan covering:
- Architecture overview
- Database schemas and storage structure
- Core components (FlowEngine, DecisionEngine, MessageRouter, etc.)
- API endpoints specification
- MCP email tool integration
- Test agent definitions with example scenarios
- Phase-by-phase implementation roadmap
- Testing strategy and success metrics

**Best for:** Project managers, architects, senior developers

---

### 2. **[QUICKSTART.md](./QUICKSTART.md)** 🚀
**Get Up and Running in 15 Minutes**

Quick start guide for developers:
- Enable multi-round for an agent (3 steps)
- Create and configure test agents
- Send test emails and monitor flows
- Common troubleshooting tips
- API quick reference

**Best for:** Developers who want to start coding immediately

---

### 3. **[ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md)** 📐
**Visual System Architecture**

ASCII diagrams illustrating:
- System component overview
- Agent flow lifecycle
- Inter-agent communication flow
- Decision engine architecture
- Webhook & timeout management
- Storage schema
- Monitoring dashboard layout
- Error handling flows

**Best for:** Visual learners, system architects, documentation

---

### 4. **[server/types/agent-flows.d.ts](./server/types/agent-flows.d.ts)** 📝
**TypeScript Type Definitions**

Complete type definitions for:
- `AgentFlow` - Core flow state structure
- `FlowRound` - Individual round data
- `FlowDecision` - Decision types and parameters
- `WebhookRegistration` - Webhook management
- `QueuedMessage` - Message queue
- All supporting interfaces

**Best for:** TypeScript developers, API consumers

---

### 5. **[server/utils/agentFlowEngine.skeleton.ts](./server/utils/agentFlowEngine.skeleton.ts)** 🏗️
**Skeleton Implementation**

Starter code for the core FlowEngine:
- `startFlow()` - Initialize new agent flow
- `executeRound()` - Run a single decision/action round
- `resumeFlow()` - Continue after waiting for response
- `completeFlow()` / `failFlow()` - Terminate flows
- `processTimeouts()` - Handle expired flows

**Best for:** Developers ready to implement the system

---

### 6. **[examples/test-agents.json](./examples/test-agents.json)** 🧪
**Test Agent Configurations**

Ready-to-use agent definitions:
- **Agent A** - Customer Support Coordinator (orchestrator)
- **Agent B** - Product Specialist (pricing expert)
- **Agent C** - Technical Support (tech expert)
- Complete test scenarios with expected outcomes

**Best for:** QA engineers, developers testing the system

---

### 7. **[ARCHITECTURE_CORRECTION.md](./ARCHITECTURE_CORRECTION.md)** ⚠️
**Critical Architectural Correction**

**IMPORTANT: Read this before implementing!**

Explains the critical architectural correction regarding flow isolation:
- Why flows must be agent-scoped
- How inter-agent communication works (request IDs, not shared state)
- Wrong vs. correct approach comparison
- Security and scalability implications
- Migration guide if you started with wrong approach

**Key principle:** Each agent manages its own flows. Agent B does NOT access Agent A's flows.

**Best for:** Everyone - this is a fundamental design principle

---

## 🎯 Use Cases Supported

### Use Case 1: Simple Information Request
```
Customer → Agent A → Agent B → Agent A → Customer
```
**Example:** "What's the Enterprise plan pricing?"
- Agent A receives question
- Agent A asks Agent B (product specialist)
- Agent B responds with pricing
- Agent A sends complete answer to customer

**Duration:** ~30-60 seconds | **Rounds:** 2

### Use Case 2: Multi-Agent Information Gathering
```
Customer → Agent A → Agent B & Agent C → Agent A → Customer
```
**Example:** "I need SSO setup help and pricing info"
- Agent A receives question
- Agent A asks Agent C (technical) about SSO
- Agent C responds with setup instructions
- Agent A asks Agent B (sales) about pricing
- Agent B responds with pricing
- Agent A combines both responses and sends to customer

**Duration:** ~60-180 seconds | **Rounds:** 3

### Use Case 3: Unfulfillable Request
```
Customer → Agent A → Customer (with explanation)
```
**Example:** "Send me your source code"
- Agent A analyzes request
- Determines it cannot be fulfilled
- Responds with explanation and alternatives

**Duration:** ~10-30 seconds | **Rounds:** 1

---

## 🏗️ System Architecture (High-Level)

```
┌─────────────────────────────────────────────────────┐
│                  Inbound Email                       │
│                       ↓                              │
│              ┌────────────────┐                      │
│              │ Message Router │                      │
│              └────────┬───────┘                      │
│                       ↓                              │
│         New Request ← → Response to Flow             │
│              ↓                    ↓                  │
│     ┌────────────────┐    ┌──────────────┐          │
│     │  Start Flow    │    │ Resume Flow  │          │
│     └────────┬───────┘    └──────┬───────┘          │
│              ↓                    ↓                  │
│         ┌─────────────────────────────┐              │
│         │   Agent Flow Engine         │              │
│         │   - Execute Rounds          │              │
│         │   - Decision Making         │              │
│         │   - State Management        │              │
│         └─────────────┬───────────────┘              │
│                       ↓                              │
│         ┌─────────────────────────────┐              │
│         │    Decision Engine          │              │
│         │    (AI-Powered)             │              │
│         └─────────────┬───────────────┘              │
│                       ↓                              │
│          Continue / Wait / Complete / Fail           │
│              ↓         ↓         ↓         ↓         │
│         Next Round  Webhook  Response   Error        │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Key Components

### 1. **Agent Flow Engine**
Manages the complete lifecycle of multi-round conversations.

**Responsibilities:**
- Create and initialize flows
- Execute rounds
- Manage state transitions
- Handle completion and failures

### 2. **Decision Engine**
Makes intelligent decisions about next actions using AI.

**Responsibilities:**
- Analyze flow state and context
- Call AI model with decision prompt
- Parse and validate decisions
- Check intent fulfillment

### 3. **Message Router**
Routes emails to the correct handler.

**Responsibilities:**
- Match incoming emails to existing flows
- Route new requests to appropriate agents
- Handle agent-to-agent messages

### 4. **Webhook Manager**
Manages async operations and callbacks.

**Responsibilities:**
- Register webhooks for expected responses
- Trigger webhooks when events occur
- Clean up expired webhooks

### 5. **Timeout Manager**
Prevents flows from running indefinitely.

**Responsibilities:**
- Monitor flow timeouts
- Handle expired flows
- Send timeout notifications

---

## 🔑 Key Concepts

### Flow
A persistent conversation from initial trigger to final response.
- Has unique ID
- Contains multiple rounds
- Tracks all actions and decisions
- Has status: active, waiting, completed, failed, timeout

### Round
A single iteration of decision-making and action execution.
- Analyzes current state
- Makes decision (AI-powered)
- Executes actions
- Updates flow state

### Decision Types
- **CONTINUE** - Take another action in current flow
- **WAIT_FOR_AGENT** - Send message to another agent and wait
- **WAIT_FOR_MCP** - Call MCP tool and wait for result
- **COMPLETE** - Send final response to user
- **FAIL** - Cannot fulfill request

### Agent Configuration
```typescript
{
  multiRoundConfig: {
    enabled: true,
    maxRounds: 10,
    timeoutMinutes: 60,
    canCommunicateWithAgents: true,
    allowedAgentIds: ['agent-b', 'agent-c'],
    autoResumeOnResponse: true
  }
}
```

---

## 🚀 Getting Started

### Step 1: Read the Documentation
1. Start with **[QUICKSTART.md](./QUICKSTART.md)** for immediate hands-on
2. Read **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** for full details
3. Review **[ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md)** for visual understanding

### Step 2: Understand the Types
- Explore **[server/types/agent-flows.d.ts](./server/types/agent-flows.d.ts)**
- Understand the data structures
- See how flows, rounds, and decisions are modeled

### Step 3: Review the Skeleton Code
- Study **[server/utils/agentFlowEngine.skeleton.ts](./server/utils/agentFlowEngine.skeleton.ts)**
- Understand the core methods
- See where to plug in decision engine, MCP calls, etc.

### Step 4: Load Test Agents
- Use **[examples/test-agents.json](./examples/test-agents.json)**
- Set up Agent A, B, and C
- Run test scenarios

### Step 5: Start Implementing
Follow the 12-week implementation plan:
1. **Phase 1:** Foundation (Weeks 1-2)
2. **Phase 2:** Core Flow Logic (Weeks 3-4)
3. **Phase 3:** Inter-Agent Communication (Weeks 5-6)
4. **Phase 4:** Webhook & Timeout (Weeks 7-8)
5. **Phase 5:** Testing & UI (Weeks 9-10)
6. **Phase 6:** Polish & Production (Weeks 11-12)

---

## 🧪 Testing

### Unit Tests
- AgentFlowEngine methods
- DecisionEngine logic
- MessageRouter matching
- WebhookManager operations
- TimeoutManager handling

### Integration Tests
- Simple flow (A → B → A → User)
- Multi-round flow (A → B → A → C → A → User)
- Timeout scenarios
- Webhook callbacks
- Concurrent flows

### End-to-End Tests
- Full customer journey
- Real email sending/receiving
- Complete flow lifecycle
- Error handling and recovery

---

## 📈 Success Metrics

### Technical
- **Flow Success Rate:** > 95%
- **Average Duration:** < 2 minutes
- **Timeout Rate:** < 5%
- **Average Rounds:** 2-4
- **Decision Confidence:** > 0.85

### Business
- Improved response quality
- Faster responses for complex queries
- Reduced manual interventions
- Better customer satisfaction

---

## 🔧 Technology Stack

### Core Technologies
- **Runtime:** Node.js / Nuxt 3
- **Language:** TypeScript
- **Storage:** Nitro Storage (file-based, easily swappable)
- **AI:** OpenAI GPT-4 / Anthropic Claude
- **Email:** Mailgun webhooks

### Libraries
- `nanoid` - Unique ID generation
- `h3` - HTTP utilities
- `mcp-use` - MCP protocol support

---

## 📖 API Reference

### Flow Management
```typescript
// Start flow
POST /api/agent-flows
{ agentId, trigger, maxRounds, timeoutMinutes }

// Get flow
GET /api/agent-flows/{flowId}

// Resume flow
POST /api/agent-flows/{flowId}/resume
{ type: "email_response", email: {...} }

// Complete flow
POST /api/agent-flows/{flowId}/complete
{ finalResponse: "..." }
```

### Agent Communication
```typescript
// Send agent-to-agent message
POST /api/agents/{fromAgentId}/send-message
{ toAgentId, subject, body, flowId }
```

### Webhook Management
```typescript
// Webhook receiver
POST /api/webhooks/agent-flows/{webhookId}
{ type, payload }
```

---

## 🐛 Troubleshooting

### Flow not starting?
- ✅ Check `multiRoundConfig.enabled = true`
- ✅ Verify agent email matches recipient
- ✅ Check server logs

### Flow stuck in waiting?
- ✅ Verify target agent has multi-round enabled
- ✅ Check webhook is registered
- ✅ Confirm timeout hasn't expired
- ✅ Manually resume if needed

### Timeouts occurring?
- ✅ Increase `timeoutMinutes`
- ✅ Check agent response times
- ✅ Optimize decision-making speed

---

## 🛣️ Roadmap

### Current (v1.0)
- ✅ Basic multi-round flows
- ✅ Inter-agent communication via email
- ✅ Webhook support
- ✅ Timeout management
- ✅ AI-powered decisions

### Future (v2.0)
- Parallel agent queries
- Conditional branching
- Human-in-the-loop
- Learning & optimization
- Flow templates
- Additional channels (Slack, Teams, SMS)

---

## 📄 License

[Your License Here]

---

## 🤝 Contributing

Contributions welcome! Please read the implementation plan and follow the established patterns.

---

## 💡 Need Help?

1. **Quick questions:** See [QUICKSTART.md](./QUICKSTART.md)
2. **Implementation details:** See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
3. **Architecture questions:** See [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md)
4. **Type definitions:** See [server/types/agent-flows.d.ts](./server/types/agent-flows.d.ts)
5. **Code examples:** See [server/utils/agentFlowEngine.skeleton.ts](./server/utils/agentFlowEngine.skeleton.ts)
6. **Test scenarios:** See [examples/test-agents.json](./examples/test-agents.json)

---

## 🎉 What's Next?

1. Read the **QUICKSTART.md** to get hands-on immediately
2. Study the **IMPLEMENTATION_PLAN.md** for complete understanding
3. Review the **type definitions** and **skeleton code**
4. Set up **test agents** and run scenarios
5. Start **implementing Phase 1** of the plan

**Happy building! 🚀**

