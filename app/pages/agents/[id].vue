<script setup lang="ts">
import type { Mail } from '~/types'

const route = useRoute()
const agentId = computed(() => String(route.params.id))

// Client-only lazy fetch to avoid SSR blocking on storage
const { data: agent, refresh, pending } = await useAsyncData(() => `agent-${agentId.value}`,
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

const actionsLog = ref([
  { id: 1, time: 'Today, 09:10', action: 'Listed calendar events', server: 'Calendar MCP', status: 'success' },
  { id: 2, time: 'Today, 09:15', action: 'Created calendar entry: 1:1 with CFO', server: 'Calendar MCP', status: 'success' },
  { id: 3, time: 'Today, 09:22', action: 'Synced tasks from Linear', server: 'Linear MCP', status: 'warning' },
  { id: 4, time: 'Yesterday, 17:40', action: 'Sent weekly summary to CEO', server: 'Email MCP', status: 'success' }
])

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
            <h3 class="font-medium text-highlighted">MCP Actions Log</h3>
            <UBadge variant="subtle">Static</UBadge>
          </div>
          <div class="mt-4 space-y-3">
            <div v-for="item in actionsLog" :key="item.id" class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm text-highlighted truncate">{{ item.action }}</p>
                <p class="text-xs text-muted truncate">{{ item.time }} · {{ item.server }}</p>
              </div>
              <UBadge :color="item.status === 'success' ? 'success' : item.status === 'warning' ? 'warning' : 'neutral'" variant="subtle">{{ item.status }}</UBadge>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </UDashboardPanel>

  <InboxMail v-if="selectedMail" :mail="selectedMail" @close="selectedMail = null" />

  <AgentsEditAgentModal :open="editOpen" :agent="editAgent" @update:open="(v: boolean) => { editOpen = v }" @saved="refresh" />
 </template>
