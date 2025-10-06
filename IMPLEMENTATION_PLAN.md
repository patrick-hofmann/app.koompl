# Multi-Round Agent System - Implementation Plan

## Executive Summary

This document outlines the implementation of a sophisticated multi-round agent system that supports:
- **Multi-round thinking & MCP execution** - Agents can make decisions across multiple steps
- **Intent fulfillment detection** - Automatic determination when user's request is satisfied
- **Inter-agent communication** - Agents can communicate with each other via email
- **Persistent agent flows** - State management for long-running conversations
- **Webhook-based continuation** - Async operations with webhook callbacks
- **Timeout management** - Handling of incomplete or stalled flows
- **Generic communication layer** - Email sending via MCP or other protocols

---

## 1. Architecture Overview

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent Flow Engine                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Decision   │  │     MCP      │  │     AI       │     │
│  │   Engine     │  │   Executor   │  │   Executor   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Message    │  │   Webhook    │  │   Timeout    │     │
│  │   Router     │  │   Manager    │  │   Manager    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Flow Storage    │  │  Agent Directory  │  │  Message Queue   │
│  (Persistent)    │  │  (Agent Registry) │  │  (In-Progress)   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### 1.2 Data Flow - Use Case Example

```
User → Email → Agent A
              ↓
      [Agent A: Flow Created: flow-A-123]
              ↓
      [Agent A: Round 1: Analyze Request]
              ↓
      [Agent A: Decision: Need info from Agent B]
              ↓
      Agent A → Email (with request-id: req-456) → Agent B
              ↓
      [Agent A: Flow Status: WAITING]
      [Agent A: Waiting for response with req-456]
              ↓
              │
              ▼
      Agent B receives email (from Agent A, with req-456)
              ↓
      [Agent B: Handles as NEW REQUEST]
      [Agent B: Creates Flow-B-789 OR processes single-round]
              ↓
      [Agent B: Processes request, generates response]
              ↓
      Agent B → Email (Re: req-456) → Agent A
              ↓
              │
              ▼
      Agent A receives email (from Agent B, Re: req-456)
              ↓
      [Agent A: Match email to Flow-A-123 using req-456]
              ↓
      [Agent A: Resume Flow-A-123]
              ↓
      [Agent A: Round 2: Process B's Response]
              ↓
      [Agent A: Decision: Have enough info]
              ↓
      Agent A → Email → User
              ↓
      [Agent A: Flow Completed]
```

---

## 2. Database Schema / Storage Structure

### 2.1 Agent Flow State

**Important: Flows are Agent-Scoped**

Each agent maintains its own flows independently. When Agent A asks Agent B for information:
- Agent A creates and manages its own flow (e.g., `flow-agent-a-123`)
- Agent B handles the request independently (either single-round or its own flow `flow-agent-b-456`)
- Agent B does NOT access or modify Agent A's flow
- Communication is purely via email with request tracking IDs

**Storage Path:** `agent-flows/{agentId}/flows/{flowId}.json`

```typescript
interface AgentFlow {
  id: string                      // Unique flow ID
  agentId: string                 // Primary agent handling this flow
  status: FlowStatus              // 'active' | 'waiting' | 'completed' | 'failed' | 'timeout'
  
  // Original request
  trigger: {
    type: 'email' | 'webhook' | 'manual'
    messageId: string
    from: string
    to: string
    subject: string
    body: string
    receivedAt: string
  }
  
  // User/requester information
  requester: {
    email: string
    name?: string
  }
  
  // Flow execution history
  rounds: FlowRound[]
  
  // Current state
  currentRound: number
  maxRounds: number               // Limit to prevent infinite loops (default: 10)
  
  // Wait state (for async operations)
  waitingFor?: {
    type: 'agent_response' | 'mcp_callback' | 'webhook' | 'timeout'
    agentId?: string              // If waiting for another agent
    requestId?: string            // Request ID sent to other agent for tracking
    webhookId?: string            // If waiting for a webhook
    expectedBy?: string           // Timeout deadline (ISO timestamp)
    metadata?: Record<string, unknown>
  }
  
  // Timing
  createdAt: string
  updatedAt: string
  completedAt?: string
  timeoutAt: string               // Auto-fail if not completed by this time
  
  // Metadata
  metadata: {
    totalAiCalls: number
    totalMcpCalls: number
    totalAgentMessages: number
    tags?: string[]
  }
}

interface FlowRound {
  roundNumber: number
  startedAt: string
  completedAt?: string
  
  // Decision made in this round
  decision: {
    type: 'continue' | 'wait_for_agent' | 'wait_for_mcp' | 'complete' | 'fail'
    reasoning: string             // Why this decision was made
    confidence: number            // 0-1 confidence in decision
  }
  
  // Actions taken
  actions: FlowAction[]
  
  // AI/MCP usage in this round
  aiCalls: Array<{
    id: string
    provider: string
    model: string
    prompt: string
    response: string
    tokensUsed?: number
  }>
  
  mcpCalls: Array<{
    id: string
    serverId: string
    serverName: string
    input: unknown
    output: unknown
  }>
  
  // Messages sent/received
  messages: Array<{
    id: string
    direction: 'sent' | 'received'
    to?: string
    from?: string
    subject?: string
    body: string
    timestamp: string
  }>
}

interface FlowAction {
  id: string
  type: 'send_email' | 'call_mcp' | 'call_ai' | 'wait' | 'decide'
  timestamp: string
  status: 'pending' | 'completed' | 'failed'
  input?: unknown
  output?: unknown
  error?: string
}

type FlowStatus = 
  | 'active'      // Currently processing
  | 'waiting'     // Waiting for external input (agent, webhook, etc.)
  | 'completed'   // Successfully completed
  | 'failed'      // Failed to complete
  | 'timeout'     // Exceeded timeout deadline
```

### 2.2 Agent Registry Extensions

Update existing `Agent` type:

```typescript
interface Agent {
  id: string
  name: string
  email: string
  role: string
  prompt: string
  avatar?: AvatarProps
  mcpServerIds?: string[]
  
  // NEW: Multi-round configuration
  multiRoundConfig?: {
    enabled: boolean              // Enable multi-round processing
    maxRounds: number             // Max rounds per flow (default: 10)
    timeoutMinutes: number        // Flow timeout in minutes (default: 60)
    canCommunicateWithAgents: boolean  // Can this agent message other agents?
    allowedAgentIds?: string[]    // Whitelist of agents this agent can message
    autoResumeOnResponse: boolean // Automatically resume flow when response received
  }
}
```

### 2.3 Message Queue

**Storage Path:** `agent-flows/message-queue/{messageId}.json`

```typescript
interface QueuedMessage {
  id: string
  flowId: string                  // Associated flow
  type: 'agent_request' | 'agent_response' | 'webhook_callback'
  
  from: string                    // Sender email/agent ID
  to: string                      // Recipient email/agent ID
  subject: string
  body: string
  
  status: 'pending' | 'processing' | 'delivered' | 'failed'
  attempts: number
  maxAttempts: number
  
  metadata?: Record<string, unknown>
  
  createdAt: string
  processedAt?: string
  deliveredAt?: string
}
```

### 2.4 Webhook Registry

**Storage Path:** `agent-flows/webhooks/{webhookId}.json`

```typescript
interface WebhookRegistration {
  id: string
  flowId: string
  type: 'agent_response' | 'mcp_callback' | 'custom'
  
  // What we're waiting for
  expectation: {
    type: 'email' | 'http_post'
    fromEmail?: string            // If type='email', expect from this address
    toEmail?: string              // If type='email', expect to this address
    url?: string                  // If type='http_post', POST to this URL
  }
  
  status: 'active' | 'triggered' | 'expired'
  triggeredAt?: string
  expiresAt: string               // Webhook expires after this time
  
  createdAt: string
}
```

---

## 3. Core Implementation Components

### 3.1 Agent Flow Engine

**File:** `server/utils/agentFlowEngine.ts`

```typescript
export class AgentFlowEngine {
  
  /**
   * Start a new agent flow from an incoming email
   */
  async startFlow(params: {
    agentId: string
    trigger: EmailTrigger
    maxRounds?: number
    timeoutMinutes?: number
  }): Promise<AgentFlow>
  
  /**
   * Execute a single round of the flow
   * Returns decision on what to do next
   */
  async executeRound(flowId: string): Promise<RoundResult>
  
  /**
   * Resume a suspended flow (after receiving expected response)
   */
  async resumeFlow(flowId: string, input: ResumeInput): Promise<void>
  
  /**
   * Complete a flow and send final response
   */
  async completeFlow(flowId: string, finalResponse: string): Promise<void>
  
  /**
   * Fail a flow with error message
   */
  async failFlow(flowId: string, reason: string): Promise<void>
  
  /**
   * Check for timed-out flows and handle them
   */
  async processTimeouts(): Promise<void>
}

interface RoundResult {
  decision: 'continue' | 'wait' | 'complete' | 'fail'
  reasoning: string
  nextAction?: {
    type: 'send_email' | 'call_mcp' | 'call_ai'
    params: unknown
  }
}
```

**Key Implementation Details:**

1. **Round Execution Logic:**
   - Load flow state
   - Gather context (previous rounds, messages, MCP data)
   - Call AI with decision-making prompt
   - Parse AI response for next action
   - Execute action(s)
   - Update flow state
   - Return decision

2. **Decision Making:**
   - Use structured prompts to get AI to decide: continue/wait/complete/fail
   - Parse AI response for confidence scores
   - If confidence < threshold, request clarification or fail gracefully

3. **State Transitions:**
```
active → waiting → active → ... → completed
  │                              ↓
  └──────────────────────────→ failed
                               ↓
                            timeout
```

### 3.2 Decision Engine

**File:** `server/utils/decisionEngine.ts`

```typescript
export class DecisionEngine {
  
  /**
   * Analyze current flow state and decide next action
   * Uses AI to make intelligent decisions
   */
  async makeDecision(params: {
    flow: AgentFlow
    agent: Agent
    context: DecisionContext
  }): Promise<Decision>
  
  /**
   * Check if user's intent has been fulfilled
   */
  async checkIntentFulfillment(params: {
    flow: AgentFlow
    agent: Agent
  }): Promise<FulfillmentCheck>
}

interface Decision {
  action: 'continue' | 'wait_for_agent' | 'wait_for_mcp' | 'complete' | 'fail'
  reasoning: string
  confidence: number            // 0-1
  nextSteps?: string[]          // Human-readable next steps
  
  // If action = 'wait_for_agent'
  targetAgent?: {
    agentId: string
    messageSubject: string
    messageBody: string
    question: string            // What we're asking
  }
  
  // If action = 'wait_for_mcp'
  mcpCall?: {
    serverId: string
    method: string
    params: unknown
  }
  
  // If action = 'complete'
  finalResponse?: string
}

interface FulfillmentCheck {
  isFulfilled: boolean
  confidence: number
  reasoning: string
  missingInformation?: string[]
  suggestedNextSteps?: string[]
}
```

**Decision Prompt Template:**

```typescript
const DECISION_PROMPT = `You are an intelligent agent decision engine. Analyze the current conversation flow and decide the next action.

Current Flow Status:
- Round: {currentRound}/{maxRounds}
- Original Request: {originalRequest}
- Actions Taken: {actionsSummary}
- Information Gathered: {informationSummary}

Your Task:
1. Determine if the user's original intent has been fulfilled
2. If not fulfilled, decide what information/action is needed next
3. Choose one of these actions:
   - CONTINUE: Take another action in this flow (call MCP, process data, etc.)
   - WAIT_FOR_AGENT: Need information from another agent (specify which agent and what to ask)
   - WAIT_FOR_MCP: Need to call an MCP tool and wait for async result
   - COMPLETE: User's intent is fulfilled, ready to send final response
   - FAIL: Cannot fulfill user's intent (explain why)

Respond in this JSON format:
{
  "action": "CONTINUE" | "WAIT_FOR_AGENT" | "WAIT_FOR_MCP" | "COMPLETE" | "FAIL",
  "reasoning": "detailed explanation of why",
  "confidence": 0.0 to 1.0,
  "next_steps": ["step1", "step2"],
  "target_agent": { // if action = WAIT_FOR_AGENT
    "agent_id": "agent-id",
    "question": "what to ask",
    "message_subject": "subject line",
    "message_body": "full email body"
  },
  "final_response": "response to user" // if action = COMPLETE
}`;
```

### 3.3 Message Router

**File:** `server/utils/messageRouter.ts`

```typescript
export class MessageRouter {
  
  /**
   * Route an incoming email to the appropriate handler
   * - If it's a new request: start new flow (or handle single-round)
   * - If it's a response to one of this agent's flows: resume that flow
   * - IMPORTANT: Each agent only sees its own flows
   */
  async routeInboundEmail(email: InboundEmail, agentId: string): Promise<void>
  
  /**
   * Send an email from one agent to another
   * IMPORTANT: This includes a request ID for tracking responses
   */
  async sendAgentToAgentEmail(params: {
    fromAgentId: string
    toAgentId: string
    subject: string
    body: string
    flowId: string              // The SENDER's flow ID (for internal tracking)
    requestId: string           // Request ID to include in email (for response matching)
    metadata?: Record<string, unknown>
  }): Promise<string>  // Returns message ID
  
  /**
   * Send email from agent to external user
   */
  async sendAgentToUserEmail(params: {
    fromAgentId: string
    toEmail: string
    subject: string
    body: string
    flowId?: string
  }): Promise<string>
  
  /**
   * Check if incoming email is a response to THIS AGENT's active flow
   * IMPORTANT: Only checks flows belonging to the receiving agent
   */
  async matchEmailToFlow(
    email: InboundEmail, 
    agentId: string
  ): Promise<AgentFlow | null>
}
```

**Email Matching Logic:**

When Agent A receives an email from Agent B:
1. Extract request ID from subject line (e.g., `[req-456]` or `Re: ...`) 
2. Check `In-Reply-To` and `References` headers
3. Look for Agent A's flows that are WAITING with matching requestId
4. Check sender matches expected agent
5. Check temporal proximity (within flow timeout window)

**Request ID Format:**
- Include in subject: `[Req: req-abc123] Original Subject`
- Or in custom header: `X-Koompl-Request-Id: req-abc123`
- Agent B includes this in reply for matching

### 3.4 Webhook Manager

**File:** `server/utils/webhookManager.ts`

```typescript
export class WebhookManager {
  
  /**
   * Register a webhook for flow continuation
   */
  async registerWebhook(params: {
    flowId: string
    type: 'agent_response' | 'mcp_callback'
    expectation: WebhookExpectation
    expiresInMinutes: number
  }): Promise<WebhookRegistration>
  
  /**
   * Trigger a webhook (called when expected event occurs)
   */
  async triggerWebhook(webhookId: string, payload: unknown): Promise<void>
  
  /**
   * Clean up expired webhooks
   */
  async cleanupExpiredWebhooks(): Promise<void>
  
  /**
   * Get webhook by flow ID
   */
  async getWebhookByFlowId(flowId: string): Promise<WebhookRegistration | null>
}
```

### 3.5 Timeout Manager

**File:** `server/utils/timeoutManager.ts`

```typescript
export class TimeoutManager {
  
  /**
   * Check all active flows for timeouts
   * Run this periodically (e.g., every 5 minutes)
   */
  async processTimeouts(): Promise<void>
  
  /**
   * Handle a timed-out flow
   */
  async handleTimeout(flowId: string): Promise<void>
  
  /**
   * Extend timeout for a flow (if needed)
   */
  async extendTimeout(flowId: string, additionalMinutes: number): Promise<void>
}
```

**Timeout Handling Strategy:**

1. When flow times out:
   - Send "timeout" notification to original requester
   - Mark flow as `status: 'timeout'`
   - Log timeout event
   - Clean up associated webhooks
   - Option: Notify agent administrator

2. Grace period: 5 minutes after timeout before final cleanup

---

## 4. API Endpoints

### 4.1 Flow Management Endpoints

```typescript
// Start a new flow (typically called from inbound email handler)
POST /api/agent-flows
Body: {
  agentId: string
  trigger: EmailTrigger
  maxRounds?: number
  timeoutMinutes?: number
}
Response: { flowId: string }

// Get flow details
GET /api/agent-flows/{flowId}
Response: AgentFlow

// Resume a flow (typically called from webhook)
POST /api/agent-flows/{flowId}/resume
Body: {
  input: ResumeInput
}
Response: { ok: boolean }

// Manually complete a flow
POST /api/agent-flows/{flowId}/complete
Body: {
  finalResponse: string
}
Response: { ok: boolean }

// Manually fail a flow
POST /api/agent-flows/{flowId}/fail
Body: {
  reason: string
}
Response: { ok: boolean }

// List flows for an agent
GET /api/agent-flows?agentId={agentId}&status={status}
Response: AgentFlow[]
```

### 4.2 Webhook Endpoints

```typescript
// Generic webhook receiver for agent flows
POST /api/webhooks/agent-flows/{webhookId}
Body: {
  type: string
  payload: unknown
}
Response: { ok: boolean }

// Email-based webhook (alternative to Mailgun inbound)
POST /api/webhooks/agent-flows/email/{webhookId}
Body: EmailPayload
Response: { ok: boolean }
```

### 4.3 Inter-Agent Communication Endpoint

```typescript
// Send message from one agent to another
POST /api/agents/{fromAgentId}/send-message
Body: {
  toAgentId: string
  subject: string
  body: string
  flowId?: string
  urgent?: boolean
}
Response: {
  ok: boolean
  messageId: string
}
```

---

## 5. MCP Email Tool Integration

### 5.1 MCP Server for Email Sending

Create a custom MCP server that exposes email-sending capabilities:

**MCP Server Package:** `@koompl/mcp-server-email`

**Tools Exposed:**
- `send_email` - Send an email
- `search_agents` - Find agents by name/email/role
- `get_agent_info` - Get details about an agent

**Implementation:**

```typescript
// server/utils/mcpEmailServer.ts

export const emailMcpTools = {
  send_email: {
    description: "Send an email to a user or another agent",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body" },
        cc: { type: "array", items: { type: "string" }, description: "CC recipients" },
        urgent: { type: "boolean", description: "Mark as urgent" }
      },
      required: ["to", "subject", "body"]
    }
  },
  
  search_agents: {
    description: "Search for agents by name, email, or role",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        role: { type: "string", description: "Filter by role" }
      },
      required: ["query"]
    }
  },
  
  get_agent_info: {
    description: "Get detailed information about an agent",
    input_schema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Agent ID or email" }
      },
      required: ["agentId"]
    }
  }
}

export async function handleEmailMcpTool(
  toolName: string,
  args: unknown,
  context: { agentId: string, flowId?: string }
): Promise<unknown> {
  switch (toolName) {
    case 'send_email':
      return await executeSendEmail(args, context)
    case 'search_agents':
      return await executeSearchAgents(args)
    case 'get_agent_info':
      return await executeGetAgentInfo(args)
    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}
```

### 5.2 Registering Email MCP with Agents

Add the email MCP server to agent configuration:

```typescript
const EMAIL_MCP_SERVER: StoredMcpServer = {
  id: 'internal-email-mcp',
  name: 'Koompl Email Server',
  provider: 'custom',
  category: 'custom',
  description: 'Send emails and communicate with other agents',
  url: 'internal://email',  // Internal server, not HTTP
  auth: { type: 'bearer' },
  lastStatus: 'ok',
  lastCheckedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}
```

When agents with `multiRoundConfig.canCommunicateWithAgents = true` are initialized, automatically add this MCP server to their `mcpServerIds`.

---

## 6. Modified Inbound Email Handler

Update `/api/mailgun/inbound.post.ts` to support multi-round flows:

**Key Principle:** Each agent handles incoming emails independently and only accesses its own flows.

```typescript
export default defineEventHandler(async (event) => {
  try {
    // 1. Parse incoming email
    const email = await parseInboundEmail(event)
    
    // 2. Determine target agent (recipient)
    const agent = await resolveAgentFromEmail(email.to)
    
    if (!agent) {
      return { ok: true, error: 'Agent not found' }
    }
    
    // 3. Check if this is a response to THIS AGENT's existing flow
    const messageRouter = new MessageRouter()
    const existingFlow = await messageRouter.matchEmailToFlow(email, agent.id)
    
    if (existingFlow) {
      // This is a response to one of this agent's flows - resume it
      // Example: Agent A receives response from Agent B
      const flowEngine = new AgentFlowEngine()
      await flowEngine.resumeFlow(existingFlow.id, {
        type: 'email_response',
        email
      })
      return { ok: true, flowId: existingFlow.id, resumed: true }
    }
    
    // 4. This is a NEW request for this agent
    // Could be from:
    // - External user asking a question
    // - Another agent (e.g., Agent A) asking for information
    
    // Check if agent has multi-round enabled
    if (agent.multiRoundConfig?.enabled) {
      // Start a new multi-round flow FOR THIS AGENT
      const flowEngine = new AgentFlowEngine()
      const flow = await flowEngine.startFlow({
        agentId: agent.id,
        trigger: {
          type: 'email',
          messageId: email.messageId,
          from: email.from,
          to: email.to,
          subject: email.subject,
          body: email.body,
          receivedAt: email.receivedAt
        },
        maxRounds: agent.multiRoundConfig.maxRounds,
        timeoutMinutes: agent.multiRoundConfig.timeoutMinutes
      })
      
      // Execute first round
      await flowEngine.executeRound(flow.id)
      
      return { ok: true, flowId: flow.id, newFlow: true }
    } else {
      // Fall back to legacy single-round processing
      // Agent B (Product Specialist) typically uses this path
      return await handleLegacySingleRound(email, agent)
    }
    
  } catch (error) {
    console.error('Inbound email error:', error)
    return { ok: true }  // Always return ok to Mailgun
  }
})
```

**Flow Independence Example:**

```
Scenario: User asks Agent A about pricing

1. User → Agent A
   - Agent A creates Flow-A-123
   - Status: ACTIVE

2. Agent A decides to ask Agent B
   - Agent A sends email: "[Req: req-789] Pricing question"
   - Agent A updates Flow-A-123: status=WAITING, requestId=req-789
   
3. Agent B receives email from Agent A
   - Agent B sees this as NEW REQUEST (not related to any Agent B flow)
   - Agent B processes in single-round (no flow needed)
   - OR Agent B creates Flow-B-456 if it needs multi-round
   
4. Agent B responds to Agent A
   - Subject includes: "[Req: req-789]" or "Re: [Req: req-789]"
   - Agent B completes its processing
   
5. Agent A receives email from Agent B
   - Agent A matches req-789 to Flow-A-123
   - Agent A resumes Flow-A-123
   - Status: ACTIVE again
   
6. Agent A completes and responds to user
   - Flow-A-123: status=COMPLETED

Result:
- Agent A had 1 flow (Flow-A-123) with 2 rounds
- Agent B had 0 flows (single-round response)
- Total isolation between agents' flow states
```

---

## 7. Test Agent Definitions

### 7.1 Agent A - Information Coordinator

**Name:** Agent A - Customer Support Coordinator

**Email:** `agent-a@koompl.local`

**Role:** Customer Support Coordinator

**System Prompt:**
```
You are Agent A, a customer support coordinator for Koompl. Your role is to help customers by gathering information from specialized agents.

CAPABILITIES:
- You can send emails to other agents to request information
- You have access to the following agents via email:
  * agent-b@koompl.local - Product Specialist (knows about product features, pricing, availability)
  * agent-c@koompl.local - Technical Support (knows about technical issues, integrations)

BEHAVIOR:
1. When you receive a customer request, analyze what information you need
2. If you need information you don't have, email the appropriate specialist agent
3. Wait for their response before replying to the customer
4. Combine information from multiple agents if needed
5. Always provide a complete, helpful answer to the customer

DECISION FRAMEWORK:
- If customer asks about products/pricing → contact agent-b@koompl.local
- If customer asks about technical issues → contact agent-c@koompl.local
- If you have all needed information → respond directly to customer
- If request is unclear → ask customer for clarification

RESPONSE FORMAT:
When you need information from another agent, use this format:
{
  "decision": "WAIT_FOR_AGENT",
  "reasoning": "I need product pricing information which Agent B can provide",
  "target_agent": {
    "agent_id": "agent-b",
    "question": "What is the pricing for the Enterprise plan?",
    "message_subject": "Customer inquiry about Enterprise pricing",
    "message_body": "Hi Agent B,\n\nI have a customer asking about Enterprise plan pricing. Could you provide:\n1. Monthly cost\n2. Annual cost\n3. Any current discounts\n\nThanks!"
  }
}

When ready to respond to customer:
{
  "decision": "COMPLETE",
  "reasoning": "I have all the information needed to answer the customer's question",
  "final_response": "Dear customer,\n\n[your complete response here]\n\nBest regards,\nAgent A"
}
```

**Multi-Round Config:**
```json
{
  "enabled": true,
  "maxRounds": 10,
  "timeoutMinutes": 60,
  "canCommunicateWithAgents": true,
  "allowedAgentIds": ["agent-b", "agent-c"],
  "autoResumeOnResponse": true
}
```

### 7.2 Agent B - Product Specialist

**Name:** Agent B - Product Specialist

**Email:** `agent-b@koompl.local`

**Role:** Product Specialist

**System Prompt:**
```
You are Agent B, a product specialist for Koompl. You know everything about our products, features, pricing, and availability.

KNOWLEDGE BASE:
Products:
- Starter Plan: $29/month or $290/year (save $58) - Up to 5 agents, 1000 emails/month
- Professional Plan: $99/month or $990/year (save $198) - Up to 20 agents, 10000 emails/month, Priority support
- Enterprise Plan: $299/month or $2990/year (save $598) - Unlimited agents, Unlimited emails, Dedicated support, Custom integrations

Features:
- AI-powered email responses
- Multi-agent workflows
- MCP server integrations
- Custom domain support
- Advanced analytics
- API access (Professional and above)

Current Promotions:
- 20% off first 3 months for new customers
- Free migration assistance
- 14-day free trial for all plans

BEHAVIOR:
1. Respond quickly and accurately to agent requests for product information
2. Always include relevant details (pricing, features, limitations)
3. Mention current promotions when relevant
4. Format responses clearly with bullet points
5. Keep responses concise and professional

RESPONSE FORMAT:
When another agent asks you for information, respond with complete, structured information:

"Hi [Agent Name],

Here's the information you requested:

[Structured information with bullet points]

Additional notes:
- [Relevant promotions or caveats]

Let me know if you need anything else!

Best regards,
Agent B - Product Specialist"
```

**Multi-Round Config:**
```json
{
  "enabled": true,
  "maxRounds": 3,
  "timeoutMinutes": 15,
  "canCommunicateWithAgents": false,
  "autoResumeOnResponse": false
}
```

### 7.3 Test Scenario

**Scenario:** Customer asks Agent A about Enterprise plan

**Flow:**

```
Step 1: Customer → Email → agent-a@koompl.local
  Subject: "Question about Enterprise plan"
  Body: "Hi, I'm interested in the Enterprise plan. What's included and how much does it cost?"

Step 2: Agent A analyzes request
  - Decision: Need product info from Agent B
  - Creates Flow: flow-A-12345 (Agent A's flow)
  - Status: ACTIVE

Step 3: Agent A → Email → agent-b@koompl.local
  Subject: "[Req: req-789] Customer inquiry about Enterprise pricing"
  Body: "Hi Agent B, I have a customer asking about Enterprise plan pricing and features..."
  - Agent A updates flow-A-12345: status=WAITING, requestId=req-789
  - Agent A is waiting for response with req-789

Step 4: Agent B receives email (from Agent A)
  - Agent B treats this as NEW REQUEST (like any other email)
  - Agent B processes in single-round (no flow created)
  - Agent B generates response immediately

Step 5: Agent B → Email → agent-a@koompl.local
  Subject: "Re: [Req: req-789] Customer inquiry about Enterprise pricing"
  Body: "Hi Agent A, Here's the information...
         - Price: $299/month or $2990/year
         - Features: Unlimited agents, Unlimited emails, ..."

Step 6: Agent A receives email from Agent B
  - Inbound handler matches req-789 to flow-A-12345
  - Agent A resumes flow-A-12345
  - Status: ACTIVE (no longer waiting)
  - Agent A processes Agent B's response

Step 7: Agent A analyzes
  - Decision: Have all info, can respond to customer
  - Prepares final response

Step 8: Agent A → Email → Customer
  Subject: "Re: Question about Enterprise plan"
  Body: "Hi, Thanks for your interest! Based on your inquiry, here's what our Enterprise plan offers:
         [Combined response with info from Agent B, enriched by Agent A]..."
  - flow-A-12345: status=COMPLETED

Result: 
- Customer receives comprehensive, accurate response
- Agent A had 1 flow (flow-A-12345) with 2 rounds
- Agent B had 0 flows (single-round processing)
- Complete isolation between agents
Total time: ~30 seconds to 2 minutes (depending on Agent B response time)
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Implement storage schemas (AgentFlow, WebhookRegistration, etc.)
- [ ] Create `AgentFlowEngine` class with basic flow management
- [ ] Create `DecisionEngine` with AI-based decision making
- [ ] Update `Agent` type with `multiRoundConfig`
- [ ] Create flow state management utilities

### Phase 2: Core Flow Logic (Week 3-4)
- [ ] Implement round execution logic in `AgentFlowEngine`
- [ ] Implement decision prompts and parsing in `DecisionEngine`
- [ ] Create `MessageRouter` for email routing and matching
- [ ] Update inbound email handler to support flows
- [ ] Create flow resume logic

### Phase 3: Inter-Agent Communication (Week 5-6)
- [ ] Implement MCP email server (`@koompl/mcp-server-email`)
- [ ] Create agent-to-agent messaging API
- [ ] Implement email matching to existing flows
- [ ] Create `WebhookManager` for async operations
- [ ] Test basic inter-agent communication

### Phase 4: Webhook & Timeout Management (Week 7-8)
- [ ] Implement webhook registration and triggering
- [ ] Create webhook API endpoints
- [ ] Implement `TimeoutManager` with periodic checks
- [ ] Add timeout handling and notifications
- [ ] Create cleanup jobs for expired webhooks/flows

### Phase 5: Testing & UI (Week 9-10)
- [ ] Create test agents (Agent A, Agent B, Agent C)
- [ ] Implement comprehensive test scenarios
- [ ] Build UI for flow visualization (timeline view)
- [ ] Add flow monitoring dashboard
- [ ] Create admin controls for flow management

### Phase 6: Polish & Production (Week 11-12)
- [ ] Performance optimization
- [ ] Add comprehensive error handling
- [ ] Create documentation and API guides
- [ ] Security audit (agent authorization, etc.)
- [ ] Load testing with multiple concurrent flows
- [ ] Production deployment

---

## 9. Key Technical Considerations

### 9.1 Performance

**Storage Optimization:**
- Index flows by `agentId` and `status` for fast queries
- Archive completed flows after 30 days
- Limit round history to prevent bloat (keep last 50 rounds max)

**Concurrency:**
- Use locks/transactions when updating flow state
- Implement queue system for high-volume scenarios
- Consider Redis for active flow state (faster than file system)

### 9.2 Security

**Agent Authorization:**
- Verify agent has permission to communicate with target agent
- Check `allowedAgentIds` whitelist before sending messages
- Rate limiting on agent-to-agent messages

**Email Verification:**
- Verify sender matches expected agent email
- Check DKIM/SPF for external emails
- Prevent email spoofing attacks

### 9.3 Reliability

**Idempotency:**
- Use unique message IDs to prevent duplicate processing
- Implement idempotency keys for webhook callbacks
- Handle duplicate email deliveries gracefully

**Error Recovery:**
- Retry failed MCP/AI calls with exponential backoff
- Implement dead letter queue for failed messages
- Automatic rollback on partial failures

**Monitoring:**
- Track flow success/failure rates
- Monitor average flow duration
- Alert on high timeout rates
- Log all decision points for debugging

### 9.4 Scalability

**Horizontal Scaling:**
- Design for stateless API handlers
- Use distributed locks (Redis) for flow state updates
- Message queue for async processing (BullMQ, Kafka)

**Flow Limits:**
- Max 100 concurrent flows per agent
- Max 50 rounds per flow
- Max 10 pending agent requests per flow

---

## 10. Example Prompts for Different Scenarios

### 10.1 Simple Information Request

**Customer:** "What's your pricing?"

**Agent A Decision:**
```json
{
  "decision": "WAIT_FOR_AGENT",
  "reasoning": "Customer asking about pricing. Agent B is the product specialist who has this information.",
  "confidence": 0.95,
  "target_agent": {
    "agent_id": "agent-b",
    "question": "Provide pricing for all plans",
    "message_subject": "Pricing information request",
    "message_body": "Hi Agent B,\n\nCan you provide complete pricing information for all our plans?\n\nThanks!"
  }
}
```

### 10.2 Complex Multi-Agent Request

**Customer:** "I need help setting up SSO integration and also want to know about Enterprise pricing."

**Agent A Round 1 Decision:**
```json
{
  "decision": "WAIT_FOR_AGENT",
  "reasoning": "Customer has two requests: technical (SSO) and sales (pricing). I'll start by asking Agent C about SSO since that's likely the more complex item.",
  "confidence": 0.90,
  "target_agent": {
    "agent_id": "agent-c",
    "question": "Provide SSO setup instructions",
    "message_subject": "SSO integration help needed",
    "message_body": "Hi Agent C,\n\nCustomer wants to set up SSO integration. Can you provide setup instructions and requirements?\n\nThanks!"
  }
}
```

**Agent A Round 2 Decision (after receiving Agent C's response):**
```json
{
  "decision": "WAIT_FOR_AGENT",
  "reasoning": "I have SSO information from Agent C. Now I need Enterprise pricing from Agent B to complete the response.",
  "confidence": 0.95,
  "target_agent": {
    "agent_id": "agent-b",
    "question": "Enterprise plan pricing",
    "message_subject": "Enterprise pricing request",
    "message_body": "Hi Agent B,\n\nCustomer also asking about Enterprise plan pricing. Can you provide?\n\nThanks!"
  }
}
```

**Agent A Round 3 Decision (after receiving Agent B's response):**
```json
{
  "decision": "COMPLETE",
  "reasoning": "I now have both SSO instructions from Agent C and Enterprise pricing from Agent B. I can provide a complete response to the customer.",
  "confidence": 1.0,
  "final_response": "Hi,\n\nThanks for your inquiry! I've gathered the information you need:\n\n**SSO Integration Setup:**\n[Information from Agent C]\n\n**Enterprise Plan Pricing:**\n[Information from Agent B]\n\nLet me know if you have any other questions!\n\nBest regards,\nAgent A"
}
```

### 10.3 Unfulfillable Request

**Customer:** "Can you send me your source code?"

**Agent A Decision:**
```json
{
  "decision": "FAIL",
  "reasoning": "Customer is requesting source code, which we cannot provide. This is proprietary information and not something any of our agents can fulfill.",
  "confidence": 1.0,
  "final_response": "Hi,\n\nI understand you're interested in our technology, but I'm unable to provide our source code as it's proprietary. However, I'd be happy to discuss:\n- Our public API documentation\n- Integration guides\n- Technical specifications\n\nWould any of these be helpful?\n\nBest regards,\nAgent A"
}
```

---

## 11. Monitoring & Observability

### 11.1 Flow Metrics

**Dashboard Widgets:**

1. **Active Flows**
   - Total active flows
   - Flows by status (active, waiting, completed, failed, timeout)
   - Average flow duration
   - Current flow wait times

2. **Agent Performance**
   - Flows per agent
   - Average response time per agent
   - Success rate per agent
   - Inter-agent communication patterns

3. **Round Statistics**
   - Average rounds per flow
   - Distribution of round counts
   - Most common decision types
   - AI confidence scores distribution

4. **Timeout & Failures**
   - Timeout rate
   - Failure rate by reason
   - Average time to timeout
   - Most common failure points

### 11.2 Logging

**Log Levels:**

```typescript
// INFO: Normal flow events
logger.info('Flow started', { flowId, agentId, trigger })
logger.info('Round completed', { flowId, roundNumber, decision })
logger.info('Flow completed', { flowId, duration, rounds })

// WARN: Non-critical issues
logger.warn('Low confidence decision', { flowId, confidence, decision })
logger.warn('Flow approaching timeout', { flowId, timeRemaining })

// ERROR: Critical issues
logger.error('Flow failed', { flowId, error, round })
logger.error('Agent communication failed', { fromAgent, toAgent, error })
```

### 11.3 Alerts

**Alert Conditions:**

1. Flow timeout rate > 10%
2. Average flow duration > 5 minutes
3. Agent not responding (> 2 minutes with no activity)
4. Webhook expiration rate > 5%
5. Decision confidence consistently < 0.7

---

## 12. Future Enhancements

### 12.1 Advanced Features

1. **Parallel Agent Queries**
   - Query multiple agents simultaneously
   - Aggregate responses before proceeding

2. **Conditional Branching**
   - Different flow paths based on conditions
   - Support for if/else decision trees

3. **Human-in-the-Loop**
   - Escalate to human operator if confidence low
   - Manual approval for certain decisions

4. **Learning & Optimization**
   - Track which decision patterns lead to success
   - Optimize agent prompts based on outcomes
   - A/B testing for different decision strategies

5. **Flow Templates**
   - Pre-defined flow patterns for common scenarios
   - Reusable sub-flows
   - Flow composition and inheritance

### 12.2 Integration Enhancements

1. **Additional Communication Channels**
   - Slack integration
   - Microsoft Teams integration
   - SMS/WhatsApp support

2. **Advanced MCP Tools**
   - Calendar booking MCP tool
   - CRM integration MCP tool
   - Payment processing MCP tool

3. **External Agent Communication**
   - Allow communication with external AI agents
   - OAuth-based agent authentication
   - API-based agent communication

---

## 13. Testing Strategy

### 13.1 Unit Tests

**Components to Test:**

1. `AgentFlowEngine`
   - Flow creation
   - Round execution
   - State transitions
   - Flow completion/failure

2. `DecisionEngine`
   - Decision parsing
   - Intent fulfillment detection
   - Confidence scoring

3. `MessageRouter`
   - Email routing
   - Flow matching
   - Agent-to-agent messaging

4. `WebhookManager`
   - Webhook registration
   - Webhook triggering
   - Expiration handling

5. `TimeoutManager`
   - Timeout detection
   - Timeout handling
   - Grace period logic

### 13.2 Integration Tests

**Test Scenarios:**

1. **Simple Flow**
   - Customer → Agent A → Agent B → Customer
   - Verify correct message routing
   - Verify flow state transitions

2. **Multi-Round Flow**
   - Customer → Agent A → Agent B → Agent A → Agent C → Customer
   - Verify multiple rounds work correctly
   - Verify state persistence between rounds

3. **Timeout Handling**
   - Agent B doesn't respond
   - Verify timeout detection
   - Verify timeout notification sent

4. **Webhook Handling**
   - External webhook callback
   - Verify flow resume
   - Verify payload processing

5. **Concurrent Flows**
   - Multiple flows running simultaneously
   - Verify no state corruption
   - Verify correct message routing

### 13.3 Load Tests

**Test Parameters:**

- 100 concurrent flows
- 10 requests/second
- 50% agent-to-agent messages
- Measure: response time, success rate, resource usage

### 13.4 End-to-End Tests

**Full Scenario Tests:**

1. Create test agents (A, B, C)
2. Send test email to Agent A
3. Verify Agent A contacts Agent B
4. Verify Agent B responds
5. Verify Agent A sends final response to customer
6. Verify all logs are correct
7. Verify flow state is cleaned up

---

## 14. Documentation Requirements

### 14.1 Developer Documentation

1. **Architecture Overview**
   - System architecture diagram
   - Component interaction diagram
   - Data flow diagrams

2. **API Reference**
   - All endpoints documented
   - Request/response examples
   - Error codes and handling

3. **Agent Configuration Guide**
   - How to create multi-round agents
   - System prompt best practices
   - MCP server configuration

4. **Flow Development Guide**
   - How flows work
   - Decision-making strategies
   - Testing flows locally

### 14.2 User Documentation

1. **Multi-Round Agent Setup**
   - Enable multi-round processing
   - Configure timeouts
   - Set up inter-agent communication

2. **Monitoring Guide**
   - How to view active flows
   - How to interpret flow metrics
   - How to debug failed flows

3. **Troubleshooting Guide**
   - Common issues and solutions
   - How to handle timeouts
   - How to retry failed flows

---

## 15. Success Metrics

### 15.1 Technical Metrics

- **Flow Success Rate:** > 95%
- **Average Flow Duration:** < 2 minutes
- **Timeout Rate:** < 5%
- **Average Rounds per Flow:** 2-4
- **Decision Confidence:** > 0.85 average

### 15.2 Business Metrics

- **Customer Satisfaction:** Improved response quality
- **Response Time:** Faster than single-round agents for complex queries
- **Agent Efficiency:** Fewer manual interventions needed
- **Scalability:** Support 10x more concurrent requests

---

## Conclusion

This implementation plan provides a comprehensive roadmap for building a sophisticated multi-round agent system with inter-agent communication, persistent flows, webhook support, and timeout management. The system is designed to be scalable, reliable, and easy to monitor, while providing a flexible foundation for future enhancements.

The key innovation is the **Agent Flow Engine** that manages state across multiple rounds, combined with the **Decision Engine** that uses AI to intelligently determine next actions. The **Message Router** enables seamless inter-agent communication, while **Webhook and Timeout Managers** ensure reliability even for long-running asynchronous operations.

By implementing this system, Koompl will enable agents to handle complex, multi-step tasks that require coordination between multiple specialized agents, significantly improving the platform's capabilities and user experience.

