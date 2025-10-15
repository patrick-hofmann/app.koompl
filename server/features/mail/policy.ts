/**
 * Mail Policy Feature
 *
 * Stores and retrieves mail policies decoupled from agents. Policies are keyed by
 * `(teamId, agentId)` and optionally `(teamId, agentEmail)` for convenience.
 *
 * Default policy uses "team_and_agents" for both inbound and outbound and empty explicit lists.
 */

import type { Agent, MailPolicyConfig, MailPolicyRule } from '~/types'

const DEFAULT_RULE: MailPolicyRule = 'team_and_agents'

export function getDefaultMailPolicy(): MailPolicyConfig {
  return {
    inbound: DEFAULT_RULE,
    outbound: DEFAULT_RULE,
    allowedInboundAddresses: [],
    allowedOutboundAddresses: []
  }
}

function buildKeys(input: { teamId?: string; agentId?: string; agentEmail?: string }) {
  const storageKeyBase = 'mail/policies'
  const entries: string[] = []
  if (input.teamId && input.agentId)
    entries.push(`${storageKeyBase}/by-agent/${input.teamId}/${input.agentId}.json`)
  if (input.teamId && input.agentEmail)
    entries.push(
      `${storageKeyBase}/by-email/${input.teamId}/${input.agentEmail.toLowerCase()}.json`
    )
  return entries
}

export async function getMailPolicy(params: {
  teamId?: string
  agentId?: string
  agentEmail?: string
}): Promise<MailPolicyConfig> {
  const storage = useStorage('settings')
  const keys = buildKeys(params)

  for (const key of keys) {
    const found = await storage.getItem<MailPolicyConfig>(key)
    if (found) return normalizePolicy(found)
  }

  // No stored policy found -> return default
  return getDefaultMailPolicy()
}

export async function setMailPolicy(params: {
  teamId: string
  agentId: string
  policy: MailPolicyConfig
}): Promise<void> {
  const storage = useStorage('settings')
  const key = `mail/policies/by-agent/${params.teamId}/${params.agentId}.json`
  const normalized = normalizePolicy(params.policy)
  await storage.setItem(key, normalized)
}

export function normalizePolicy(input?: MailPolicyConfig | null): MailPolicyConfig {
  const safe = input || {}
  const inbound = isValidRule(safe.inbound) ? safe.inbound : DEFAULT_RULE
  const outbound = isValidRule(safe.outbound) ? safe.outbound : DEFAULT_RULE
  return {
    inbound,
    outbound,
    allowedInboundAddresses: Array.isArray(safe.allowedInboundAddresses)
      ? dedupeLower(safe.allowedInboundAddresses)
      : [],
    allowedOutboundAddresses: Array.isArray(safe.allowedOutboundAddresses)
      ? dedupeLower(safe.allowedOutboundAddresses)
      : []
  }
}

function isValidRule(rule?: MailPolicyRule): rule is MailPolicyRule {
  return (
    rule === 'team_and_agents' || rule === 'team_only' || rule === 'agents_only' || rule === 'any'
  )
}

function dedupeLower(list: string[]): string[] {
  const set = new Set<string>()
  for (const v of list) {
    const val = String(v || '')
      .trim()
      .toLowerCase()
    if (val) set.add(val)
  }
  return Array.from(set)
}

// Convenience helpers based on Agent object
export async function getAgentMailPolicy(agent: Agent): Promise<MailPolicyConfig> {
  return await getMailPolicy({ teamId: agent.teamId, agentId: agent.id, agentEmail: agent.email })
}

export async function updateAgentMailPolicy(agent: Agent, policy: MailPolicyConfig): Promise<void> {
  if (!agent.teamId) return
  await setMailPolicy({ teamId: agent.teamId, agentId: agent.id, policy })
}
