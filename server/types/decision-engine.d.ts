import type { AgentFlow, FlowDecision } from './agent-flows'

export interface DecisionContext {
  flow: AgentFlow
  agent: {
    id: string
    name: string
    email: string
    prompt?: string
    teamId?: string
    mcpServerIds?: string[]
    multiRoundConfig?: {
      canCommunicateWithAgents?: boolean
      // legacy support; migration handled at runtime
      allowedAgentIds?: string[]
      // preferred new field
      allowedAgentEmails?: string[]
    }
  }
}

export type DecisionResult = FlowDecision
