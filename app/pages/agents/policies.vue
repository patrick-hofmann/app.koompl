<script setup lang="ts">
import type { Agent, MailPolicyConfig, MailPolicyRule } from '~/types'

const toast = useToast()
const MAIL_POLICY_OPTIONS: Array<{ label: string; value: MailPolicyRule; description: string }> = [
  {
    label: 'Team & Agents',
    value: 'team_and_agents',
    description: 'Allow messages to teammates and registered agents only (default).'
  },
  {
    label: 'Team Members Only',
    value: 'team_only',
    description: 'Restrict communication to verified team member email addresses.'
  },
  {
    label: 'Agents Only',
    value: 'agents_only',
    description: 'Restrict communication to internal agents. No external email delivery.'
  },
  {
    label: 'Any Recipient',
    value: 'any',
    description: 'Allow unrestricted email delivery. Use with caution.'
  }
]

const DEFAULT_RULE: MailPolicyRule = 'team_and_agents'

function defaultPolicy(): MailPolicyConfig {
  return {
    inbound: DEFAULT_RULE,
    outbound: DEFAULT_RULE,
    allowedInboundAddresses: [],
    allowedOutboundAddresses: []
  }
}

function formatAddressList(addresses?: string[]): string {
  return (addresses || []).join(', ')
}

function parseAddressList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

interface AgentPolicyState {
  inbound: MailPolicyRule
  outbound: MailPolicyRule
  allowedInbound: string
  allowedOutbound: string
  base: MailPolicyConfig
  dirty: boolean
  saving: boolean
}

const {
  data: agentsData,
  pending,
  refresh
} = await useAsyncData('agents-mail-policies', () => $fetch<Agent[]>('/api/agents'), {
  server: false,
  lazy: true
})

const policyState = reactive<Record<string, AgentPolicyState>>({})

function resolveBasePolicy(agent: Agent): MailPolicyConfig {
  const existing = agent.multiRoundConfig?.mailPolicy
  if (!existing) {
    return defaultPolicy()
  }
  return {
    inbound: existing.inbound || DEFAULT_RULE,
    outbound: existing.outbound || DEFAULT_RULE,
    allowedInboundAddresses: existing.allowedInboundAddresses || [],
    allowedOutboundAddresses: existing.allowedOutboundAddresses || []
  }
}

function ensurePolicyState(agent: Agent): AgentPolicyState {
  if (!policyState[agent.id]) {
    const base = resolveBasePolicy(agent)
    policyState[agent.id] = reactive({
      inbound: base.inbound,
      outbound: base.outbound,
      allowedInbound: formatAddressList(base.allowedInboundAddresses),
      allowedOutbound: formatAddressList(base.allowedOutboundAddresses),
      base,
      dirty: false,
      saving: false
    }) as AgentPolicyState
  }
  return policyState[agent.id]
}

watch(
  () => agentsData.value,
  (agents) => {
    if (!agents) return
    agents.forEach((agent) => {
      const base = resolveBasePolicy(agent)
      const state = ensurePolicyState(agent)
      state.base = base
      state.inbound = base.inbound
      state.outbound = base.outbound
      state.allowedInbound = formatAddressList(base.allowedInboundAddresses)
      state.allowedOutbound = formatAddressList(base.allowedOutboundAddresses)
      state.dirty = false
    })
  },
  { immediate: true }
)

function computeDirty(state: AgentPolicyState): boolean {
  return (
    state.inbound !== state.base.inbound ||
    state.outbound !== state.base.outbound ||
    state.allowedInbound.trim() !== formatAddressList(state.base.allowedInboundAddresses).trim() ||
    state.allowedOutbound.trim() !== formatAddressList(state.base.allowedOutboundAddresses).trim()
  )
}

function updateInbound(agent: Agent, value: MailPolicyRule) {
  const state = ensurePolicyState(agent)
  state.inbound = value
  state.dirty = computeDirty(state)
}

function updateOutbound(agent: Agent, value: MailPolicyRule) {
  const state = ensurePolicyState(agent)
  state.outbound = value
  state.dirty = computeDirty(state)
}

function updateAllowedInbound(agent: Agent, value: string) {
  const state = ensurePolicyState(agent)
  state.allowedInbound = value
  state.dirty = computeDirty(state)
}

function updateAllowedOutbound(agent: Agent, value: string) {
  const state = ensurePolicyState(agent)
  state.allowedOutbound = value
  state.dirty = computeDirty(state)
}

function resetToBase(agent: Agent) {
  const state = ensurePolicyState(agent)
  state.inbound = state.base.inbound
  state.outbound = state.base.outbound
  state.allowedInbound = formatAddressList(state.base.allowedInboundAddresses)
  state.allowedOutbound = formatAddressList(state.base.allowedOutboundAddresses)
  state.dirty = false
}

function resetToDefaults(agent: Agent) {
  const state = ensurePolicyState(agent)
  const defaults = defaultPolicy()
  state.inbound = defaults.inbound
  state.outbound = defaults.outbound
  state.allowedInbound = ''
  state.allowedOutbound = ''
  state.dirty = computeDirty(state)
}

async function savePolicy(agent: Agent) {
  const state = ensurePolicyState(agent)
  if (state.saving) return
  state.saving = true

  try {
    const payload: MailPolicyConfig = {
      inbound: state.inbound,
      outbound: state.outbound,
      allowedInboundAddresses: parseAddressList(state.allowedInbound),
      allowedOutboundAddresses: parseAddressList(state.allowedOutbound)
    }

    const nextMultiRound = {
      ...agent.multiRoundConfig,
      mailPolicy: payload
    }

    await $fetch(`/api/agents/${agent.id}`, {
      method: 'PATCH',
      body: {
        multiRoundConfig: nextMultiRound
      }
    })

    state.base = {
      inbound: payload.inbound,
      outbound: payload.outbound,
      allowedInboundAddresses: [...payload.allowedInboundAddresses],
      allowedOutboundAddresses: [...payload.allowedOutboundAddresses]
    }
    state.dirty = false

    toast.add({
      title: `${agent.name} updated`,
      description: 'Mail policy saved successfully.',
      color: 'green'
    })

    await refresh()
  } catch (error) {
    console.error('Failed to save mail policy', error)
    toast.add({
      title: `Failed to update ${agent.name}`,
      description: error instanceof Error ? error.message : String(error),
      color: 'red'
    })
  } finally {
    state.saving = false
  }
}

function policyDescription(rule: MailPolicyRule): string {
  return MAIL_POLICY_OPTIONS.find((option) => option.value === rule)?.description || ''
}

const sortedAgents = computed(() => {
  const agents = agentsData.value || []
  return [...agents].sort((a, b) => {
    if (a.isPredefined && !b.isPredefined) return -1
    if (!a.isPredefined && b.isPredefined) return 1
    return a.name.localeCompare(b.name)
  })
})
</script>

<template>
  <UDashboardPanel id="agents-mail-policies">
    <template #header>
      <UDashboardNavbar title="Mail Policies">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-4 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-highlighted">Agent Mail Policies</h2>
            <p class="text-sm text-muted">
              Manage inbound and outbound email rules for every agent, including predefined Koompls.
            </p>
          </div>
          <UBadge variant="subtle">{{ sortedAgents.length }} agents</UBadge>
        </div>

        <ClientOnly>
          <template #fallback>
            <div class="space-y-3">
              <USkeleton v-for="n in 3" :key="n" class="h-20 w-full" />
            </div>
          </template>

          <div v-if="pending" class="space-y-3">
            <USkeleton v-for="n in 3" :key="n" class="h-20 w-full" />
          </div>

          <div v-else class="space-y-4">
            <UAlert
              v-if="sortedAgents.length === 0"
              title="No agents found"
              description="Create an agent first to configure mail policies."
              icon="i-lucide-info"
              color="neutral"
            />

            <div v-else class="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <UCard v-for="agent in sortedAgents" :key="agent.id">
                <template #header>
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                      <UAvatar v-bind="agent.avatar" size="md" />
                      <div class="min-w-0">
                        <p class="font-semibold text-highlighted truncate">{{ agent.name }}</p>
                        <p class="text-xs text-muted truncate">{{ agent.email }}</p>
                      </div>
                    </div>
                    <UBadge :variant="agent.isPredefined ? 'subtle' : 'outline'">
                      {{ agent.isPredefined ? 'Predefined' : agent.role || 'Agent' }}
                    </UBadge>
                  </div>
                </template>

                <div class="space-y-4">
                  <div>
                    <UFormField label="Inbound policy">
                      <USelect
                        :model-value="ensurePolicyState(agent).inbound"
                        :items="MAIL_POLICY_OPTIONS"
                        option-attribute="label"
                        value-attribute="value"
                        @update:model-value="(value: MailPolicyRule) => updateInbound(agent, value)"
                      />
                    </UFormField>
                    <p class="text-xs text-muted mt-1">
                      {{ policyDescription(ensurePolicyState(agent).inbound) }}
                    </p>
                    <UTextarea
                      class="mt-2"
                      :model-value="ensurePolicyState(agent).allowedInbound"
                      placeholder="user@example.com, partner@example.org"
                      :rows="2"
                      @update:model-value="(value: string) => updateAllowedInbound(agent, value)"
                    />
                    <p class="text-[11px] text-muted mt-1">Comma or newline separated addresses.</p>
                  </div>

                  <USeparator />

                  <div>
                    <UFormField label="Outbound policy">
                      <USelect
                        :model-value="ensurePolicyState(agent).outbound"
                        :items="MAIL_POLICY_OPTIONS"
                        option-attribute="label"
                        value-attribute="value"
                        @update:model-value="
                          (value: MailPolicyRule) => updateOutbound(agent, value)
                        "
                      />
                    </UFormField>
                    <p class="text-xs text-muted mt-1">
                      {{ policyDescription(ensurePolicyState(agent).outbound) }}
                    </p>
                    <UTextarea
                      class="mt-2"
                      :model-value="ensurePolicyState(agent).allowedOutbound"
                      placeholder="user@example.com, partner@example.org"
                      :rows="2"
                      @update:model-value="(value: string) => updateAllowedOutbound(agent, value)"
                    />
                    <p class="text-[11px] text-muted mt-1">Comma or newline separated addresses.</p>
                  </div>
                </div>

                <template #footer>
                  <div class="flex flex-wrap items-center gap-2 justify-between">
                    <div class="flex items-center gap-2">
                      <UButton
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-undo-2"
                        size="xs"
                        :disabled="!ensurePolicyState(agent).dirty"
                        @click="resetToBase(agent)"
                      >
                        Revert
                      </UButton>
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-rotate-ccw"
                        size="xs"
                        @click="resetToDefaults(agent)"
                      >
                        Defaults
                      </UButton>
                    </div>
                    <UButton
                      color="primary"
                      icon="i-lucide-save"
                      size="xs"
                      :loading="ensurePolicyState(agent).saving"
                      :disabled="!ensurePolicyState(agent).dirty || ensurePolicyState(agent).saving"
                      @click="savePolicy(agent)"
                    >
                      Save
                    </UButton>
                  </div>
                </template>
              </UCard>
            </div>
          </div>
        </ClientOnly>
      </div>
    </template>
  </UDashboardPanel>
</template>
