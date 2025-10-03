<script setup lang="ts">
import type { Agent, MailPolicyConfig, MailPolicyRule } from '~/types'

const route = useRoute()
const router = useRouter()
const agentId = computed(() => String(route.params.id))
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

function parseAddressList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function formatAddressList(addresses?: string[]): string {
  return (addresses || []).join(', ')
}

const { data: agentData, refresh } = await useAsyncData(
  () => `agent-mail-policy-${agentId.value}`,
  () => $fetch<Agent>(`/api/agents/${agentId.value}`),
  { server: false, lazy: true }
)

const agent = computed(() => agentData.value)

const inboundRule = ref<MailPolicyRule>(DEFAULT_RULE)
const outboundRule = ref<MailPolicyRule>(DEFAULT_RULE)
const allowedInbound = ref('')
const allowedOutbound = ref('')

const isDirty = ref(false)

const inboundDescription = computed(() => {
  return MAIL_POLICY_OPTIONS.find((option) => option.value === inboundRule.value)?.description || ''
})

const outboundDescription = computed(() => {
  return (
    MAIL_POLICY_OPTIONS.find((option) => option.value === outboundRule.value)?.description || ''
  )
})

function applyAgentPolicy(payload?: MailPolicyConfig | null) {
  inboundRule.value = payload?.inbound || DEFAULT_RULE
  outboundRule.value = payload?.outbound || DEFAULT_RULE
  allowedInbound.value = formatAddressList(payload?.allowedInboundAddresses)
  allowedOutbound.value = formatAddressList(payload?.allowedOutboundAddresses)
  isDirty.value = false
}

watch(
  () => agent.value,
  (value) => {
    if (!value) return
    const policy = value.multiRoundConfig?.mailPolicy
    applyAgentPolicy(policy)
  },
  { immediate: true }
)

watch([inboundRule, outboundRule, allowedInbound, allowedOutbound], () => {
  if (!agent.value) {
    isDirty.value = false
    return
  }
  const currentPolicy = agent.value.multiRoundConfig?.mailPolicy || {}
  const changed =
    inboundRule.value !== (currentPolicy.inbound || DEFAULT_RULE) ||
    outboundRule.value !== (currentPolicy.outbound || DEFAULT_RULE) ||
    allowedInbound.value.trim() !== formatAddressList(currentPolicy.allowedInboundAddresses) ||
    allowedOutbound.value.trim() !== formatAddressList(currentPolicy.allowedOutboundAddresses)
  isDirty.value = changed
})

const saving = ref(false)

async function savePolicy() {
  if (!agent.value) return
  saving.value = true

  try {
    const nextPolicy: MailPolicyConfig = {
      inbound: inboundRule.value,
      outbound: outboundRule.value,
      allowedInboundAddresses: parseAddressList(allowedInbound.value),
      allowedOutboundAddresses: parseAddressList(allowedOutbound.value)
    }

    const nextMultiRound = {
      ...agent.value.multiRoundConfig,
      mailPolicy: nextPolicy
    }

    await $fetch(`/api/agents/${agentId.value}`, {
      method: 'PATCH',
      body: {
        multiRoundConfig: nextMultiRound
      }
    })

    await refresh()
    applyAgentPolicy(nextPolicy)
    toast.add({
      title: 'Mail policy updated',
      description: 'The agent mail sending rules were saved successfully.',
      color: 'green'
    })
  } catch (error) {
    console.error('Failed to save mail policy', error)
    toast.add({
      title: 'Failed to save mail policy',
      description: error instanceof Error ? error.message : String(error),
      color: 'red'
    })
  } finally {
    saving.value = false
  }
}

function resetToDefaults() {
  inboundRule.value = DEFAULT_RULE
  outboundRule.value = DEFAULT_RULE
  allowedInbound.value = ''
  allowedOutbound.value = ''
}
</script>

<template>
  <UDashboardPanel id="agent-mail-policy">
    <UDashboardNavbar title="Mail Policy">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>
      <template #left>
        <UButton color="neutral" variant="ghost" icon="i-lucide-arrow-left" @click="router.back()">
          Back
        </UButton>
      </template>
      <template #trailing>
        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-rotate-ccw"
            :disabled="saving"
            @click="resetToDefaults"
          >
            Reset
          </UButton>
          <UButton
            color="primary"
            icon="i-lucide-save"
            :loading="saving"
            :disabled="!isDirty || saving"
            @click="savePolicy"
          >
            Save
          </UButton>
        </div>
      </template>
    </UDashboardNavbar>

    <div class="p-4 space-y-6">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0">
              <UAvatar v-bind="agent?.avatar" size="md" />
              <div class="min-w-0">
                <p class="font-semibold truncate">{{ agent?.name || 'Agent' }}</p>
                <p class="text-sm text-muted truncate">{{ agent?.email }}</p>
              </div>
            </div>
            <UBadge variant="subtle">{{ agent?.role }}</UBadge>
          </div>
        </template>

        <div class="space-y-6">
          <div>
            <label class="font-semibold text-sm text-highlighted">Inbound policy</label>
            <p class="text-xs text-muted mb-2">
              Controls which senders are allowed to initiate conversations with this agent.
            </p>
            <USelect
              v-model="inboundRule"
              :items="MAIL_POLICY_OPTIONS"
              option-attribute="label"
              value-attribute="value"
            />
            <p class="text-xs text-muted mt-2">{{ inboundDescription }}</p>
            <div class="mt-3">
              <label class="text-xs font-medium text-muted"
                >Explicitly allowed senders (comma or newline separated)</label
              >
              <UTextarea
                v-model="allowedInbound"
                placeholder="user@example.com, partner@example.org"
                :rows="3"
              />
            </div>
          </div>

          <USeparator />

          <div>
            <label class="font-semibold text-sm text-highlighted">Outbound policy</label>
            <p class="text-xs text-muted mb-2">
              Controls which recipients this agent may email automatically.
            </p>
            <USelect
              v-model="outboundRule"
              :items="MAIL_POLICY_OPTIONS"
              option-attribute="label"
              value-attribute="value"
            />
            <p class="text-xs text-muted mt-2">{{ outboundDescription }}</p>
            <div class="mt-3">
              <label class="text-xs font-medium text-muted"
                >Explicitly allowed recipients (comma or newline separated)</label
              >
              <UTextarea
                v-model="allowedOutbound"
                placeholder="user@example.com, partner@example.org"
                :rows="3"
              />
            </div>
          </div>

          <div
            class="rounded border border-dashed border-neutral-200 bg-neutral-50 p-4 text-xs text-muted"
          >
            <p class="font-medium text-highlighted mb-1">How it works</p>
            <ul class="list-disc list-inside space-y-1">
              <li>Team members are detected via the team directory.</li>
              <li>Agents are identified by their username (address before @team-domain).</li>
              <li>Explicit entries bypass the selected rule.</li>
              <li>Changes take effect immediately across inbound routing and outbound delivery.</li>
            </ul>
          </div>
        </div>
      </UCard>
    </div>
  </UDashboardPanel>
</template>
