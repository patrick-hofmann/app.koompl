<script setup lang="ts">
import type { Agent, Mail } from '~/types'

const route = useRoute()
const agentId = computed(() => String(route.params.id))

// Client-only lazy fetch to avoid SSR blocking on storage
const { data: agent, refresh, pending: _unusedPending } = await useAsyncData(() => `agent-${agentId.value}`,
  () => $fetch<Agent>(`/api/agents/${agentId.value}`),
  { server: false, lazy: true }
)

// Static mock mailbox: reuse server API route to keep UI consistent
const { data: mails } = await useFetch<Mail[]>('/api/mails', { default: () => [] })

// Tabs: All / Incoming / Outgoing / Log
const tabItems = [{ label: 'All', value: 'all' }, { label: 'Incoming', value: 'incoming' }, { label: 'Outgoing', value: 'outgoing' }, { label: 'Log', value: 'log' }]
const selectedTab = ref('all')

// Create a few mock outgoing mails authored by the agent
const outgoingMails = computed<Mail[]>(() => {
  if (!agent.value) return []
  const from = { id: 0, name: agent.value.name, email: agent.value.email, avatar: agent.value.avatar as Record<string, unknown> | undefined }
  return [
    { id: 10001, from, subject: 'Re: Weekly priorities', body: 'Thanks, aligned on priorities. I booked a follow-up.', date: new Date().toISOString() },
    { id: 10002, from, subject: 'Outreach draft to partner', body: 'Here is a proposed outreach draft. Thoughts?', date: new Date(Date.now() - 3600_000).toISOString() }
  ]
})

const combinedMails = computed<Mail[]>(() => {
  if (selectedTab.value === 'incoming') return mails.value || []
  if (selectedTab.value === 'outgoing') return outgoingMails.value
  if (selectedTab.value === 'log') return []
  return [...(mails.value || []), ...outgoingMails.value]
})

type AgentLogEntry = {
  timestamp?: string
  type?: string
  messageId?: string
  to?: string
  from?: string
  subject?: string
  agentId?: string
  mcpServerIds?: string[]
  mcpContextCount?: number
  mailgunSent?: boolean
  domainFiltered?: boolean
}

const { data: logsData, pending: logsPending, refresh: refreshLogs } = await useAsyncData(
  () => `agent-logs-${agentId.value}`,
  async () => {
    const res = await $fetch<{ ok: boolean, items: AgentLogEntry[] }>(`/api/agents/logs`, {
      query: { agentId: agentId.value, limit: 200 }
    })
    return res.items || []
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

// edit is handled by shared modal now

async function deleteAgent() {
  await $fetch(`/api/agents/${agentId.value}`, { method: 'DELETE' })
  await navigateTo('/agents')
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
            <UButton icon="i-lucide-refresh-ccw" label="Refresh" color="neutral" variant="outline" />
          </div>
          <div class="mt-4">
            <InboxList v-if="combinedMails.length > 0" v-model="selectedMail" :mails="combinedMails || []" />
            <div v-else class="flex flex-1 items-center justify-center py-12">
              <div class="text-center">
                <UIcon name="i-lucide-inbox" class="size-16 text-dimmed mx-auto mb-4" />
                <p class="text-muted">
                  {{ selectedTab === 'incoming' ? 'No incoming emails' : selectedTab === 'outgoing' ? 'No outgoing emails' : 'No emails' }}
                </p>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- MCP Log Content -->
      <div v-if="selectedTab === 'log'">
        <UCard>
          <div class="flex items-center justify-between">
            <h3 class="font-medium text-highlighted">Mail & MCP Log</h3>
            <div class="flex items-center gap-2">
              <UBadge variant="subtle">{{ logs.length }} Einträge</UBadge>
              <UButton icon="i-lucide-refresh-cw" size="xs" variant="ghost" :loading="logsPending" @click="refreshLogs">Aktualisieren</UButton>
            </div>
          </div>
          <div v-if="logsPending" class="mt-4 space-y-2">
            <USkeleton class="h-4 w-full" />
            <USkeleton class="h-4 w-3/4" />
            <USkeleton class="h-4 w-2/3" />
          </div>
          <div v-else-if="logs.length === 0" class="mt-4 text-sm text-muted">Noch keine Aktivitäten protokolliert.</div>
          <div v-else class="mt-4 space-y-3">
            <div v-for="(entry, idx) in logs" :key="idx" class="border rounded p-3 text-xs">
              <div class="flex items-center justify-between">
                <span class="font-medium">{{ entry.type || 'event' }}</span>
                <span class="text-muted">{{ formatTs(entry.timestamp) }}</span>
              </div>
              <div class="mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div class="space-y-0.5">
                  <div v-if="entry.messageId">Message-ID: <span class="text-muted">{{ entry.messageId }}</span></div>
                  <div v-if="entry.to">To: <span class="text-muted">{{ entry.to }}</span></div>
                  <div v-if="entry.from">From: <span class="text-muted">{{ entry.from }}</span></div>
                  <div v-if="entry.subject">Subject: <span class="text-muted truncate inline-block max-w-full">{{ entry.subject }}</span></div>
                </div>
                <div class="space-y-0.5">
                  <div>MCP Servers: <span class="text-muted">{{ (entry.mcpServerIds || []).join(', ') }}</span></div>
                  <div>MCP Contexts: <span class="text-muted">{{ entry.mcpContextCount || 0 }}</span></div>
                  <div>Mailgun sent: <span :class="entry.mailgunSent ? 'text-green-600' : 'text-muted'">{{ entry.mailgunSent ? 'yes' : 'no' }}</span></div>
                  <div>Domain filtered: <span :class="entry.domainFiltered ? 'text-red-600' : 'text-muted'">{{ entry.domainFiltered ? 'yes' : 'no' }}</span></div>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </UDashboardPanel>

  <InboxMail v-if="selectedMail" :mail="selectedMail" @close="selectedMail = null" />

  <AgentsEditAgentModal :open="editOpen" :agent="editAgent" @update:open="(v: boolean) => { editOpen = v }" @saved="refresh" />
 </template>
