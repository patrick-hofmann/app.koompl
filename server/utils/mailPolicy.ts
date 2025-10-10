import type { Agent, MailPolicyConfig, MailPolicyRule } from '~/types'
import { getIdentity, type IdentityData } from '../features/team/storage'

interface NormalizedMailPolicy {
  inbound: MailPolicyRule
  outbound: MailPolicyRule
  allowedInbound: Set<string>
  allowedOutbound: Set<string>
}

interface PolicyContext {
  agentUsernames: Set<string>
  teamMemberEmails: Set<string>
  teamId?: string
  identity: IdentityData
}

interface MailPolicyEvaluationOptions {
  agents?: Agent[]
  identity?: IdentityData
}

interface MailPolicyEvaluationResult {
  allowed: boolean
  reason?: string
}

const DEFAULT_RULE: MailPolicyRule = 'team_and_agents'

const VALID_RULES: MailPolicyRule[] = ['team_and_agents', 'team_only', 'agents_only', 'any']

function normalizeRule(rule?: MailPolicyRule | null): MailPolicyRule {
  if (rule && VALID_RULES.includes(rule)) {
    return rule
  }
  return DEFAULT_RULE
}

function toAddressSet(list: string[] | undefined): Set<string> {
  if (!Array.isArray(list)) {
    return new Set<string>()
  }
  return new Set(list.map((value) => value.toLowerCase().trim()).filter(Boolean))
}

export function normalizeMailPolicy(agent: Agent): NormalizedMailPolicy {
  const config: MailPolicyConfig | undefined = agent.multiRoundConfig?.mailPolicy
  return {
    inbound: normalizeRule(config?.inbound),
    outbound: normalizeRule(config?.outbound),
    allowedInbound: toAddressSet(config?.allowedInboundAddresses),
    allowedOutbound: toAddressSet(config?.allowedOutboundAddresses)
  }
}

async function loadAgents(overrides?: MailPolicyEvaluationOptions): Promise<Agent[]> {
  if (overrides?.agents) {
    return overrides.agents
  }
  const storage = useStorage('agents')
  return (await storage.getItem<Agent[]>('agents.json')) || []
}

async function loadIdentity(overrides?: MailPolicyEvaluationOptions): Promise<IdentityData> {
  if (overrides?.identity) {
    return overrides.identity
  }
  return await getIdentity()
}

async function buildPolicyContext(
  agent: Agent,
  overrides?: MailPolicyEvaluationOptions
): Promise<PolicyContext> {
  const [agents, identity] = await Promise.all([loadAgents(overrides), loadIdentity(overrides)])

  const agentUsernames = new Set(
    agents
      .map((candidate) => candidate?.email?.toLowerCase().trim())
      .filter((value): value is string => Boolean(value))
  )

  const teamMemberEmails = new Set<string>()
  if (agent.teamId) {
    const memberIds = identity.memberships
      .filter((membership) => membership.teamId === agent.teamId)
      .map((membership) => membership.userId)

    identity.users.forEach((user) => {
      if (memberIds.includes(user.id)) {
        teamMemberEmails.add(user.email.toLowerCase().trim())
      }
    })
  }

  return {
    agentUsernames,
    teamMemberEmails,
    teamId: agent.teamId,
    identity
  }
}

function evaluateRule(
  rule: MailPolicyRule,
  email: string,
  policy: NormalizedMailPolicy,
  context: PolicyContext,
  direction: 'inbound' | 'outbound'
): MailPolicyEvaluationResult {
  const normalizedEmail = email.toLowerCase().trim()
  if (!normalizedEmail) {
    return {
      allowed: false,
      reason: `${direction} blocked: email was empty`
    }
  }

  const username = normalizedEmail.split('@')[0]
  const allowedList = direction === 'inbound' ? policy.allowedInbound : policy.allowedOutbound

  if (allowedList.has(normalizedEmail)) {
    return { allowed: true }
  }

  if (context.agentUsernames.has(username)) {
    return { allowed: true }
  }

  const isTeamMember = context.teamMemberEmails.has(normalizedEmail)

  switch (rule) {
    case 'any':
      return { allowed: true }
    case 'team_and_agents': {
      if (isTeamMember) {
        return { allowed: true }
      }
      return {
        allowed: false,
        reason: `${direction} blocked: ${normalizedEmail} is neither a known agent nor a team member`
      }
    }
    case 'team_only': {
      if (isTeamMember) {
        return { allowed: true }
      }
      return {
        allowed: false,
        reason: `${direction} blocked: ${normalizedEmail} is not a team member`
      }
    }
    case 'agents_only':
      return {
        allowed: false,
        reason: `${direction} blocked: ${normalizedEmail} is not a recognized agent`
      }
    default:
      return {
        allowed: false,
        reason: `${direction} blocked: policy misconfiguration`
      }
  }
}

export async function evaluateInboundMail(
  agent: Agent,
  fromEmail: string,
  overrides?: MailPolicyEvaluationOptions
): Promise<MailPolicyEvaluationResult> {
  const policy = normalizeMailPolicy(agent)
  const context = await buildPolicyContext(agent, overrides)
  return evaluateRule(policy.inbound, fromEmail, policy, context, 'inbound')
}

export async function evaluateOutboundMail(
  agent: Agent,
  toEmail: string,
  overrides?: MailPolicyEvaluationOptions
): Promise<MailPolicyEvaluationResult> {
  const policy = normalizeMailPolicy(agent)
  const context = await buildPolicyContext(agent, overrides)
  return evaluateRule(policy.outbound, toEmail, policy, context, 'outbound')
}

export function formatMailPolicySummary(policy: NormalizedMailPolicy): string {
  const formatRule = (rule: MailPolicyRule, allowed: Set<string>) => {
    const base = `${rule.replace(/_/g, ' ')}`
    if (allowed.size > 0) {
      return `${base} (explicit: ${Array.from(allowed).join(', ') || 'none'})`
    }
    return base
  }

  return `Inbound: ${formatRule(policy.inbound, policy.allowedInbound)}\nOutbound: ${formatRule(policy.outbound, policy.allowedOutbound)}`
}

export type { NormalizedMailPolicy, MailPolicyEvaluationResult }
