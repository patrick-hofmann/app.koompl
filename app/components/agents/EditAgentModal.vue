<script setup lang="ts">
import type { Agent, McpServer } from '~/types'

interface Props {
  open: boolean
  agent: Partial<Agent> | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved'): void
}>()

const local = reactive<Partial<Agent>>({
  mcpServerIds: []
})

type StoredMcpServer = McpServer & {
  createdAt: string
  updatedAt: string
}

const { data: mcpResponse, pending: mcpPending, refresh: refreshMcp } = await useAsyncData('mcp-servers-lite', async () => {
  const result = await $fetch<{ servers: StoredMcpServer[] }>('/api/mcp')
  return result.servers
}, { server: false, lazy: true })

const mcpServers = computed(() => mcpResponse.value ?? [])
const mcpOptions = computed(() => mcpServers.value.map(server => ({
  label: `${server.name} (${server.provider})`,
  value: server.id
})))

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
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    resetLocal(props.agent)
    refreshMcp()
  }
}, { immediate: true })

watch(() => props.agent && (props.agent as Partial<Agent>).id, () => {
  if (props.open) {
    resetLocal(props.agent)
    refreshMcp()
  }
})

async function save() {
  if (!local.id) return
  await $fetch(`/api/agents/${local.id}`, { method: 'PATCH', body: local })
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
  <UModal title="Edit Koompl" description="Edit the Koompl settings" :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard>
        <h3 class="font-medium text-highlighted mb-2">Edit Koompl</h3>
        <UForm :state="local" @submit="save">
          <div class="space-y-3">
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
              <USelectMenu
                v-model="(local.mcpServerIds as string[] | undefined)"
                multiple
                :options="mcpOptions"
                :loading="mcpPending"
                value-attribute="value"
                option-attribute="label"
                placeholder="Server auswählen"
              >
                <template #empty>
                  <div class="px-2 py-3 text-sm text-muted space-y-1">
                    <p>Keine MCP Server vorhanden.</p>
                    <NuxtLink to="/mcp" class="underline">MCP Server verwalten</NuxtLink>
                  </div>
                </template>
              </USelectMenu>
            </UFormField>
            <div class="flex items-center gap-2">
              <UAvatar v-bind="local.avatar" />
              <UButton icon="i-lucide-refresh-ccw" label="Refresh avatar" color="neutral" variant="outline" @click="refreshAvatar" />
            </div>
            <div class="flex items-center gap-2 justify-end">
              <UButton label="Cancel" color="neutral" variant="ghost" @click="emit('update:open', false)" />
              <UButton type="submit" label="Save" />
            </div>
          </div>
        </UForm>
      </UCard>
    </template>
  </UModal>
</template>
