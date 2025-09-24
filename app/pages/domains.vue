<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Component } from 'vue'

const { data: settings } = await useFetch<{ mailgunApiKey?: string }>('/api/settings', { server: false })
const { data: domains, refresh } = await useAsyncData('mailgun-domains', async () => {
  const res = await $fetch<{ ok: boolean, error?: string, domains: { name: string, state: string, created_at: string }[] }>('/api/mailgun/domains')
  return res
}, { server: false })

// Component refs for render functions
const UButton = resolveComponent('UButton') as Component
const UBadge = resolveComponent('UBadge') as Component

const columns: TableColumn<{ name: string, state: string, created_at: string }>[] = [
  {
    accessorKey: 'name',
    header: 'Domain',
    cell: ({ row }) => h('div', { class: 'flex items-center justify-between gap-2' }, [
      h('span', { class: 'truncate' }, row.original.name),
      h('div', { class: 'ms-auto flex items-center gap-1.5' }, [
        canSend(row.original.state)
          ? h(UButton, { icon: 'i-lucide-mail', color: 'primary', variant: 'ghost', size: 'xs', onClick: () => openSend(row.original) })
          : null,
        h(UButton, { icon: 'i-lucide-pencil', color: 'neutral', variant: 'ghost', size: 'xs', onClick: () => openEdit(row.original) }),
        h(UButton, { icon: 'i-lucide-trash', color: 'error', variant: 'ghost', size: 'xs', onClick: () => openDelete(row.original) })
      ])
    ])
  },
  {
    accessorKey: 'state',
    header: 'Status',
    cell: ({ row }) => h(UBadge, { variant: 'subtle', color: statusColor(row.original.state) }, () => row.original.state)
  },
  { accessorKey: 'created_at', header: 'Added' }
]

function statusColor(status: string) {
  return status === 'active' || status === 'verified' ? 'success' : status === 'unknown' ? 'warning' : 'error'
}

const hasKey = computed(() => !!settings.value?.mailgunApiKey)

function canSend(state?: string) {
  const s = String(state || '').toLowerCase()
  return s === 'active' || s === 'verified'
}

const addOpen = ref(false)
const editOpen = ref(false)
const deleteOpen = ref(false)
const sendOpen = ref(false)
const selectedDomain = ref<{
  name?: string
  smtp_password?: string
  spam_action?: string
} | null>(null)

function openEdit(row: { name: string }) {
  selectedDomain.value = { name: row.name }
  editOpen.value = true
}

function openDelete(row: { name: string }) {
  selectedDomain.value = { name: row.name }
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!selectedDomain.value?.name) return
  await $fetch(`/api/mailgun/domains/${encodeURIComponent(selectedDomain.value.name)}`, { method: 'DELETE' })
  deleteOpen.value = false
  selectedDomain.value = null
  await refresh()
}

function openSend(row: { name: string }) {
  selectedDomain.value = { name: row.name }
  sendOpen.value = true
}

function onSent() {
  useToast().add({ title: 'Sent', description: 'Test email sent.', color: 'success', icon: 'i-lucide-check' })
}
</script>

<template>
  <UDashboardPanel id="domains">
    <template #header>
      <UDashboardNavbar title="Domains">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="Add Domain" color="neutral" @click="addOpen = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <ClientOnly>
        <UCard v-show="!hasKey">
          <div class="flex items-center justify-between">
            <div class="min-w-0">
              <h3 class="font-medium text-highlighted">Mailgun not configured</h3>
              <p class="text-sm text-muted truncate">Add your Mailgun API key in Settings to view domains.</p>
            </div>
            <UButton to="/settings/ai" label="Open Settings" color="neutral" />
          </div>
        </UCard>

        <UCard v-show="hasKey">
          <div class="flex items-center justify-between mb-3">
            <div class="text-sm text-muted">{{ domains?.domains?.length || 0 }} domain(s)</div>
            <UButton icon="i-lucide-refresh-ccw" label="Refresh" color="neutral" variant="outline" @click="refresh" />
          </div>
          <UTable
            :data="domains?.domains || []"
            :columns="columns"
            :ui="{ base: 'table-fixed border-separate border-spacing-0', thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none', tbody: '[&>tr]:last:[&>td]:border-b-0', th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r', td: 'border-b border-default' }"
          />
        </UCard>
      </ClientOnly>
    </template>
  </UDashboardPanel>

  <DomainsEditDomainModal :open="addOpen" :domain="null" mode="add" @update:open="(v: boolean) => { addOpen = v }" @saved="refresh" />
  <DomainsEditDomainModal :open="editOpen" :domain="selectedDomain" mode="edit" @update:open="(v: boolean) => { editOpen = v }" @saved="refresh" />
  <DomainsSendTestModal :open="sendOpen" :domain="selectedDomain?.name || null" @update:open="(v: boolean) => { sendOpen = v }" @sent="onSent" />

  <UModal v-model:open="deleteOpen">
    <template #content>
      <UCard>
        <h3 class="font-medium text-highlighted mb-2">Delete domain</h3>
        <p class="text-sm">Are you sure you want to delete <strong>{{ selectedDomain?.name }}</strong>?</p>
        <div class="mt-4 flex items-center gap-2 justify-end">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="deleteOpen = false" />
          <UButton label="Delete" color="error" @click="confirmDelete" />
        </div>
      </UCard>
    </template>
  </UModal>
 </template>
