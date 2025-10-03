/**
 * Type definitions for Multi-Round Agent Flow System
 *
 * These types support persistent, multi-round agent interactions with
 * inter-agent communication, webhook callbacks, and timeout management.
 */

export type FlowStatus =
  | 'active' // Currently processing
  | 'waiting' // Waiting for external input (agent, webhook, etc.)
  | 'completed' // Successfully completed
  | 'failed' // Failed to complete
  | 'timeout' // Exceeded timeout deadline

export type FlowTriggerType = 'email' | 'webhook' | 'manual'

export type FlowActionType = 'send_email' | 'call_mcp' | 'call_ai' | 'wait' | 'decide'

export type FlowDecisionType =
  | 'continue' // Continue with another action in this flow
  | 'wait_for_agent' // Need information from another agent
  | 'wait_for_mcp' // Need to call an MCP tool and wait
  | 'complete' // User's intent is fulfilled
  | 'fail' // Cannot fulfill user's intent

export interface EmailTrigger {
  type: 'email'
  messageId: string
  from: string
  to: string
  subject: string
  body: string
  receivedAt: string
}

export interface FlowRequester {
  email: string
  name?: string
}

export interface FlowWaitState {
  type: 'agent_response' | 'mcp_callback' | 'webhook' | 'timeout'
  agentId?: string // If waiting for another agent
  webhookId?: string // If waiting for a webhook
  expectedBy?: string // Timeout deadline (ISO timestamp)
  requestId?: string // Identifier used in subject lines (legacy support)
  messageId?: string // Message ID we expect a reply to
  threadMessageIds?: string[] // Additional message/thread identifiers
  metadata?: Record<string, unknown>
}

export interface FlowDecision {
  type: FlowDecisionType
  reasoning: string // Why this decision was made
  confidence: number // 0-1 confidence in decision
  nextSteps?: string[] // Human-readable next steps

  // If type = 'wait_for_agent'
  targetAgent?: {
    agentId?: string // Legacy: agent ID
    agentEmail?: string // Preferred: agent email address
    messageSubject: string
    messageBody: string
    question: string // What we're asking
  }

  // If type = 'wait_for_mcp'
  mcpCall?: {
    serverId: string
    method: string
    params: unknown
  }

  // If type = 'complete'
  finalResponse?: string
}

export interface FlowAction {
  id: string
  type: FlowActionType
  timestamp: string
  status: 'pending' | 'completed' | 'failed'
  input?: unknown
  output?: unknown
  error?: string
}

export interface FlowAiCall {
  id: string
  provider: string
  model: string
  prompt: string
  response: string
  tokensUsed?: number
  timestamp: string
}

export interface FlowMcpCall {
  id: string
  serverId: string
  serverName: string
  input: unknown
  output: unknown
  timestamp: string
}

export interface FlowMessage {
  id: string
  direction: 'sent' | 'received'
  to?: string
  from?: string
  subject?: string
  body: string
  timestamp: string
  messageId?: string
  inReplyTo?: string[]
  references?: string[]
}

export interface FlowRound {
  roundNumber: number
  startedAt: string
  completedAt?: string

  // Decision made in this round
  decision: FlowDecision

  // Actions taken
  actions: FlowAction[]

  // AI/MCP usage in this round
  aiCalls: FlowAiCall[]
  mcpCalls: FlowMcpCall[]

  // Messages sent/received
  messages: FlowMessage[]
}

export interface AgentFlow {
  id: string // Unique flow ID
  agentId: string // Primary agent handling this flow
  status: FlowStatus

  // Original request
  trigger: EmailTrigger

  // User/requester information
  requester: FlowRequester

  // Flow execution history
  rounds: FlowRound[]

  // Current state
  currentRound: number
  maxRounds: number // Limit to prevent infinite loops

  // Wait state (for async operations)
  waitingFor?: FlowWaitState

  // Context for MCP servers (Kanban, Calendar, etc.)
  teamId?: string // Team context for MCP tools
  userId?: string // User ID of the requester (for calendar, kanban, etc.)

  // Timing
  createdAt: string
  updatedAt: string
  completedAt?: string
  timeoutAt: string // Auto-fail if not completed by this time

  // Metadata
  metadata: {
    totalAiCalls: number
    totalMcpCalls: number
    totalAgentMessages: number
    tags?: string[]
  }
}

export interface QueuedMessage {
  id: string
  flowId: string // Associated flow
  type: 'agent_request' | 'agent_response' | 'webhook_callback'

  from: string // Sender email/agent ID
  to: string // Recipient email/agent ID
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

export interface WebhookExpectation {
  type: 'email' | 'http_post'
  fromEmail?: string // If type='email', expect from this address
  toEmail?: string // If type='email', expect to this address
  url?: string // If type='http_post', POST to this URL
}

export interface WebhookRegistration {
  id: string
  flowId: string
  type: 'agent_response' | 'mcp_callback' | 'custom'

  // What we're waiting for
  expectation: WebhookExpectation

  status: 'active' | 'triggered' | 'expired'
  triggeredAt?: string
  expiresAt: string // Webhook expires after this time

  createdAt: string
}

export interface RoundResult {
  decision: FlowDecisionType
  reasoning: string
  confidence: number
  nextAction?: {
    type: FlowActionType
    params: unknown
  }
}

export interface ResumeInput {
  type: 'email_response' | 'webhook_callback' | 'manual'
  email?: {
    messageId: string
    from: string
    subject: string
    body: string
    inReplyTo?: string[]
    references?: string[]
  }
  webhookPayload?: unknown
  manualInput?: string
}

export interface DecisionContext {
  flow: AgentFlow
  agent: {
    id: string
    name: string
    email: string
    prompt?: string
    teamId?: string
    mcpServerIds?: string[]
  }
  recentMessages?: FlowMessage[]
  availableAgents?: Array<{
    id: string
    name: string
    email: string
    role: string
  }>
  availableMcpServers?: Array<{
    id: string
    name: string
    provider: string
    capabilities: string[]
  }>
}

export interface FulfillmentCheck {
  isFulfilled: boolean
  confidence: number
  reasoning: string
  missingInformation?: string[]
  suggestedNextSteps?: string[]
}

// Agent configuration for multi-round flows
export interface MultiRoundConfig {
  enabled: boolean // Enable multi-round processing
  maxRounds: number // Max rounds per flow (default: 10)
  timeoutMinutes: number // Flow timeout in minutes (default: 60)
  canCommunicateWithAgents: boolean // Can this agent message other agents?
  allowedAgentEmails?: string[] // Whitelist of agent emails this agent can message
  autoResumeOnResponse: boolean // Automatically resume flow when response received
}

// Extended Agent type (to be merged with existing Agent type)
export interface AgentWithFlowSupport {
  id: string
  name: string
  email: string
  role: string
  prompt: string
  avatar?: unknown
  mcpServerIds?: string[]

  // Multi-round configuration
  multiRoundConfig?: MultiRoundConfig
}

// Flow statistics for monitoring
export interface FlowStatistics {
  totalFlows: number
  activeFlows: number
  completedFlows: number
  failedFlows: number
  timedOutFlows: number

  averageRoundsPerFlow: number
  averageDurationSeconds: number
  averageConfidence: number

  byAgent: Record<
    string,
    {
      totalFlows: number
      successRate: number
      averageDuration: number
    }
  >
}
