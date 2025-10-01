<script setup lang="ts">
import type { Agent, McpServer } from '~/types'

interface Props {
  open: boolean;
  agent: Partial<Agent> | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'saved'): void
}>()

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

type StoredMcpServer = McpServer & {
  createdAt: string;
  updatedAt: string
}

const { data: mcpResponse, pending: mcpPending, refresh: refreshMcp } = await useAsyncData('mcp-servers-lite', async () => {
  const result = await $fetch<{ servers: StoredMcpServer[] }>('/api/mcp')
  return result.servers
}, { server: false, lazy: true })

const { data: agentsResponse, pending: agentsPending, refresh: refreshAgents } = await useAsyncData('agents-list', async () => {
  return await $fetch<Agent[]>('/api/agents')
}, { server: false, lazy: true })

const mcpServers = computed(() => mcpResponse.value ?? [])

const allAgents = computed(() => agentsResponse.value ?? [])
const otherAgents = computed(() => allAgents.value.filter(agent => agent.id !== local.id))

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
        .map(id => {
          const agent = allAgentsList.find(a => a.id === id)
          return agent?.email
        })
        .filter((email): email is string => !!email)
      console.log(`[Migration] Converted ${oldIds.length} agent IDs to ${allowedEmails.length} emails`)
    }

    // Ensure all fields have defaults
    local.multiRoundConfig = {
      enabled: local.multiRoundConfig.enabled ?? false,
      maxRounds: local.multiRoundConfig.maxRounds ?? 10,
      timeoutMinutes: local.multiRoundConfig.timeoutMinutes ?? 60,
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
    local.mcpServerIds = local.mcpServerIds.filter(id => id !== serverId)
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
    local.multiRoundConfig.allowedAgentEmails = local.multiRoundConfig.allowedAgentEmails.filter(email => email !== agentEmail)
  }
}

watch(() => props.open, isOpen => {
  if (isOpen) {
    resetLocal(props.agent)
    refreshMcp()
    refreshAgents()
  }
}, { immediate: true })

watch(() => props.agent && (props.agent as Partial<Agent>).id, () => {
  if (props.open) {
    resetLocal(props.agent)
    refreshMcp()
    refreshAgents()
  }
})

const isCreating = computed(() => !props.agent?.id)
const modalTitle = computed(() => isCreating.value ? 'Add Koompl' : 'Edit Koompl')
const modalDescription = computed(() => isCreating.value ? 'Add a new Koompl' : 'Edit the Koompl settings')
const submitButtonLabel = computed(() => isCreating.value ? 'Create' : 'Save')

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
  <UModal :title="modalTitle" :description="modalDescription" :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard>
        <div class="max-h-[70vh] overflow-y-auto px-1">
          <h3 class="font-medium text-highlighted mb-2">{{ modalTitle }}</h3>
          <UForm :state="local" @submit="save">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div class="lg:col-span-2 space-y-3">
            <UFormField label="Name">
              <UInput v-model="local.name" />
            </UFormField>
            <UFormField label="Email">
              <UInput v-model="local.email" />
            </UFormField>
            <UFormField label="Role">
              <UInput v-model="local.role" />
            </UFormField>
            <UFormField label="System Prompt">
              <UTextarea v-model="local.prompt" :rows="4" autoresize />
            </UFormField>
            <UFormField label="MCP Server" description="Kalender- und Aufgabenquellen, die der Agent nutzen darf.">
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
              <div v-else-if="mcpServers.length === 0" class="px-2 py-3 text-sm text-muted space-y-1">
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
                    <div class="text-xs text-muted">{{ server.provider }} • {{ server.category }}</div>
                    <div v-if="server.description" class="text-xs text-muted mt-1 truncate">
                      {{ server.description }}
                    </div>
                  </div>
                  <UBadge
                    :color="server.lastStatus === 'ok' ? 'green' : server.lastStatus === 'error' ? 'red' : 'gray'"
                    variant="subtle"
                    size="xs"
                  >
                    {{ server.lastStatus === 'ok' ? 'Online' : server.lastStatus === 'error' ? 'Fehler' : 'Unbekannt' }}
                  </UBadge>
                </div>
              </div>
              </UFormField>

              <!-- Multi-Round Configuration -->
              <UFormField label="Multi-Round Configuration" description="Enable complex, multi-step conversations with other agents.">
                <UAccordion :items="[{ label: local.multiRoundConfig?.enabled ? 'Enabled' : 'Disabled', icon: 'i-lucide-workflow', slot: 'multiround' }]" :unmount="false">
                  <template #multiround>
                    <div class="space-y-4 p-4 bg-muted/30 rounded-lg">
                      <!-- Enable Toggle -->
                      <div class="flex items-center justify-between">
                        <div class="flex-1">
                          <label class="text-sm font-medium">Enable Multi-Round Processing</label>
                          <p class="text-xs text-muted mt-1">Allow this agent to handle complex requests across multiple conversation rounds</p>
                        </div>
                        <USwitch v-model="local.multiRoundConfig!.enabled" />
                      </div>

                      <template v-if="local.multiRoundConfig?.enabled">
                        <USeparator />

                        <!-- Max Rounds -->
                        <UFormField label="Max Rounds" description="Maximum number of conversation rounds (default: 10)">
                          <UInput
                            v-model.number="local.multiRoundConfig.maxRounds"
                            type="number"
                            :min="1"
                            :max="50"
                            placeholder="10"
                          />
                        </UFormField>

                        <!-- Timeout Minutes -->
                        <UFormField label="Timeout (minutes)" description="Flow timeout in minutes (default: 60)">
                          <UInput
                            v-model.number="local.multiRoundConfig.timeoutMinutes"
                            type="number"
                            :min="1"
                            :max="1440"
                            placeholder="60"
                          />
                        </UFormField>

                        <USeparator />

                        <!-- Can Communicate with Agents -->
                        <div class="flex items-center justify-between">
                          <div class="flex-1">
                            <label class="text-sm font-medium">Inter-Agent Communication</label>
                            <p class="text-xs text-muted mt-1">Allow this agent to communicate with other agents</p>
                          </div>
                          <USwitch v-model="local.multiRoundConfig.canCommunicateWithAgents" />
                        </div>

                        <!-- Allowed Agents -->
                        <template v-if="local.multiRoundConfig.canCommunicateWithAgents">
                          <UFormField label="Allowed Agents" description="Select which agents this agent can communicate with. Leave empty to allow all.">
                            <div class="flex items-center justify-between mb-2">
                              <span class="text-sm text-muted">{{ otherAgents.length }} agents available</span>
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
                            <div v-else-if="otherAgents.length === 0" class="px-2 py-3 text-sm text-muted">
                              <p>No other agents available.</p>
                            </div>
                            <div v-else class="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                              <div
                                v-for="allowedAgent in otherAgents"
                                :key="allowedAgent.id"
                                class="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md transition-colors"
                              >
                                <UCheckbox
                                  :model-value="local.multiRoundConfig?.allowedAgentEmails?.includes(allowedAgent.email) || false"
                                  @update:model-value="(checked) => toggleAllowedAgent(allowedAgent.email, checked)"
                                />
                                <UAvatar v-bind="allowedAgent.avatar" size="xs" />
                                <div class="flex-1 min-w-0">
                                  <div class="font-medium text-sm">{{ allowedAgent.name }}</div>
                                  <div class="text-xs text-muted truncate">{{ allowedAgent.email }}</div>
                                </div>
                                <UBadge variant="subtle" size="xs">
                                  {{ allowedAgent.role }}
                                </UBadge>
                              </div>
                            </div>
                            <div v-if="!local.multiRoundConfig.allowedAgentEmails?.length && otherAgents.length > 0" class="mt-2">
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
                            <p class="text-xs text-muted mt-1">Automatically resume the flow when a response is received</p>
                          </div>
                          <USwitch v-model="local.multiRoundConfig.autoResumeOnResponse" />
                        </div>
                      </template>
                    </div>
                  </template>
                </UAccordion>
              </UFormField>

              <div v-if="!isCreating" class="flex items-center gap-2">
                <UAvatar v-bind="local.avatar" />
                <UButton icon="i-lucide-refresh-ccw" label="Refresh avatar" color="neutral" variant="outline" @click="refreshAvatar" />
              </div>
              <div class="flex items-center gap-2 justify-end">
                <UButton label="Cancel" color="neutral" variant="ghost" @click="emit('update:open', false)" />
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
