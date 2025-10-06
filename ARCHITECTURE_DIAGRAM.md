# Multi-Round Agent System - Architecture Diagrams

## 1. System Component Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         KOOMPL AGENT PLATFORM                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              Inbound Email Handler (Mailgun)               │    │
│  │  - Parse email                                              │    │
│  │  - Match to existing flow OR start new flow                │    │
│  │  - Route to AgentFlowEngine                                │    │
│  └───────────────────────┬────────────────────────────────────┘    │
│                          │                                           │
│  ┌───────────────────────▼────────────────────────────────────┐    │
│  │               Agent Flow Engine                             │    │
│  │  ┌─────────────────────────────────────────────────────┐  │    │
│  │  │ Flow State Management                                │  │    │
│  │  │ - Create/Load/Save flows                             │  │    │
│  │  │ - Track rounds and actions                           │  │    │
│  │  │ - Manage status transitions                          │  │    │
│  │  └─────────────────────────────────────────────────────┘  │    │
│  │  ┌─────────────────────────────────────────────────────┐  │    │
│  │  │ Round Executor                                       │  │    │
│  │  │ - Execute round logic                                │  │    │
│  │  │ - Call DecisionEngine                                │  │    │
│  │  │ - Handle decisions                                   │  │    │
│  │  └─────────────────────────────────────────────────────┘  │    │
│  └───────────────────────┬────────────────────────────────────┘    │
│                          │                                           │
│  ┌───────────────────────▼────────────────────────────────────┐    │
│  │               Decision Engine                               │    │
│  │  - Analyze flow state                                       │    │
│  │  - Call AI with decision prompt                            │    │
│  │  - Parse AI response                                        │    │
│  │  - Determine: CONTINUE / WAIT / COMPLETE / FAIL           │    │
│  └───────────────────────┬────────────────────────────────────┘    │
│                          │                                           │
│           ┌──────────────┴──────────────┐                           │
│           │                             │                           │
│  ┌────────▼─────────┐         ┌────────▼─────────┐                │
│  │ Message Router   │         │  Webhook Manager │                │
│  │ - Route emails   │         │  - Register      │                │
│  │ - Agent-to-agent │         │  - Trigger       │                │
│  │ - Match flows    │         │  - Cleanup       │                │
│  └────────┬─────────┘         └────────┬─────────┘                │
│           │                             │                           │
│  ┌────────▼─────────┐         ┌────────▼─────────┐                │
│  │ Timeout Manager  │         │  MCP Email Tool  │                │
│  │ - Check timeouts │         │  - Send emails   │                │
│  │ - Handle expired │         │  - Search agents │                │
│  │ - Notifications  │         │  - Get info      │                │
│  └──────────────────┘         └──────────────────┘                │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                         PERSISTENT STORAGE                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Flow Storage │  │ Agent Store  │  │Message Queue │             │
│  │ - Active     │  │ - Config     │  │ - Pending    │             │
│  │ - Waiting    │  │ - MCP Servers│  │ - In-flight  │             │
│  │ - Completed  │  │ - Permissions│  │ - Failed     │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Agent Flow Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLOW LIFECYCLE                                │
└─────────────────────────────────────────────────────────────────────┘

   ┌──────────────┐
   │ Email Arrives│
   └──────┬───────┘
          │
          ▼
   ┌──────────────────┐
   │ Check if response│         NO      ┌──────────────┐
   │ to existing flow?├────────────────►│ Create New   │
   └──────┬───────────┘                 │ Flow         │
          │ YES                          └──────┬───────┘
          │                                     │
          ▼                                     │
   ┌──────────────┐                            │
   │ Resume Flow  │◄───────────────────────────┘
   └──────┬───────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    ROUND EXECUTION                           │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Load Current State                                 │  │
│  │    - Previous rounds                                  │  │
│  │    - Messages exchanged                               │  │
│  │    - Information gathered                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                        │                                     │
│                        ▼                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 2. Decision Engine                                    │  │
│  │    - Call AI with context                             │  │
│  │    - Parse decision                                   │  │
│  │    - Evaluate confidence                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                        │                                     │
│                        ▼                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 3. Execute Decision                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│         │              │           │           │             │
│         ▼              ▼           ▼           ▼             │
│  ┌──────────┐  ┌──────────┐ ┌─────────┐ ┌─────────┐       │
│  │ CONTINUE │  │   WAIT   │ │COMPLETE │ │  FAIL   │       │
│  └────┬─────┘  └────┬─────┘ └────┬────┘ └────┬────┘       │
│       │             │            │           │             │
│       │             ▼            │           │             │
│       │      ┌──────────────┐   │           │             │
│       │      │ Send Email   │   │           │             │
│       │      │ to Agent B   │   │           │             │
│       │      │              │   │           │             │
│       │      │ Register     │   │           │             │
│       │      │ Webhook      │   │           │             │
│       │      │              │   │           │             │
│       │      │ Status:      │   │           │             │
│       │      │ WAITING      │   │           │             │
│       │      └──────┬───────┘   │           │             │
│       │             │            │           │             │
│       └─────┬───────┘            │           │             │
│             │                    │           │             │
└─────────────┼────────────────────┼───────────┼─────────────┘
              │                    │           │
              ▼                    ▼           ▼
       ┌────────────┐      ┌────────────┐ ┌────────────┐
       │ Next Round │      │Send Final  │ │Send Error  │
       │            │      │Response    │ │Message     │
       │ Status:    │      │            │ │            │
       │ ACTIVE     │      │Status:     │ │Status:     │
       └─────┬──────┘      │COMPLETED   │ │FAILED      │
             │             └────────────┘ └────────────┘
             │
             └──────────┐
                        │
        ┌───────────────┴────────────┐
        │ Check Max Rounds?          │
        │ Check Timeout?             │
        └───────────┬────────────────┘
                    │
            YES: Exceeded
                    │
                    ▼
            ┌────────────┐
            │ FAIL Flow  │
            │ (Timeout)  │
            └────────────┘
```

## 3. Inter-Agent Communication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│         INTER-AGENT COMMUNICATION (Example Scenario)                 │
└─────────────────────────────────────────────────────────────────────┘

  Customer                  Agent A                  Agent B
     │                    (Coordinator)           (Product Specialist)
     │                         │                          │
     │  1. Email: "What's     │                          │
     │  the Enterprise price?"│                          │
     ├────────────────────────►                          │
     │                         │                          │
     │                    ┌────┴─────┐                   │
     │                    │ Round 1  │                   │
     │                    │ Decision:│                   │
     │                    │ WAIT_FOR │                   │
     │                    │ AGENT_B  │                   │
     │                    │          │                   │
     │                    │ Create   │                   │
     │                    │Flow-A-123│                   │
     │                    └────┬─────┘                   │
     │                         │                          │
     │                         │  2. Email: "[Req: req-789]│
     │                         │  Customer pricing question"│
     │                         ├─────────────────────────►│
     │                         │                          │
     │                    ┌────┴────────┐                │
     │                    │ Flow-A-123  │         ┌──────┴─────┐
     │                    │ Status:     │         │NEW REQUEST │
     │                    │ WAITING     │         │(not a flow)│
     │                    │ requestId:  │         │            │
     │                    │ req-789     │         │Process     │
     │                    └─────────────┘         │as single-  │
     │                         │                  │round       │
     │                         │                  └──────┬─────┘
     │                         │                          │
     │                         │  3. Email: "Re: [req-789]│
     │                         │  Enterprise $299/month..." │
     │                         ◄─────────────────────────┤
     │                         │                          │
     │                    ┌────┴─────┐              (B completes,
     │                    │Match     │               no flow)
     │                    │req-789   │                   │
     │                    │to Flow-  │                   │
     │                    │A-123     │                   │
     │                    │          │                   │
     │                    │ Resume   │                   │
     │                    │Flow-A-123│                   │
     │                    └────┬─────┘                   │
     │                         │                          │
     │                    ┌────┴─────┐                   │
     │                    │ Round 2  │                   │
     │                    │ Decision:│                   │
     │                    │ COMPLETE │                   │
     │                    └────┬─────┘                   │
     │                         │                          │
     │  4. Email: "Thanks     │                          │
     │  for asking! Enterprise│                          │
     │  Plan is $299/month..." │                          │
     ◄────────────────────────┤                          │
     │                         │                          │
     │                    ┌────┴─────┐                   │
     │                    │Flow-A-123│                   │
     │                    │ Status:  │                   │
     │                    │COMPLETED │                   │
     │                    └──────────┘                   │
     │                                                     │

KEY PRINCIPLE: Agent B handles Agent A's request as a NEW REQUEST
              Agent B does NOT access Flow-A-123
              Agent B responds with req-789 for matching

Timeline:
│←─ ~10s ─→│←─ ~20s ─→│←─ ~10s ─→│
  Round 1    Wait for    Round 2
  (Active)   Agent B     (Active)
Flow-A-123  (WAITING)   Flow-A-123
            req-789     matched
```

## 4. Decision Engine Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DECISION ENGINE                               │
└─────────────────────────────────────────────────────────────────────┘

Input: Flow State + Agent Config + Context
│
├─► ┌────────────────────────────────────────────────────────┐
│   │ Context Builder                                        │
│   │ - Gather previous rounds                               │
│   │ - Collect messages exchanged                           │
│   │ - Summarize information gathered                       │
│   │ - List available agents                                │
│   │ - List available MCP servers                           │
│   └────────────────────┬───────────────────────────────────┘
│                        │
│                        ▼
├─► ┌────────────────────────────────────────────────────────┐
│   │ Prompt Generator                                       │
│   │ - Build decision prompt with context                   │
│   │ - Include agent's system prompt                        │
│   │ - Add decision framework                               │
│   │ - Format output schema (JSON)                          │
│   └────────────────────┬───────────────────────────────────┘
│                        │
│                        ▼
├─► ┌────────────────────────────────────────────────────────┐
│   │ AI Model Call                                          │
│   │ - Call OpenAI/Anthropic                                │
│   │ - Parse JSON response                                  │
│   │ - Extract decision type                                │
│   │ - Extract reasoning                                    │
│   │ - Extract confidence score                             │
│   └────────────────────┬───────────────────────────────────┘
│                        │
│                        ▼
├─► ┌────────────────────────────────────────────────────────┐
│   │ Decision Validator                                     │
│   │ - Check confidence threshold (> 0.7)                   │
│   │ - Validate decision type                               │
│   │ - Ensure required fields present                       │
│   │ - Check for circular dependencies                      │
│   └────────────────────┬───────────────────────────────────┘
│                        │
│                        ▼
├─► ┌────────────────────────────────────────────────────────┐
│   │ Intent Fulfillment Checker                             │
│   │ - Compare original request with gathered info          │
│   │ - Identify missing information                         │
│   │ - Determine if ready to respond                        │
│   │ - Suggest next steps if incomplete                     │
│   └────────────────────┬───────────────────────────────────┘
│                        │
│                        ▼
Output: Decision Object
{
  action: "CONTINUE" | "WAIT_FOR_AGENT" | "WAIT_FOR_MCP" | "COMPLETE" | "FAIL"
  reasoning: "Detailed explanation..."
  confidence: 0.95
  nextSteps: ["Step 1", "Step 2", ...]
  targetAgent?: { ... }      // If WAIT_FOR_AGENT
  mcpCall?: { ... }          // If WAIT_FOR_MCP
  finalResponse?: "..."      // If COMPLETE
}
```

## 5. Webhook & Timeout Management

```
┌─────────────────────────────────────────────────────────────────────┐
│                   WEBHOOK & TIMEOUT SYSTEM                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│ Flow enters WAITING │
│ state               │
└──────┬──────────────┘
       │
       ├──────────────────────────────┐
       │                              │
       ▼                              ▼
┌──────────────────┐         ┌──────────────────┐
│ Register Webhook │         │ Start Timeout    │
│                  │         │ Timer            │
│ - Generate ID    │         │                  │
│ - Set expectation│         │ timeout = now +  │
│ - Set expiration │         │ timeoutMinutes   │
│ - Store in DB    │         │                  │
└──────┬───────────┘         └──────┬───────────┘
       │                            │
       │                            │
       ▼                            ▼
┌──────────────────┐         ┌──────────────────┐
│ Wait for Event   │         │ Periodic Check   │
│                  │         │ (every 5 min)    │
│ - Agent response │         │                  │
│ - MCP callback   │         │ If now > timeout:│
│ - HTTP POST      │         │   - Fail flow    │
└──────┬───────────┘         │   - Notify user  │
       │                     │   - Cleanup      │
       │ Event occurs        └──────────────────┘
       │                            
       ▼                            
┌──────────────────┐                
│ Trigger Webhook  │                
│                  │                
│ - Validate event │                
│ - Load flow      │                
│ - Add to context │                
│ - Resume flow    │                
└──────┬───────────┘                
       │                            
       ▼                            
┌──────────────────┐                
│ Continue Flow    │                
│ (Next Round)     │                
└──────────────────┘                
```

## 6. Storage Schema

```
┌─────────────────────────────────────────────────────────────────────┐
│                      STORAGE STRUCTURE                               │
└─────────────────────────────────────────────────────────────────────┘

agent-flows/
│
├── agent-a/                       ← Flows scoped per agent
│   └── flows/
│       ├── flow-A-abc123.json    ← Agent A's flows
│       └── flow-A-def456.json
│
├── agent-b/
│   └── flows/
│       └── flow-B-xyz789.json    ← Agent B's flows (if any)
│
├── agent-c/
│   └── flows/
│       └── flow-C-lmn456.json    ← Agent C's flows (if any)
│
├── webhooks/
│   ├── webhook-123.json          ← WebhookRegistration
│   ├── webhook-456.json
│   └── webhook-789.json
│
├── message-queue/
│   ├── msg-001.json              ← QueuedMessage
│   ├── msg-002.json
│   └── msg-003.json
│
└── indexes/                       ← For efficient queries
    ├── agent-a/
    │   ├── by-status.json        ← Map status → [flowIds]
    │   └── by-date.json          ← Map date → [flowIds]
    ├── agent-b/
    │   └── ...
    └── agent-c/
        └── ...

KEY PRINCIPLE: Each agent's flows are completely isolated
               Agent B CANNOT access Agent A's flows
               Agent A CANNOT access Agent B's flows


AgentFlow Schema:
┌────────────────────────────────────────────────────────┐
│ id: "flow-abc123"                                      │
│ agentId: "agent-a"                                     │
│ status: "waiting"                                      │
│ trigger: {                                             │
│   type: "email"                                        │
│   from: "customer@example.com"                         │
│   subject: "Question about pricing"                    │
│   ...                                                  │
│ }                                                      │
│ rounds: [                                              │
│   {                                                    │
│     roundNumber: 1                                     │
│     decision: { type: "WAIT_FOR_AGENT", ... }         │
│     actions: [...]                                     │
│     aiCalls: [...]                                     │
│     messages: [...]                                    │
│   }                                                    │
│ ]                                                      │
│ waitingFor: {                                          │
│   type: "agent_response"                               │
│   agentId: "agent-b"                                   │
│   webhookId: "webhook-123"                             │
│ }                                                      │
│ metadata: {                                            │
│   totalAiCalls: 2                                      │
│   totalMcpCalls: 0                                     │
│   totalAgentMessages: 1                                │
│ }                                                      │
└────────────────────────────────────────────────────────┘
```

## 7. Monitoring Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                      MONITORING DASHBOARD                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Active Flows │  │   Success    │  │   Timeout    │              │
│  │              │  │     Rate     │  │     Rate     │              │
│  │     23       │  │    95.2%     │  │     2.1%     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Flow Status Distribution                                    │    │
│  │ ┌──────┐ ┌─────┐ ┌────────────┐ ┌─────┐ ┌─────┐          │    │
│  │ │Active│ │Wait │ │ Completed  │ │Fail │ │Time │          │    │
│  │ │  23  │ │  8  │ │    450     │ │ 12  │ │ 5   │          │    │
│  │ └──────┘ └─────┘ └────────────┘ └─────┘ └─────┘          │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Recent Flows                                                │    │
│  │ ┌────────┬────────┬───────┬──────────┬────────┬─────────┐│    │
│  │ │Flow ID │Agent   │Status │Rounds    │Duration│Started  ││    │
│  │ ├────────┼────────┼───────┼──────────┼────────┼─────────┤│    │
│  │ │abc-123 │Agent A │Active │  2/10    │  1m 23s│10:45 AM ││    │
│  │ │def-456 │Agent A │Waiting│  1/10    │  45s   │10:44 AM ││    │
│  │ │ghi-789 │Agent B │Complete│ 1/3     │  23s   │10:43 AM ││    │
│  │ └────────┴────────┴───────┴──────────┴────────┴─────────┘│    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Agent Performance                                           │    │
│  │                                                              │    │
│  │ Agent A: 150 flows │ Avg: 1.8min │ Success: 96%            │    │
│  │ ████████████████████████████████████████░░░░               │    │
│  │                                                              │    │
│  │ Agent B:  80 flows │ Avg: 0.5min │ Success: 98%            │    │
│  │ ██████████████████████████████████████████░                │    │
│  │                                                              │    │
│  │ Agent C:  45 flows │ Avg: 0.8min │ Success: 97%            │    │
│  │ ███████████████████████████████████████░░                  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Decision Confidence Distribution                            │    │
│  │                                                              │    │
│  │     │                                                        │    │
│  │ 100 │              ████                                     │    │
│  │  80 │         ████████████                                  │    │
│  │  60 │    ████████████████████                               │    │
│  │  40 │ ██████████████████████████                            │    │
│  │  20 │████████████████████████████                           │    │
│  │   0 └───────────────────────────────                        │    │
│  │     0.5  0.6  0.7  0.8  0.9  1.0  Confidence               │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## 8. Error Handling & Recovery

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING FLOW                               │
└─────────────────────────────────────────────────────────────────────┘

              Error Occurs
                   │
                   ▼
        ┌──────────────────┐
        │ Classify Error   │
        └────────┬─────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│Transient│  │Permanent│  │Unknown │
│        │  │         │  │        │
│- Network│  │- Invalid│  │- Weird │
│- Timeout│  │  Config │  │  stuff │
│- Rate   │  │- Missing│  │        │
│  limit  │  │  Agent  │  │        │
└───┬────┘  └────┬───┘  └────┬───┘
    │            │            │
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│ RETRY  │  │  FAIL  │  │ LOG &  │
│        │  │        │  │ ALERT  │
│Exp back│  │Notify  │  │        │
│off     │  │user    │  │Retry   │
│        │  │        │  │once    │
│Max 3   │  │Log     │  │        │
│attempts│  │error   │  │Then    │
│        │  │        │  │fail    │
└────────┘  └────────┘  └────────┘
```

## Legend

```
┌────────┐
│ Box    │  = Component or System
└────────┘

   ┌────┐
   │Item│  = Data or State
   └────┘

   ─────►  = Data Flow / Action

   │
   ▼       = Sequential Flow

   ├───►   = Decision Branch
```

---

For implementation details, see `IMPLEMENTATION_PLAN.md`
For quick start, see `QUICKSTART.md`

