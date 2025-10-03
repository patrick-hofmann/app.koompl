<script setup lang="ts">
import type { Agent, Mail } from '~/types'

const route = useRoute()
const agentId = computed(() => String(route.params.id))

// Client-only lazy fetch to avoid SSR blocking on storage
const { data: agent, refresh } = await useAsyncData(
  () => `agent-${agentId.value}`,
  () => $fetch<Agent>(`/api/agents/${agentId.value}`),
  { server: false, lazy: true }
)

// Real email data for this agent
const {
  data: emailData,
  pending: emailsPending,
  refresh: refreshEmails
} = await useAsyncData(
  () => `agent-emails-${agentId.value}`,
  async () => {
    const res = await $fetch<{ incoming: Mail[]; outgoing: Mail[] }>(
      `/api/agents/${agentId.value}/emails`
    )
    return res
  },
  { server: false, lazy: true }
)

// Tabs with email counts
const tabItems = computed(() => {
  const incoming = emailData.value?.incoming || []
  const outgoing = emailData.value?.outgoing || []
  const logs = logsData.value || []

  return [
    { label: `All (${incoming.length + outgoing.length})`, value: 'all' },
    { label: `Incoming (${incoming.length})`, value: 'incoming' },
    { label: `Outgoing (${outgoing.length})`, value: 'outgoing' },
    { label: `Log (${logs.length})`, value: 'log' }
  ]
})
const selectedTab = ref('all')

// Real mail handling with incoming and outgoing emails
const combinedMails = computed<Mail[]>(() => {
  const incoming = emailData.value?.incoming || []
  const outgoing = emailData.value?.outgoing || []

  if (selectedTab.value === 'incoming') return incoming
  if (selectedTab.value === 'outgoing') return outgoing
  if (selectedTab.value === 'all')
    return [...incoming, ...outgoing].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  if (selectedTab.value === 'log') return []
  return []
})

// Comprehensive agent activity logs (MCP, AI, Email)
type AgentLogEntry = {
  id: string
  timestamp: string
  agentId: string
  agentEmail: string
  type: 'mcp_usage' | 'ai_usage' | 'email_activity'
  // MCP usage fields
  serverId?: string
  serverName?: string
  provider?: string
  category?: string
  input?: {
    query: string
    context?: Record<string, unknown>
    parameters?: Record<string, unknown>
  }
  output?: {
    result: unknown
    success: boolean
    error?: string
  }
  metadata?: {
    responseTime?: number
    contextCount?: number
  }
  // AI usage fields
  model?: string
  tokens?: {
    prompt?: number
    completion?: number
    total?: number
  }
  // Email activity fields
  direction?: 'inbound' | 'outbound'
  email?: {
    messageId: string
    from: string
    to: string
    subject: string
    body: string
  }
}

const {
  data: logsData,
  pending: logsPending,
  refresh: refreshLogs
} = await useAsyncData(
  () => `agent-activity-logs-${agentId.value}`,
  async () => {
    const res = await $fetch<{ ok: boolean; count: number; logs: AgentLogEntry[] }>(
      `/api/agents/${agentId.value}/logs`,
      {
        query: { type: 'all', limit: 200 }
      }
    )
    return res.logs || []
  },
  { server: false, lazy: true }
)

const logs = computed<AgentLogEntry[]>(() => logsData.value || [])

function formatTs(value?: string) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

const selectedMail = ref<Mail | null>()

// Basic edit/delete mock actions
const editOpen = ref(false)
const editAgent = reactive<Partial<Agent>>({})

function openEdit() {
  Object.assign(editAgent, agent.value)
  editOpen.value = true
}

function goToMailPolicy() {
  navigateTo(`/agents/${agentId.value}/policy`)
}

// edit is handled by shared modal now

async function deleteAgent() {
  await $fetch(`/api/agents/${agentId.value}`, { method: 'DELETE' })
  await navigateTo('/agents')
}

// Clear functions
const clearingEmails = ref(false)
const clearingLogs = ref(false)
const clearingAll = ref(false)

async function clearEmails() {
  if (
    !confirm(
      'Are you sure you want to clear all emails for this agent? This action cannot be undone.'
    )
  ) {
    return
  }

  clearingEmails.value = true
  try {
    const result = await $fetch(`/api/agents/${agentId.value}/clear-emails`, { method: 'POST' })
    console.log('Emails cleared:', result)

    // Refresh the email data
    await refreshEmails()

    // Show success message
    const toast = useToast()
    toast.add({
      title: 'Emails Cleared',
      description: `Cleared ${result.deletedCount} emails`,
      color: 'green'
    })
  } catch (error) {
    console.error('Failed to clear emails:', error)
    const toast = useToast()
    toast.add({
      title: 'Error',
      description: 'Failed to clear emails',
      color: 'red'
    })
  } finally {
    clearingEmails.value = false
  }
}

async function clearLogs() {
  if (
    !confirm(
      'Are you sure you want to clear all logs for this agent? This action cannot be undone.'
    )
  ) {
    return
  }

  clearingLogs.value = true
  try {
    const result = await $fetch(`/api/agents/${agentId.value}/clear-logs`, { method: 'POST' })
    console.log('Logs cleared:', result)

    // Refresh the logs data
    await refreshLogs()

    // Show success message
    const toast = useToast()
    toast.add({
      title: 'Logs Cleared',
      description: `Cleared ${result.deletedCount} logs`,
      color: 'green'
    })
  } catch (error) {
    console.error('Failed to clear logs:', error)
    const toast = useToast()
    toast.add({
      title: 'Error',
      description: 'Failed to clear logs',
      color: 'red'
    })
  } finally {
    clearingLogs.value = false
  }
}

async function clearAll() {
  if (
    !confirm(
      'Are you sure you want to clear ALL emails and logs for this agent? This action cannot be undone.'
    )
  ) {
    return
  }

  clearingAll.value = true
  try {
    const result = await $fetch(`/api/agents/${agentId.value}/clear-all`, { method: 'POST' })
    console.log('All data cleared:', result)

    // Refresh both email and logs data
    await refreshEmails()
    await refreshLogs()

    // Show success message
    const toast = useToast()
    toast.add({
      title: 'All Data Cleared',
      description: `Cleared ${result.deletedCount} items (${result.emails} emails, ${result.mailLogs} mail logs, ${result.activityLogs} activity logs)`,
      color: 'green'
    })
  } catch (error) {
    console.error('Failed to clear all data:', error)
    const toast = useToast()
    toast.add({
      title: 'Error',
      description: 'Failed to clear all data',
      color: 'red'
    })
  } finally {
    clearingAll.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="agent-detail">
    <UDashboardNavbar :title="agent?.name">
      <template #leading>
        <UDashboardSidebarCollapse />
      </template>
      <template #trailing>
        <div class="flex items-center gap-2">
          <UAvatar v-bind="agent?.avatar" size="sm" />
          <UBadge variant="subtle">{{ agent?.role }}</UBadge>
          <UButton
            icon="i-lucide-trash-2"
            color="red"
            variant="outline"
            :loading="clearingAll"
            @click="clearAll"
          >
            Clear All
          </UButton>
          <UButton icon="i-lucide-shield" color="neutral" variant="outline" @click="goToMailPolicy">
            Mail Policy
          </UButton>
          <UButton icon="i-lucide-pencil" color="neutral" variant="outline" @click="openEdit" />
          <UButton icon="i-lucide-trash" color="error" variant="outline" @click="deleteAgent" />
        </div>
      </template>
      <template #right>
        <UTabs v-model="selectedTab" :items="tabItems" :content="false" size="xs" />
      </template>
    </UDashboardNavbar>

    <div class="p-4">
      <!-- Mailbox Content -->
      <div v-if="selectedTab !== 'log'">
        <UCard>
          <div class="flex items-center justify-between">
            <div class="min-w-0">
              <h3 class="font-medium text-highlighted">Mailbox</h3>
              <p class="text-sm text-muted truncate">{{ agent?.email }}</p>
            </div>
            <div class="flex items-center gap-2">
              <UButton
                icon="i-lucide-refresh-ccw"
                label="Refresh"
                color="neutral"
                variant="outline"
                :loading="emailsPending"
                @click="refreshEmails"
              />
              <UButton
                icon="i-lucide-trash-2"
                label="Clear Emails"
                color="red"
                variant="outline"
                :loading="clearingEmails"
                @click="clearEmails"
              />
            </div>
          </div>
          <div class="mt-4">
            <div v-if="emailsPending" class="space-y-2">
              <USkeleton class="h-4 w-full" />
              <USkeleton class="h-4 w-3/4" />
              <USkeleton class="h-4 w-2/3" />
            </div>
            <InboxList
              v-else-if="combinedMails.length > 0"
              v-model="selectedMail"
              :mails="combinedMails || []"
            />
            <div v-else class="flex flex-1 items-center justify-center py-12">
              <div class="text-center">
                <UIcon name="i-lucide-inbox" class="size-16 text-dimmed mx-auto mb-4" />
                <p class="text-muted">
                  {{
                    selectedTab === 'incoming'
                      ? 'No incoming emails'
                      : selectedTab === 'outgoing'
                        ? 'No outgoing emails sent yet'
                        : 'No emails'
                  }}
                </p>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Comprehensive Activity Log Content -->
      <div v-if="selectedTab === 'log'">
        <UCard>
          <div class="flex items-center justify-between">
            <h3 class="font-medium text-highlighted">Agent Activity Log</h3>
            <div class="flex items-center gap-2">
              <UBadge variant="subtle">{{ logs.length }} Activities</UBadge>
              <UButton
                icon="i-lucide-refresh-cw"
                size="xs"
                variant="ghost"
                :loading="logsPending"
                @click="refreshLogs"
                >Refresh</UButton
              >
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="red"
                variant="outline"
                :loading="clearingLogs"
                @click="clearLogs"
                >Clear Logs</UButton
              >
            </div>
          </div>
          <div v-if="logsPending" class="mt-4 space-y-2">
            <USkeleton class="h-4 w-full" />
            <USkeleton class="h-4 w-3/4" />
            <USkeleton class="h-4 w-2/3" />
          </div>
          <div v-else-if="logs.length === 0" class="mt-4 text-sm text-muted">
            No activities logged yet.
          </div>
          <div v-else class="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div
              v-for="(entry, idx) in logs"
              :key="entry.id || idx"
              class="border rounded p-4 text-sm"
            >
              <!-- Header with type and timestamp -->
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <UBadge
                    :color="
                      entry.type === 'mcp_usage'
                        ? 'blue'
                        : entry.type === 'ai_usage'
                          ? 'green'
                          : 'orange'
                    "
                    variant="subtle"
                  >
                    {{
                      entry.type === 'mcp_usage'
                        ? 'MCP'
                        : entry.type === 'ai_usage'
                          ? 'AI'
                          : 'Email'
                    }}
                  </UBadge>
                  <span class="font-medium text-sm">
                    {{
                      entry.type === 'mcp_usage'
                        ? `${entry.serverName || entry.serverId}`
                        : entry.type === 'ai_usage'
                          ? `${entry.model || 'OpenAI'}`
                          : `${entry.direction || 'Email'} Activity`
                    }}
                  </span>
                </div>
                <span class="text-muted text-xs">{{ formatTs(entry.timestamp) }}</span>
              </div>

              <!-- MCP Usage Details -->
              <div v-if="entry.type === 'mcp_usage'" class="space-y-2">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <div class="font-medium text-xs text-muted">INPUT</div>
                    <div class="text-xs">
                      <div><strong>Query:</strong> {{ entry.input?.query || 'N/A' }}</div>
                      <div v-if="entry.input?.parameters?.limit">
                        <strong>Limit:</strong> {{ entry.input.parameters.limit }}
                      </div>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div class="font-medium text-xs text-muted">OUTPUT</div>
                    <div class="text-xs">
                      <div>
                        <strong>Success:</strong>
                        <span :class="entry.output?.success ? 'text-green-600' : 'text-red-600'">
                          {{ entry.output?.success ? 'Yes' : 'No' }}
                        </span>
                      </div>
                      <div v-if="entry.output?.error" class="text-red-600">
                        <strong>Error:</strong> {{ entry.output.error }}
                      </div>
                      <div v-if="entry.metadata?.responseTime">
                        <strong>Response Time:</strong> {{ entry.metadata.responseTime }}ms
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-if="entry.output?.result && typeof entry.output.result === 'object'"
                  class="mt-2"
                >
                  <div class="font-medium text-xs text-muted mb-1">RESULT SUMMARY</div>
                  <div class="text-xs bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                    {{
                      (entry.output.result as any)?.summary ||
                      JSON.stringify(entry.output.result).slice(0, 200) + '...'
                    }}
                  </div>
                </div>
              </div>

              <!-- AI Usage Details -->
              <div v-if="entry.type === 'ai_usage'" class="space-y-2">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <div class="font-medium text-xs text-muted">INPUT</div>
                    <div class="text-xs">
                      <div><strong>Model:</strong> {{ entry.model || 'N/A' }}</div>
                      <div><strong>Messages:</strong> {{ entry.input?.messages?.length || 0 }}</div>
                      <div v-if="entry.input?.temperature">
                        <strong>Temperature:</strong> {{ entry.input.temperature }}
                      </div>
                      <div v-if="entry.input?.maxTokens">
                        <strong>Max Tokens:</strong> {{ entry.input.maxTokens }}
                      </div>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div class="font-medium text-xs text-muted">OUTPUT</div>
                    <div class="text-xs">
                      <div>
                        <strong>Success:</strong>
                        <span :class="entry.output?.success ? 'text-green-600' : 'text-red-600'">
                          {{ entry.output?.success ? 'Yes' : 'No' }}
                        </span>
                      </div>
                      <div v-if="entry.output?.error" class="text-red-600">
                        <strong>Error:</strong> {{ entry.output.error }}
                      </div>
                      <div v-if="entry.metadata?.responseTime">
                        <strong>Response Time:</strong> {{ entry.metadata.responseTime }}ms
                      </div>
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                  <div v-if="entry.tokens?.prompt" class="text-xs">
                    <div class="font-medium text-muted">Prompt Tokens</div>
                    <div>{{ entry.tokens.prompt }}</div>
                  </div>
                  <div v-if="entry.tokens?.completion" class="text-xs">
                    <div class="font-medium text-muted">Completion Tokens</div>
                    <div>{{ entry.tokens.completion }}</div>
                  </div>
                  <div v-if="entry.tokens?.total" class="text-xs">
                    <div class="font-medium text-muted">Total Tokens</div>
                    <div class="font-medium">{{ entry.tokens.total }}</div>
                  </div>
                </div>
                <div v-if="entry.output?.result" class="mt-2">
                  <div class="font-medium text-xs text-muted mb-1">AI RESPONSE</div>
                  <div class="text-xs bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                    {{ entry.output.result.slice(0, 300)
                    }}{{ entry.output.result.length > 300 ? '...' : '' }}
                  </div>
                </div>
              </div>

              <!-- Email Activity Details -->
              <div v-if="entry.type === 'email_activity'" class="space-y-2">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div class="space-y-1">
                    <div class="font-medium text-xs text-muted">EMAIL DETAILS</div>
                    <div class="text-xs">
                      <div>
                        <strong>Direction:</strong>
                        <span
                          :class="
                            entry.direction === 'inbound' ? 'text-blue-600' : 'text-green-600'
                          "
                        >
                          {{ entry.direction === 'inbound' ? 'Incoming' : 'Outgoing' }}
                        </span>
                      </div>
                      <div v-if="entry.email?.messageId">
                        <strong>Message ID:</strong> {{ entry.email.messageId }}
                      </div>
                      <div v-if="entry.email?.from">
                        <strong>From:</strong> {{ entry.email.from }}
                      </div>
                      <div v-if="entry.email?.to"><strong>To:</strong> {{ entry.email.to }}</div>
                    </div>
                  </div>
                  <div class="space-y-1">
                    <div class="font-medium text-xs text-muted">STATUS</div>
                    <div class="text-xs">
                      <div v-if="entry.email?.subject">
                        <strong>Subject:</strong> {{ entry.email.subject }}
                      </div>
                      <div v-if="entry.metadata?.mailgunSent !== undefined">
                        <strong>Mailgun Sent:</strong>
                        <span :class="entry.metadata.mailgunSent ? 'text-green-600' : 'text-muted'">
                          {{ entry.metadata.mailgunSent ? 'Yes' : 'No' }}
                        </span>
                      </div>
                      <div v-if="entry.metadata?.isAutomatic !== undefined">
                        <strong>Automatic:</strong>
                        <span
                          :class="entry.metadata.isAutomatic ? 'text-blue-600' : 'text-orange-600'"
                        >
                          {{ entry.metadata.isAutomatic ? 'Yes' : 'No' }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="entry.email?.body" class="mt-2">
                  <div class="font-medium text-xs text-muted mb-1">EMAIL BODY</div>
                  <div class="text-xs bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                    {{ entry.email.body.slice(0, 300)
                    }}{{ entry.email.body.length > 300 ? '...' : '' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </UDashboardPanel>

  <InboxMail v-if="selectedMail" :mail="selectedMail" @close="selectedMail = null" />

  <AgentsEditAgentModal
    :open="editOpen"
    :agent="editAgent"
    @update:open="
      (v: boolean) => {
        editOpen = v
      }
    "
    @saved="refresh"
  />
</template>
