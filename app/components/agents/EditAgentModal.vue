<script setup lang="ts">
import type { Agent } from '~/types'

interface Props {
  open: boolean
  agent: Partial<Agent> | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved'): void
}>()

// Get team domain from session/API
const { session } = await useUserSession()
const { data: teamData } = await useAsyncData(
  'team-domain-edit-modal',
  () => $fetch<{ teamId: string; teamName: string; domain: string | null }>('/api/team/domain'),
  { server: false, lazy: true }
)

const teamDomain = computed(
  () => teamData.value?.domain || session.value?.team?.domain || 'agents.local'
)

const local = reactive<Partial<Agent>>({
  mcpServerIds: [],
  multiRoundConfig: {
    enabled: false,
    maxRounds: 10,
    timeoutMinutes: 60,
    canCommunicateWithAgents: false,
    allowedAgentEmails: [],
    autoResumeOnResponse: true
  }
})

// Builtin MCP servers (hardcoded - no custom servers)
const BUILTIN_MCP_SERVERS = [
  {
    id: 'builtin-kanban',
    name: 'Team Kanban Board',
    provider: 'builtin-kanban',
    category: 'productivity',
    description: 'Built-in Kanban board for task management'
  },
  {
    id: 'builtin-datasafe',
    name: 'Team Datasafe',
    provider: 'builtin-datasafe',
    category: 'storage',
    description: 'Secure team files vault'
  },
  {
    id: 'builtin-calendar',
    name: 'Team Calendar',
    provider: 'builtin-calendar',
    category: 'calendar',
    description: 'Built-in team calendar'
  },
  {
    id: 'builtin-agents',
    name: 'Agents Directory',
    provider: 'builtin-agents',
    category: 'directory',
    description: 'Directory of active agents'
  },
  {
    id: 'builtin-email',
    name: 'Email Support',
    provider: 'builtin-email',
    category: 'communication',
    description: 'Email processing and responses'
  }
]

const {
  data: agentsResponse,
  pending: agentsPending,
  refresh: refreshAgents
} = await useAsyncData(
  'agents-list',
  async () => {
    return await $fetch<Agent[]>('/api/agents')
  },
  { server: false, lazy: true }
)

const mcpServers = computed(() => BUILTIN_MCP_SERVERS)
const mcpPending = ref(false)
function refreshMcp() {
  // No-op for builtin servers (they don't need refreshing)
}

const allAgents = computed(() => agentsResponse.value ?? [])
const otherAgents = computed(() => allAgents.value.filter((agent) => agent.id !== local.id))

function resetLocal(next?: Partial<Agent> | null) {
  // Clear existing reactive keys by reassigning to a new object
  for (const key of Object.keys(local)) {
    // Reassign to undefined to keep reactivity without deleting dynamic keys
    ;(local as Record<string, unknown>)[key] = undefined
  }
  if (next) {
    Object.assign(local, next)
  }
  local.mcpServerIds = Array.isArray(next?.mcpServerIds) ? [...next.mcpServerIds] : []

  // Initialize multiRoundConfig with defaults if not present
  if (!local.multiRoundConfig || typeof local.multiRoundConfig !== 'object') {
    local.multiRoundConfig = {
      enabled: false,
      maxRounds: 10,
      timeoutMinutes: 60,
      canCommunicateWithAgents: false,
      allowedAgentEmails: [],
      autoResumeOnResponse: true
    }
  } else {
    // Migrate from old allowedAgentIds to allowedAgentEmails if needed
    let allowedEmails: string[] = []
    if (Array.isArray(local.multiRoundConfig.allowedAgentEmails)) {
      allowedEmails = [...local.multiRoundConfig.allowedAgentEmails]
    } else if (Array.isArray((local.multiRoundConfig as Record<string, unknown>).allowedAgentIds)) {
      // Migration: convert old IDs to emails by looking up agents
      const oldIds = (local.multiRoundConfig as Record<string, unknown>).allowedAgentIds as string[]
      const allAgentsList = allAgents.value || []
      allowedEmails = oldIds
        .map((id) => {
          const agent = allAgentsList.find((a) => a.id === id)
          return agent?.email
        })
        .filter((email): email is string => !!email)
      console.log(
        `[Migration] Converted ${oldIds.length} agent IDs to ${allowedEmails.length} emails`
      )
    }

    // Ensure all fields have defaults
    // Note: All agents now use multi-round (unified architecture)
    local.multiRoundConfig = {
      enabled: true, // Always enabled in unified architecture
      maxRounds: local.multiRoundConfig.maxRounds ?? 1, // Default to 1 for simple agents
      timeoutMinutes: local.multiRoundConfig.timeoutMinutes ?? 30, // Default 30 minutes
      canCommunicateWithAgents: local.multiRoundConfig.canCommunicateWithAgents ?? false,
      allowedAgentEmails: allowedEmails,
      autoResumeOnResponse: local.multiRoundConfig.autoResumeOnResponse ?? true
    }
  }
}

function toggleMcpServer(serverId: string, checked: boolean) {
  if (!local.mcpServerIds) {
    local.mcpServerIds = []
  }

  if (checked) {
    if (!local.mcpServerIds.includes(serverId)) {
      local.mcpServerIds.push(serverId)
    }
  } else {
    local.mcpServerIds = local.mcpServerIds.filter((id) => id !== serverId)
  }
}

function toggleAllowedAgent(agentEmail: string, checked: boolean) {
  if (!local.multiRoundConfig) return
  if (!local.multiRoundConfig.allowedAgentEmails) {
    local.multiRoundConfig.allowedAgentEmails = []
  }

  if (checked) {
    if (!local.multiRoundConfig.allowedAgentEmails.includes(agentEmail)) {
      local.multiRoundConfig.allowedAgentEmails.push(agentEmail)
    }
  } else {
    local.multiRoundConfig.allowedAgentEmails = local.multiRoundConfig.allowedAgentEmails.filter(
      (email) => email !== agentEmail
    )
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetLocal(props.agent)
      refreshMcp()
      refreshAgents()
    }
  },
  { immediate: true }
)

watch(
  () => props.agent && (props.agent as Partial<Agent>).id,
  () => {
    if (props.open) {
      resetLocal(props.agent)
      refreshMcp()
      refreshAgents()
    }
  }
)

const isCreating = computed(() => !props.agent?.id)
const isPredefined = computed(() => props.agent?.isPredefined || false)
const modalTitle = computed(() => (isCreating.value ? 'Add Koompl' : 'Edit Koompl'))
const modalDescription = computed(() =>
  isCreating.value ? 'Add a new Koompl' : 'Edit the Koompl settings'
)
const submitButtonLabel = computed(() => (isCreating.value ? 'Create' : 'Save'))

async function save() {
  if (isCreating.value) {
    // Creating a new agent
    await $fetch('/api/agents', { method: 'POST', body: local })
  } else {
    // Editing an existing agent
    if (!local.id) return
    await $fetch(`/api/agents/${local.id}`, { method: 'PATCH', body: local })
  }
  emit('update:open', false)
  emit('saved')
}

async function refreshAvatar() {
  if (!local.id) return
  const n = Math.random().toString(36).slice(2, 8)
  const newSrc = `https://i.pravatar.cc/256?u=${encodeURIComponent(n)}&cb=${Date.now()}`
  await $fetch(`/api/agents/${local.id}`, { method: 'PATCH', body: { avatar: { src: newSrc } } })
  // Optimistically update local state for instant UI change
  const current = (local.avatar as Record<string, unknown>) || {}
  local.avatar = { ...current, src: newSrc }
  emit('saved')
}
</script>

<template>
  <UModal
    :title="modalTitle"
    :description="modalDescription"
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <UCard>
        <div class="max-h-[70vh] overflow-y-auto px-1">
          <h3 class="font-medium text-highlighted mb-2">{{ modalTitle }}</h3>
          <UAlert
            v-if="isPredefined && !isCreating"
            icon="i-lucide-info"
            color="blue"
            variant="soft"
            title="Predefined Koompl"
            description="This is a predefined Koompl. Core properties (name, email, role, prompt) cannot be modified."
            class="mb-4"
          />
          <UForm :state="local" @submit="save">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div class="lg:col-span-2 space-y-3">
                <UFormField label="Name">
                  <UInput v-model="local.name" :disabled="isPredefined && !isCreating" />
                </UFormField>
                <UFormField label="Email">
                  <div class="flex items-center gap-2">
                    <UInput
                      v-model="local.email"
                      :disabled="isPredefined && !isCreating"
                      placeholder="username"
                      class="flex-1"
                    />
                    <span class="text-muted">@</span>
                    <UInput
                      :model-value="teamDomain"
                      disabled
                      class="flex-1 opacity-70"
                      :ui="{ base: 'cursor-not-allowed' }"
                    />
                  </div>
                  <template #hint>
                    <span class="text-xs text-muted"
                      >Username only (domain is set by your team)</span
                    >
                  </template>
                </UFormField>
                <UFormField label="Role">
                  <UInput v-model="local.role" :disabled="isPredefined && !isCreating" />
                </UFormField>
                <UFormField label="System Prompt">
                  <UTextarea
                    v-model="local.prompt"
                    :rows="4"
                    autoresize
                    :disabled="isPredefined && !isCreating"
                  />
                </UFormField>
                <UFormField
                  label="MCP Server"
                  description="Kalender- und Aufgabenquellen, die der Agent nutzen darf."
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm text-muted">{{ mcpServers.length }} Server verfügbar</span>
                    <UButton
                      icon="i-lucide-refresh-cw"
                      size="xs"
                      variant="ghost"
                      :loading="mcpPending"
                      @click="refreshMcp"
                    >
                      Aktualisieren
                    </UButton>
                  </div>
                  <div v-if="mcpPending" class="flex items-center gap-2 p-3">
                    <USkeleton class="h-4 w-4 rounded" />
                    <span class="text-sm text-muted">Lade MCP Server...</span>
                  </div>
                  <div
                    v-else-if="mcpServers.length === 0"
                    class="px-2 py-3 text-sm text-muted space-y-1"
                  >
                    <p>Keine MCP Server vorhanden.</p>
                    <NuxtLink to="/mcp" class="underline">MCP Server verwalten</NuxtLink>
                  </div>
                  <div v-else class="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                    <div
                      v-for="server in mcpServers"
                      :key="server.id"
                      class="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md transition-colors"
                    >
                      <UCheckbox
                        :model-value="local.mcpServerIds?.includes(server.id) || false"
                        @update:model-value="toggleMcpServer(server.id, $event)"
                      />
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-sm">{{ server.name }}</div>
                        <div class="text-xs text-muted">
                          {{ server.provider }} • {{ server.category }}
                        </div>
                        <div v-if="server.description" class="text-xs text-muted mt-1 truncate">
                          {{ server.description }}
                        </div>
                      </div>
                      <UBadge
                        :color="
                          server.lastStatus === 'ok'
                            ? 'green'
                            : server.lastStatus === 'error'
                              ? 'red'
                              : 'gray'
                        "
                        variant="subtle"
                        size="xs"
                      >
                        {{
                          server.lastStatus === 'ok'
                            ? 'Online'
                            : server.lastStatus === 'error'
                              ? 'Fehler'
                              : 'Unbekannt'
                        }}
                      </UBadge>
                    </div>
                  </div>
                </UFormField>

                <!-- Multi-Round Configuration -->
                <UFormField
                  label="Flow Configuration"
                  description="All agents use intelligent multi-round processing. Simple requests complete in 1 round, complex scenarios use multiple rounds automatically."
                >
                  <UAccordion
                    :items="[
                      {
                        label: 'Configure Flow Settings',
                        icon: 'i-lucide-workflow',
                        slot: 'multiround'
                      }
                    ]"
                    :unmount="false"
                  >
                    <template #multiround>
                      <div class="space-y-4 p-4 bg-muted/30 rounded-lg">
                        <!-- Info Alert -->
                        <UAlert
                          icon="i-lucide-info"
                          color="blue"
                          variant="soft"
                          title="Unified Multi-Round Architecture"
                          description="All agents now use the same intelligent flow processing. Simple requests complete quickly in 1 round, while complex coordination automatically uses multiple rounds as needed."
                        />

                        <!-- Max Rounds -->
                        <UFormField
                          label="Max Rounds"
                          description="Maximum conversation rounds allowed. Default: 1 for simple agents, 5-10 for coordinating agents."
                        >
                          <UInput
                            v-model.number="local.multiRoundConfig.maxRounds"
                            type="number"
                            :min="1"
                            :max="50"
                            placeholder="1"
                          />
                          <template #help>
                            <div class="text-xs text-muted mt-1">
                              <p>• Simple agents (calendar, tasks): 1 round</p>
                              <p>• Coordinating agents: 5-10 rounds</p>
                            </div>
                          </template>
                        </UFormField>

                        <!-- Timeout Minutes -->
                        <UFormField
                          label="Timeout (minutes)"
                          description="Maximum time before flow auto-fails (default: 30 minutes)"
                        >
                          <UInput
                            v-model.number="local.multiRoundConfig.timeoutMinutes"
                            type="number"
                            :min="1"
                            :max="1440"
                            placeholder="30"
                          />
                        </UFormField>

                        <USeparator />

                        <!-- Can Communicate with Agents -->
                        <div class="flex items-center justify-between">
                          <div class="flex-1">
                            <label class="text-sm font-medium">Inter-Agent Communication</label>
                            <p class="text-xs text-muted mt-1">
                              Allow this agent to communicate with other agents
                            </p>
                          </div>
                          <USwitch v-model="local.multiRoundConfig.canCommunicateWithAgents" />
                        </div>

                        <!-- Allowed Agents -->
                        <template v-if="local.multiRoundConfig.canCommunicateWithAgents">
                          <UFormField
                            label="Allowed Agents"
                            description="Select which agents this agent can communicate with. Leave empty to allow all."
                          >
                            <div class="flex items-center justify-between mb-2">
                              <span class="text-sm text-muted"
                                >{{ otherAgents.length }} agents available</span
                              >
                              <UButton
                                icon="i-lucide-refresh-cw"
                                size="xs"
                                variant="ghost"
                                :loading="agentsPending"
                                @click="refreshAgents"
                              >
                                Refresh
                              </UButton>
                            </div>
                            <div v-if="agentsPending" class="flex items-center gap-2 p-3">
                              <USkeleton class="h-4 w-4 rounded" />
                              <span class="text-sm text-muted">Loading agents...</span>
                            </div>
                            <div
                              v-else-if="otherAgents.length === 0"
                              class="px-2 py-3 text-sm text-muted"
                            >
                              <p>No other agents available.</p>
                            </div>
                            <div
                              v-else
                              class="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3"
                            >
                              <div
                                v-for="allowedAgent in otherAgents"
                                :key="allowedAgent.id"
                                class="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md transition-colors"
                              >
                                <UCheckbox
                                  :model-value="
                                    local.multiRoundConfig?.allowedAgentEmails?.includes(
                                      allowedAgent.email
                                    ) || false
                                  "
                                  @update:model-value="
                                    (checked) => toggleAllowedAgent(allowedAgent.email, checked)
                                  "
                                />
                                <UAvatar v-bind="allowedAgent.avatar" size="xs" />
                                <div class="flex-1 min-w-0">
                                  <div class="font-medium text-sm">{{ allowedAgent.name }}</div>
                                  <div class="text-xs text-muted truncate">
                                    {{ allowedAgent.email }}
                                  </div>
                                </div>
                                <UBadge variant="subtle" size="xs">
                                  {{ allowedAgent.role }}
                                </UBadge>
                              </div>
                            </div>
                            <div
                              v-if="
                                !local.multiRoundConfig.allowedAgentEmails?.length &&
                                otherAgents.length > 0
                              "
                              class="mt-2"
                            >
                              <UAlert
                                icon="i-lucide-info"
                                color="blue"
                                variant="subtle"
                                title="All agents allowed"
                                description="No specific agents selected means this agent can communicate with all agents."
                              />
                            </div>
                          </UFormField>
                        </template>

                        <USeparator />

                        <!-- Auto Resume on Response -->
                        <div class="flex items-center justify-between">
                          <div class="flex-1">
                            <label class="text-sm font-medium">Auto-Resume on Response</label>
                            <p class="text-xs text-muted mt-1">
                              Automatically resume the flow when a response is received
                            </p>
                          </div>
                          <USwitch v-model="local.multiRoundConfig.autoResumeOnResponse" />
                        </div>
                      </div>
                    </template>
                  </UAccordion>
                </UFormField>

                <div v-if="!isCreating" class="flex items-center gap-2">
                  <UAvatar v-bind="local.avatar" />
                  <UButton
                    icon="i-lucide-refresh-ccw"
                    label="Refresh avatar"
                    color="neutral"
                    variant="outline"
                    @click="refreshAvatar"
                  />
                </div>
                <div class="flex items-center gap-2 justify-end">
                  <UButton
                    label="Cancel"
                    color="neutral"
                    variant="ghost"
                    @click="emit('update:open', false)"
                  />
                  <UButton type="submit" :label="submitButtonLabel" />
                </div>
              </div>
            </div>
          </UForm>
        </div>
      </UCard>
    </template>
  </UModal>
</template>
