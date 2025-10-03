<script setup lang="ts">
import type { NavigationMenuItem, TableColumn } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { Row } from '@tanstack/table-core'
import type { PredefinedKoompl } from '~/composables/usePredefinedKoompls'

const UAvatar = resolveComponent('UAvatar')
const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const UDropdownMenu = resolveComponent('UDropdownMenu')
const UCheckbox = resolveComponent('UCheckbox')

// Predefined Koompls
const { getPredefinedKoompls, predefinedToAgent } = usePredefinedKoompls()
const predefinedKoompls = getPredefinedKoompls()

// Get team domain
const { session } = await useUserSession()
const { data: teamData } = await useAsyncData(
  'team-domain-agents',
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

// Client-only lazy fetch to avoid SSR blocking on storage
const { data: agents, refresh } = await useAsyncData(
  'agents',
  () => $fetch<Agent[]>('/api/agents'),
  { server: false, lazy: true }
)

// Filter out predefined agents from the main list and add full email
const customAgents = computed(() => {
  return (agents.value?.filter((agent) => !agent.isPredefined) || []).map((agent) => ({
    ...agent,
    fullEmail: constructFullEmail(agent.email)
  }))
})

// Track which predefined Koompls are enabled and get actual agent data
const enabledPredefined = computed(() => {
  const agentsList = agents.value || []
  return predefinedKoompls.map((pk) => {
    const actualAgent = agentsList.find((a) => a.id === pk.id && a.isPredefined)
    const username = actualAgent?.email || pk.email.split('@')[0]
    return {
      ...pk,
      // Use actual username and construct full email
      email: username,
      fullEmail: constructFullEmail(username),
      enabled: !!actualAgent
    }
  })
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
      enabled: true, // Always enabled in unified architecture
      maxRounds: 1, // Default to 1 for simple agents
      timeoutMinutes: 30, // Default 30 minutes
      canCommunicateWithAgents: false,
      allowedAgentEmails: [],
      autoResumeOnResponse: true,
      mailPolicy: {
        inbound: 'team_and_agents',
        outbound: 'team_and_agents',
        allowedInboundAddresses: [],
        allowedOutboundAddresses: []
      }
    }
  })
  addOpen.value = true
}

const actions: NavigationMenuItem[] = [
  {
    label: 'Add Koompl',
    icon: 'i-lucide-plus',
    onSelect: () => {
      openAdd()
    }
  }
]

// Edit modal state
const editOpen = ref(false)
const editAgent = reactive<Partial<Agent>>({})

function openEdit(agent: Agent) {
  Object.assign(editAgent, agent)
  editOpen.value = true
}

// async function saveEdit() {
//   if (!editAgent.id) return
//   await $fetch(`/api/agents/${editAgent.id}`, { method: 'PATCH', body: editAgent })
//   editOpen.value = false
//   await refresh()
// }

// Delete confirmation
const deleteOpen = ref(false)
const deleteId = ref<string | null>(null)
function openDelete(id: string) {
  deleteId.value = id
  deleteOpen.value = true
}
async function confirmDelete() {
  if (!deleteId.value) return
  await $fetch(`/api/agents/${deleteId.value}`, { method: 'DELETE' })
  deleteOpen.value = false
  deleteId.value = null
  await refresh()
}

// Table setup (similar to customers)
// const toast = useToast()
const table = useTemplateRef('table')

const columnFilters = ref([{ id: 'email', value: '' }])
const columnVisibility = ref()
const rowSelection = ref<Record<string, boolean>>({})

function getRowItems(row: Row<Agent>) {
  return [
    { type: 'label', label: 'Actions' },
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

const columns: TableColumn<Agent>[] = [
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
    cell: ({ row }) => h('span', {}, constructFullEmail(row.original.email))
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
            class: 'ml-auto'
          })
        )
      )
  }
]

const pagination = ref({ pageIndex: 0, pageSize: 10 })

// Test Agent modal state
const testOpen = ref(false)
const testAgentId = ref<string | null>(null)
// Round-trip modal state
const roundTripOpen = ref(false)
const roundTripAgentId = ref<string | null>(null)

// Predefined Koompl info modal
const infoOpen = ref(false)
const infoKoompl = ref<PredefinedKoompl | null>(null)

function showInfo(koompl: PredefinedKoompl) {
  infoKoompl.value = koompl
  infoOpen.value = true
}

// Test predefined Koompl prompt
function testPredefinedPrompt(koompl: PredefinedKoompl) {
  if (!koompl.enabled) return
  testAgentId.value = koompl.id
  testOpen.value = true
}

// Test predefined Koompl round-trip
function testPredefinedRoundTrip(koompl: PredefinedKoompl) {
  if (!koompl.enabled) return
  roundTripAgentId.value = koompl.id
  roundTripOpen.value = true
}

// Toggle predefined Koompl
const togglingPredefined = ref<Set<string>>(new Set())

async function togglePredefinedKoompl(koompl: PredefinedKoompl, enabled: boolean) {
  togglingPredefined.value.add(koompl.id)

  try {
    if (enabled) {
      // Enable: Create the agent
      await $fetch('/api/agents', {
        method: 'POST',
        body: predefinedToAgent(koompl)
      })
    } else {
      // Disable: Delete the agent
      await $fetch(`/api/agents/${koompl.id}`, {
        method: 'DELETE'
      })
    }
    await refresh()
  } catch (error) {
    console.error('Error toggling predefined Koompl:', error)
  } finally {
    togglingPredefined.value.delete(koompl.id)
  }
}
</script>

<template>
  <UDashboardPanel id="agents">
    <template #header>
      <UDashboardNavbar title="Koompls">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UNavigationMenu :items="actions" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Predefined Koompls Section -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-lg font-semibold text-highlighted">Predefined Koompls</h2>
              <p class="text-sm text-muted">Enable specialized Koompls for your team</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AgentsPredefinedKoomplTile
              v-for="pk in enabledPredefined"
              :key="pk.id"
              :koompl="pk"
              :team-domain="teamDomain"
              :enabled="pk.enabled"
              :loading="togglingPredefined.has(pk.id)"
              @toggle="togglePredefinedKoompl(pk, $event)"
              @info="showInfo(pk)"
              @test-prompt="testPredefinedPrompt(pk)"
              @test-round-trip="testPredefinedRoundTrip(pk)"
            />
          </div>
        </div>

        <USeparator />

        <!-- Custom Koompls Section -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-lg font-semibold text-highlighted">Custom Koompls</h2>
              <p class="text-sm text-muted">Your custom-created Koompls</p>
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
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add Modal -->
  <AgentsEditAgentModal
    :open="addOpen"
    :agent="addAgent"
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
    description="Are you sure you want to delete the Koompl?"
  >
    <template #content>
      <UCard>
        <h3 class="font-medium text-highlighted mb-2">Delete Koompl</h3>
        <p class="text-sm">
          Are you sure you want to delete this Koompl? This action cannot be undone.
        </p>
        <div class="mt-4 flex items-center gap-2 justify-end">
          <UButton label="Cancel" color="neutral" variant="ghost" @click="deleteOpen = false" />
          <UButton label="Delete" color="error" @click="confirmDelete" />
        </div>
      </UCard>
    </template>
  </UModal>

  <!-- Predefined Koompl Info Modal -->
  <AgentsPredefinedKoomplInfoModal
    :open="infoOpen"
    :koompl="infoKoompl"
    @update:open="(v: boolean) => (infoOpen = v)"
  />
</template>
