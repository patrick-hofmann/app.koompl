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

function _parseAddressList(raw: string): string[] {
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

const { data: agentsData, pending } = await useAsyncData(
  'agents-mail-policies',
  () => $fetch<Agent[]>('/api/agents'),
  {
    server: false,
    lazy: true
  }
)

const policyState = reactive<Record<string, AgentPolicyState>>({})

function resolveBasePolicy(_agent: Agent): MailPolicyConfig {
  // Mock: Always return default policy (team_and_agents)
  return defaultPolicy()
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
    // Mock: Simulate save operation but don't actually save
    // Mail policies are mocked to always use team_and_agents default
    await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate network delay

    // Reset to default policy (mocked behavior)
    const defaultPolicy = {
      inbound: DEFAULT_RULE,
      outbound: DEFAULT_RULE,
      allowedInboundAddresses: [],
      allowedOutboundAddresses: []
    }

    state.base = defaultPolicy
    state.inbound = defaultPolicy.inbound
    state.outbound = defaultPolicy.outbound
    state.allowedInbound = ''
    state.allowedOutbound = ''
    state.dirty = false

    toast.add({
      title: `${agent.name} updated`,
      description: 'Mail policy is mocked - using team_and_agents default.',
      color: 'blue'
    })
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
            <USkeleton class="h-64 w-full" />
          </template>

          <div v-if="pending">
            <USkeleton class="h-64 w-full" />
          </div>

          <div v-else>
            <UAlert
              v-if="sortedAgents.length === 0"
              title="No agents found"
              description="Create an agent first to configure mail policies."
              icon="i-lucide-info"
              color="neutral"
            />

            <div v-else class="space-y-4">
              <!-- Policy Legend -->
              <UCard>
                <template #header>
                  <h3 class="text-sm font-medium text-highlighted">Policy Types</h3>
                </template>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div v-for="option in MAIL_POLICY_OPTIONS" :key="option.value" class="space-y-1">
                    <div class="font-medium text-highlighted">{{ option.label }}</div>
                    <div class="text-muted">{{ option.description }}</div>
                  </div>
                </div>
              </UCard>

              <!-- Agents Table -->
              <UCard>
                <div class="overflow-x-auto">
                  <table class="w-full">
                    <thead>
                      <tr class="border-b border-gray-200 dark:border-gray-700">
                        <th class="text-left py-3 px-4 font-medium text-highlighted">Agent</th>
                        <th class="text-left py-3 px-4 font-medium text-highlighted">Inbound</th>
                        <th class="text-left py-3 px-4 font-medium text-highlighted">Outbound</th>
                        <th class="text-left py-3 px-4 font-medium text-highlighted">
                          Allowed Addresses
                        </th>
                        <th class="text-center py-3 px-4 font-medium text-highlighted">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="agent in sortedAgents"
                        :key="agent.id"
                        class="border-b border-gray-100 dark:border-gray-800"
                      >
                        <td class="py-3 px-4">
                          <div class="flex items-center gap-3">
                            <UAvatar v-bind="agent.avatar" size="sm" />
                            <div class="min-w-0">
                              <div class="flex items-center gap-2">
                                <p class="font-medium text-highlighted truncate">
                                  {{ agent.name }}
                                </p>
                                <UBadge
                                  :variant="agent.isPredefined ? 'subtle' : 'outline'"
                                  size="xs"
                                >
                                  {{ agent.isPredefined ? 'Predefined' : agent.role || 'Agent' }}
                                </UBadge>
                              </div>
                              <p class="text-xs text-muted truncate">{{ agent.email }}</p>
                            </div>
                          </div>
                        </td>
                        <td class="py-3 px-4">
                          <USelect
                            :model-value="ensurePolicyState(agent).inbound"
                            :items="MAIL_POLICY_OPTIONS"
                            option-attribute="label"
                            value-attribute="value"
                            size="sm"
                            @update:model-value="
                              (value: MailPolicyRule) => updateInbound(agent, value)
                            "
                          />
                        </td>
                        <td class="py-3 px-4">
                          <USelect
                            :model-value="ensurePolicyState(agent).outbound"
                            :items="MAIL_POLICY_OPTIONS"
                            option-attribute="label"
                            value-attribute="value"
                            size="sm"
                            @update:model-value="
                              (value: MailPolicyRule) => updateOutbound(agent, value)
                            "
                          />
                        </td>
                        <td class="py-3 px-4">
                          <div class="space-y-2">
                            <div>
                              <label class="text-xs text-muted">Inbound:</label>
                              <UTextarea
                                :model-value="ensurePolicyState(agent).allowedInbound"
                                placeholder="user@example.com"
                                :rows="1"
                                size="xs"
                                @update:model-value="
                                  (value: string) => updateAllowedInbound(agent, value)
                                "
                              />
                            </div>
                            <div>
                              <label class="text-xs text-muted">Outbound:</label>
                              <UTextarea
                                :model-value="ensurePolicyState(agent).allowedOutbound"
                                placeholder="user@example.com"
                                :rows="1"
                                size="xs"
                                @update:model-value="
                                  (value: string) => updateAllowedOutbound(agent, value)
                                "
                              />
                            </div>
                          </div>
                        </td>
                        <td class="py-3 px-4">
                          <div class="flex items-center justify-center gap-1">
                            <UTooltip text="Revert changes">
                              <UButton
                                color="neutral"
                                variant="ghost"
                                icon="i-lucide-undo-2"
                                size="xs"
                                :disabled="!ensurePolicyState(agent).dirty"
                                @click="resetToBase(agent)"
                              />
                            </UTooltip>
                            <UTooltip text="Reset to defaults">
                              <UButton
                                color="neutral"
                                variant="ghost"
                                icon="i-lucide-rotate-ccw"
                                size="xs"
                                @click="resetToDefaults(agent)"
                              />
                            </UTooltip>
                            <UTooltip text="Save changes">
                              <UButton
                                color="primary"
                                icon="i-lucide-save"
                                size="xs"
                                :loading="ensurePolicyState(agent).saving"
                                :disabled="
                                  !ensurePolicyState(agent).dirty || ensurePolicyState(agent).saving
                                "
                                @click="savePolicy(agent)"
                              />
                            </UTooltip>
                          </div>
                          <div
                            v-if="ensurePolicyState(agent).dirty"
                            class="flex justify-center mt-1"
                          >
                            <UBadge color="orange" variant="subtle" size="xs">Unsaved</UBadge>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </UCard>
            </div>
          </div>
        </ClientOnly>
      </div>
    </template>
  </UDashboardPanel>
</template>
