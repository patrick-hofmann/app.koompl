<script setup lang="ts">
import { h, reactive, ref, computed, watch } from 'vue'
import type { Agent } from '~/types'
import type { TableColumn, NavigationMenuItem } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'

definePageMeta({
  title: 'My Koompls'
})

const UAvatar = resolveComponent('UAvatar')
const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')

const toast = useToast()
const { session } = await useUserSession()

// Get team domain
const { data: teamData } = await useAsyncData(
  'team-domain-custom',
  () => $fetch<{ teamId: string; teamName: string; domain: string | null }>('/api/team/domain'),
  { server: false, lazy: true }
)
const teamDomain = computed(
  () => teamData.value?.domain || session.value?.team?.domain || 'agents.local'
)

// Helper to construct full email
function constructFullEmail(username: string): string {
  return `${username}@${teamDomain.value}`
}

// Fetch all agents and filter to custom only
const { data: agents, refresh } = await useAsyncData(
  'agents-custom',
  () => $fetch<Agent[]>('/api/agents'),
  { server: false, lazy: true }
)

// Filter to custom only and add full email
const customAgents = computed(() => {
  return (agents.value?.filter((agent) => !agent.isPredefined) || []).map((agent) => ({
    ...agent,
    fullEmail: constructFullEmail(agent.email)
  }))
})

// Add modal state
const addOpen = ref(false)
const addAgent = reactive<Partial<Agent>>({})

function openAdd() {
  Object.assign(addAgent, {
    name: '',
    email: '',
    role: 'Agent',
    prompt: '',
    multiRoundConfig: {
      enabled: true,
      maxRounds: 1,
      timeoutMinutes: 30,
      canCommunicateWithAgents: false,
      allowedAgentEmails: [],
      autoResumeOnResponse: true,
      mailPolicy: {
        inbound: 'team_and_agents',
        outbound: 'team_and_agents',
        allowedInboundAddresses: [],
        allowedOutboundAddresses: []
      }
    },
    mcpServerIds: []
  })
  addOpen.value = true
}

// Edit modal state
const editOpen = ref(false)
const editAgent = reactive<Partial<Agent>>({})

function openEdit(agent: Agent) {
  Object.assign(editAgent, agent)
  editOpen.value = true
}

// Delete modal state
const deleteOpen = ref(false)
const deleteId = ref<string | null>(null)

function openDelete(id: string) {
  deleteId.value = id
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!deleteId.value) return

  try {
    await $fetch(`/api/agents/${deleteId.value}`, { method: 'DELETE' })
    toast.add({
      title: 'Koompl deleted',
      color: 'success',
      icon: 'i-lucide-check'
    })
    deleteOpen.value = false
    deleteId.value = null
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Failed to delete koompl',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  }
}

// Test modals
const testOpen = ref(false)
const testAgentId = ref<string | null>(null)
const roundTripOpen = ref(false)
const roundTripAgentId = ref<string | null>(null)

// Table setup
const table = useTemplateRef('table')
const columnFilters = ref([{ id: 'email', value: '' }])
const columnVisibility = ref()
const rowSelection = ref<Record<string, boolean>>({})
const pagination = ref({
  pageIndex: 0,
  pageSize: 10
})

function getRowItems(row: Row<Agent & { fullEmail: string }>) {
  return [
    { type: 'label', label: 'Actions' },
    {
      label: 'View mailbox',
      icon: 'i-lucide-mail',
      onSelect() {
        navigateTo(`/agents/${row.original.id}`)
      }
    },
    {
      label: 'Open details',
      icon: 'i-lucide-list',
      onSelect() {
        navigateTo(`/agents/${row.original.id}`)
      }
    },
    {
      label: 'Test prompt',
      icon: 'i-lucide-flask-conical',
      onSelect() {
        testAgentId.value = row.original.id
        testOpen.value = true
      }
    },
    {
      label: 'Test round-trip',
      icon: 'i-lucide-rotate-ccw',
      onSelect() {
        roundTripAgentId.value = row.original.id
        roundTripOpen.value = true
      }
    },
    { type: 'separator' as const },
    {
      label: 'Mail policy',
      icon: 'i-lucide-shield',
      onSelect() {
        navigateTo(`/agents/${row.original.id}/policy`)
      }
    },
    {
      label: 'Edit',
      icon: 'i-lucide-pencil',
      onSelect() {
        openEdit(row.original)
      }
    },
    {
      label: 'Delete',
      icon: 'i-lucide-trash',
      color: 'error',
      onSelect() {
        openDelete(row.original.id)
      }
    }
  ]
}

const columns: TableColumn<Agent & { fullEmail: string }>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        ariaLabel: 'Select all'
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        ariaLabel: 'Select row'
      })
  },
  { accessorKey: 'id', header: 'ID' },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-3' }, [
        h(UAvatar, { ...row.original.avatar, size: 'lg' }),
        h('div', undefined, [
          h('p', { class: 'font-medium text-highlighted' }, row.original.name),
          h('p', undefined, `@${row.original.id}`)
        ])
      ])
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => h('span', {}, row.original.fullEmail)
  },
  {
    id: 'mailbox',
    header: 'Mailbox',
    cell: ({ row }) =>
      h(UButton, {
        icon: 'i-lucide-mail',
        size: 'xs',
        variant: 'ghost',
        color: 'primary',
        onClick: () => navigateTo(`/agents/${row.original.id}`)
      })
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => h(UBadge, { variant: 'subtle' }, () => row.original.role)
  },
  {
    accessorKey: 'prompt',
    header: 'Prompt',
    cell: ({ row }) => h('p', { class: 'truncate max-w-80' }, row.original.prompt)
  },
  {
    id: 'actions',
    cell: ({ row }) =>
      h(
        'div',
        { class: 'text-right' },
        h(UDropdownMenu, { content: { align: 'end' }, items: getRowItems(row) }, () =>
          h(UButton, {
            icon: 'i-lucide-ellipsis-vertical',
            color: 'neutral',
            variant: 'ghost',
            size: 'sm'
          })
        )
      )
  }
]

const actions = ref<NavigationMenuItem[]>([])

function updateActions() {
  const items = customAgents.value.map((agent) => ({
    label: agent.name,
    icon: 'i-lucide-mail',
    to: `/agents/${agent.id}`
  }))

  actions.value = [
    {
      label: 'View Mailboxes',
      icon: 'i-lucide-mail-open',
      children: items.length > 0 ? items : undefined
    }
  ]
}

watch(customAgents, updateActions, { immediate: true })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="My Koompls">
        <template #description> Create and manage your custom Koompls </template>
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UNavigationMenu :items="actions" />
          <UButton label="Create Koompl" icon="i-lucide-plus" class="ml-2" @click="openAdd" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">Custom Koompls</h2>
            <p class="text-sm text-muted">Your custom-created Koompls with full control</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-1.5 mb-4">
          <UInput
            :model-value="table?.tableApi?.getColumn('email')?.getFilterValue() as string"
            class="max-w-sm"
            icon="i-lucide-search"
            placeholder="Filter emails..."
            @update:model-value="table?.tableApi?.getColumn('email')?.setFilterValue($event)"
          />

          <div class="flex items-center gap-1.5">
            <UButton label="Add Custom Koompl" icon="i-lucide-plus" @click="openAdd" />
          </div>
        </div>

        <UTable
          ref="table"
          v-model:column-filters="columnFilters"
          v-model:column-visibility="columnVisibility"
          v-model:row-selection="rowSelection"
          v-model:pagination="pagination"
          :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
          class="shrink-0"
          :data="customAgents"
          :columns="columns"
          :ui="{
            base: 'table-fixed border-separate border-spacing-0',
            thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
            tbody: '[&>tr]:last:[&>td]:border-b-0',
            th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
            td: 'border-b border-default'
          }"
        />
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add Modal -->
  <AgentsEditAgentModal
    :open="addOpen"
    :agent="addAgent"
    mode="create"
    @update:open="(v: boolean) => (addOpen = v)"
    @saved="refresh"
  />

  <!-- Edit Modal -->
  <AgentsEditAgentModal
    :open="editOpen"
    :agent="editAgent"
    @update:open="(v: boolean) => (editOpen = v)"
    @saved="refresh"
  />

  <!-- Test Agent Modal -->
  <AgentsTestAgentModal
    :open="testOpen"
    :agent-id="testAgentId"
    @update:open="(v: boolean) => (testOpen = v)"
  />

  <!-- Round-trip Test Modal -->
  <AgentsRoundTripAgentModal
    :open="roundTripOpen"
    :agent-id="roundTripAgentId"
    @update:open="(v: boolean) => (roundTripOpen = v)"
  />

  <!-- Delete Confirmation Modal -->
  <UModal
    v-model:open="deleteOpen"
    title="Delete Koompl"
    description="Are you sure you want to delete this koompl?"
  >
    <template #content>
      <UCard>
        <h3 class="font-medium text-highlighted mb-2">Delete Koompl</h3>
        <p class="text-sm">
          Are you sure you want to delete this koompl? This action cannot be undone.
        </p>
        <div class="mt-4 flex items-center gap-2 justify-end">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="deleteOpen = false" />
          <UButton label="Delete" color="error" @click="confirmDelete" />
        </div>
      </UCard>
    </template>
  </UModal>
</template>
