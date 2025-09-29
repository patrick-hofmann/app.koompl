<script setup lang="ts">
import { nextTick, watch } from 'vue'
import type { McpServer, McpProvider, McpCategory } from '~/types'

type StoredMcpServer = McpServer & {
  createdAt: string
  updatedAt: string
  lastStatus?: 'ok' | 'error' | 'unknown'
  lastCheckedAt?: string | null
}

type McpProviderPreset = {
  id: McpProvider
  category: McpCategory
  defaultName: string
  defaultDescription: string
  defaultUrl?: string
  defaultAuthType: McpServer['auth']['type']
}

type ProviderField = {
  key: string
  label: string
  placeholder?: string
  type?: 'text' | 'password'
  description?: string
}

const toast = useToast()

const { data, pending, error, refresh } = await useAsyncData('mcp-servers', () =>
  $fetch<{ servers: StoredMcpServer[]; presets: McpProviderPreset[] }>('/api/mcp'),
  { server: false, lazy: true }
)

const servers = computed(() => data.value?.servers ?? [])
const presets = computed(() => data.value?.presets ?? [])
const errorMessage = computed(() => {
  const value = error.value
  if (!value) return ''
  if (value instanceof Error) return value.message
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
})

const presetMap = computed(() => new Map(presets.value.map(preset => [preset.id, preset])))

const providerOptions = computed(() => presets.value.map(preset => ({ label: preset.defaultName, value: preset.id })))

const showModal = ref(false)
const editingId = ref<string | null>(null)
const skipPresetSync = ref(false)
const isSaving = ref(false)

const form = reactive({
  id: '',
  name: '',
  provider: 'google-calendar' as McpProvider,
  category: 'calendar' as McpCategory,
  url: '',
  description: '',
  auth: {
    type: 'oauth2' as McpServer['auth']['type'],
    token: '',
    apiKey: '',
    username: '',
    password: '',
    clientId: '',
    clientSecret: '',
    scope: [] as string[]
  },
  metadata: {} as Record<string, string>
})

const providerFieldDefinitions: Record<McpProvider, ProviderField[]> = {
  'google-calendar': [
    { key: 'auth.token', label: 'OAuth Access Token', placeholder: 'ya29...', type: 'password' },
    { key: 'metadata.calendarId', label: 'Kalender-ID', placeholder: 'primary' }
  ],
  'microsoft-outlook': [
    { key: 'auth.token', label: 'Graph Access Token', placeholder: 'EwB4A...', type: 'password' },
    { key: 'metadata.mailbox', label: 'Mailbox (optional)', placeholder: 'user@domain.de' }
  ],
  'todoist': [
    { key: 'auth.token', label: 'Todoist Token', placeholder: 'xxxxxxxxxxxxxxxxxxxx', type: 'password' }
  ],
  'trello': [
    { key: 'auth.apiKey', label: 'API Key', placeholder: 'Trello API Key' },
    { key: 'auth.token', label: 'Token', placeholder: 'Trello Token', type: 'password' },
    { key: 'metadata.boardId', label: 'Board-ID', placeholder: 'abcdef1234567890' },
    { key: 'metadata.listId', label: 'Listen-ID (optional)', placeholder: 'abcdef12345678' }
  ],
  'custom': [
    { key: 'auth.token', label: 'Bearer Token (optional)', placeholder: 'token', type: 'password' },
    { key: 'metadata.method', label: 'HTTP-Methode', placeholder: 'POST' },
    { key: 'metadata.path', label: 'Endpoint Pfad', placeholder: '/context' }
  ]
}

const providerFields = computed(() => providerFieldDefinitions[form.provider] ?? providerFieldDefinitions.custom)

function titleFromProvider(provider: string) {
  return provider
    .split(/[-_]/g)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function presetFor(provider: McpProvider): McpProviderPreset {
  const preset = presetMap.value.get(provider)
  if (preset) return preset
  return {
    id: provider,
    category: 'custom' as McpCategory,
    defaultName: titleFromProvider(provider),
    defaultDescription: 'Individuelle MCP Konfiguration',
    defaultAuthType: 'bearer' as McpServer['auth']['type']
  }
}

function assignAuth(auth: Partial<McpServer['auth']> | undefined, fallbackType: McpServer['auth']['type']) {
  const scope = auth?.scope
  form.auth.type = auth?.type ?? fallbackType
  form.auth.token = auth?.token ?? ''
  form.auth.apiKey = auth?.apiKey ?? ''
  form.auth.username = auth?.username ?? ''
  form.auth.password = auth?.password ?? ''
  form.auth.clientId = auth?.clientId ?? ''
  form.auth.clientSecret = auth?.clientSecret ?? ''
  if (Array.isArray(scope)) {
    form.auth.scope = [...scope]
  } else if (typeof scope === 'string' && scope.trim().length > 0) {
    form.auth.scope = scope.split(',').map(item => item.trim()).filter(Boolean)
  } else {
    form.auth.scope = []
  }
}

function resetForm(provider: McpProvider = 'google-calendar') {
  skipPresetSync.value = true
  const preset = presetFor(provider)
  editingId.value = null
  form.id = ''
  form.provider = provider
  form.category = preset.category
  form.name = preset.defaultName
  form.url = preset.defaultUrl ?? ''
  form.description = preset.defaultDescription
  assignAuth(undefined, preset.defaultAuthType)
  form.metadata = {}
  nextTick(() => { skipPresetSync.value = false })
}

function openAdd(provider: McpProvider = 'google-calendar') {
  resetForm(provider)
  showModal.value = true
}

function openEdit(server: StoredMcpServer) {
  skipPresetSync.value = true
  editingId.value = server.id
  form.id = server.id
  form.provider = server.provider
  form.category = server.category
  form.name = server.name
  form.url = server.url ?? ''
  form.description = server.description ?? ''
  assignAuth(server.auth, server.auth.type)
  const metadata: Record<string, string> = {}
  for (const [key, value] of Object.entries(server.metadata || {})) {
    metadata[key] = typeof value === 'string' ? value : JSON.stringify(value)
  }
  form.metadata = metadata
  showModal.value = true
  nextTick(() => { skipPresetSync.value = false })
}

watch(() => form.provider, (provider) => {
  if (skipPresetSync.value) return
  const preset = presetFor(provider)
  form.category = preset.category
  form.auth.type = preset.defaultAuthType
  if (!editingId.value) {
    form.name = preset.defaultName
    form.description = preset.defaultDescription
    form.url = preset.defaultUrl ?? ''
  }
})

function getFieldValue(key: string): string {
  const [group, field] = key.split('.')
  if (!field) return ''
  if (group === 'auth') {
    const value = (form.auth as Record<string, unknown>)[field]
    if (Array.isArray(value)) return value.join(', ')
    return typeof value === 'string' ? value : ''
  }
  if (group === 'metadata') {
    const value = form.metadata[field]
    return typeof value === 'string' ? value : ''
  }
  const value = (form as Record<string, unknown>)[field]
  return typeof value === 'string' ? value : ''
}

function setFieldValue(key: string, value: string) {
  const [group, field] = key.split('.')
  if (!field) return
  if (group === 'auth') {
    if (field === 'scope') {
      form.auth.scope = value.split(',').map(item => item.trim()).filter(Boolean)
    } else {
      (form.auth as Record<string, unknown>)[field] = value
    }
    return
  }
  if (group === 'metadata') {
    form.metadata[field] = value
    return
  }
  (form as Record<string, unknown>)[field] = value
}

function buildPayload(): Partial<McpServer> {
  const metadataEntries = Object.entries(form.metadata)
    .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : ''])
    .filter(([, value]) => value.length > 0)
  const scope = form.auth.scope?.map(item => item.trim()).filter(Boolean)

  return {
    name: form.name.trim(),
    provider: form.provider,
    category: form.category,
    url: form.url.trim() || undefined,
    description: form.description.trim(),
    auth: {
      type: form.auth.type,
      token: form.auth.token.trim() || undefined,
      apiKey: form.auth.apiKey.trim() || undefined,
      username: form.auth.username.trim() || undefined,
      password: form.auth.password.trim() || undefined,
      clientId: form.auth.clientId.trim() || undefined,
      clientSecret: form.auth.clientSecret.trim() || undefined,
      scope: scope && scope.length > 0 ? scope : undefined
    },
    metadata: Object.fromEntries(metadataEntries)
  }
}

async function saveServer() {
  if (!form.name.trim()) {
    toast.add({ title: 'Name erforderlich', description: 'Bitte gib einen Namen für den MCP Server an.', color: 'error' })
    return
  }

  isSaving.value = true
  try {
    const payload = buildPayload()
    if (editingId.value) {
      await $fetch(`/api/mcp/${editingId.value}`, { method: 'PATCH', body: payload })
      toast.add({ title: 'Server aktualisiert', description: `${form.name} wurde gespeichert.`, color: 'success', icon: 'i-lucide-check' })
    } else {
      await $fetch('/api/mcp', { method: 'POST', body: payload })
      toast.add({ title: 'Server hinzugefügt', description: `${form.name} wurde erstellt.`, color: 'success', icon: 'i-lucide-check' })
    }
    showModal.value = false
    await refresh()
  } catch (err) {
    toast.add({ title: 'Speichern fehlgeschlagen', description: String(err), color: 'error', icon: 'i-lucide-alert-triangle' })
  } finally {
    isSaving.value = false
  }
}

async function testServer(server: StoredMcpServer) {
  try {
    const result = await $fetch<{ ok: boolean; summary?: string; error?: string }>(`/api/mcp/${server.id}/test`, { method: 'POST' })
    if (result.ok) {
      toast.add({ title: 'Verbindung erfolgreich', description: result.summary || 'Test erfolgreich.', color: 'success', icon: 'i-lucide-check' })
    } else {
      toast.add({ title: 'Test fehlgeschlagen', description: result.error || 'Keine Daten erhalten.', color: 'warning', icon: 'i-lucide-alert-circle' })
    }
    await refresh()
  } catch (err) {
    toast.add({ title: 'Test fehlgeschlagen', description: String(err), color: 'error', icon: 'i-lucide-bug' })
  }
}

async function deleteServer(server: StoredMcpServer) {
  if (process.client && !window.confirm(`Soll der MCP Server "${server.name}" wirklich gelöscht werden?`)) {
    return
  }
  try {
    await $fetch(`/api/mcp/${server.id}`, { method: 'DELETE' })
    toast.add({ title: 'Server entfernt', description: `${server.name} wurde gelöscht.`, color: 'success', icon: 'i-lucide-trash' })
    await refresh()
  } catch (err) {
    toast.add({ title: 'Löschen fehlgeschlagen', description: String(err), color: 'error', icon: 'i-lucide-alert-triangle' })
  }
}

function statusBadgeColor(status?: string) {
  if (status === 'ok') return 'success'
  if (status === 'error') return 'error'
  return 'neutral'
}

function statusBadgeLabel(status?: string) {
  if (status === 'ok') return 'Online'
  if (status === 'error') return 'Fehler'
  return 'Unbekannt'
}

function formatCheckedAt(value?: string | null) {
  if (!value) return 'Noch nie'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
</script>

<template>
  <UDashboardPanel id="mcp">
    <template #header>
      <UDashboardNavbar title="MCP Servers">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="Server hinzufügen" color="neutral" variant="outline" @click="openAdd()" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-alert-circle" title="Fehler beim Laden der MCP Server">
          {{ errorMessage }}
        </UAlert>

        <div v-if="pending && !servers.length" class="flex justify-center py-10">
          <USkeleton class="h-8 w-8 rounded-full" />
        </div>

        <div v-else-if="servers.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <UCard v-for="server in servers" :key="server.id" class="flex flex-col gap-4">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 space-y-1">
                <h3 class="font-medium text-highlighted truncate">{{ server.name }}</h3>
                <p class="text-sm text-muted truncate">{{ server.url || 'Keine URL hinterlegt' }}</p>
              </div>
              <div class="flex flex-col items-end gap-1">
                <UBadge variant="subtle">{{ server.provider }}</UBadge>
                <UBadge v-if="server.lastStatus" :color="statusBadgeColor(server.lastStatus)" variant="subtle">
                  {{ statusBadgeLabel(server.lastStatus) }}
                </UBadge>
              </div>
            </div>

            <p class="text-sm text-muted">
              {{ server.description || 'Keine Beschreibung vorhanden.' }}
            </p>

            <div class="text-sm space-y-1">
              <p class="flex items-center gap-2"><span class="font-medium text-highlighted">Kategorie:</span> <span class="capitalize">{{ server.category }}</span></p>
              <p class="flex items-center gap-2"><span class="font-medium text-highlighted">Zuletzt geprüft:</span> <span>{{ formatCheckedAt(server.lastCheckedAt) }}</span></p>
            </div>

            <div v-if="Object.keys(server.metadata || {}).length" class="bg-muted/40 rounded-md p-3 text-xs space-y-1">
              <p class="font-medium text-highlighted text-sm">Metadaten</p>
              <div v-for="(value, key) in server.metadata" :key="key" class="flex justify-between gap-2">
                <span class="text-muted truncate">{{ key }}</span>
                <span class="font-medium truncate">{{ value }}</span>
              </div>
            </div>

            <USeparator />

            <div class="flex flex-wrap items-center gap-2">
              <UButton size="sm" color="neutral" variant="subtle" icon="i-lucide-plug-2" @click="testServer(server)">
                Testen
              </UButton>
              <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-pencil" @click="openEdit(server)">
                Bearbeiten
              </UButton>
              <UButton size="sm" color="error" variant="ghost" icon="i-lucide-trash" @click="deleteServer(server)">
                Entfernen
              </UButton>
            </div>
          </UCard>
        </div>

        <div v-else class="text-center py-12 space-y-4">
          <div class="space-y-2">
            <h3 class="text-lg font-medium text-highlighted">Noch keine MCP Server verbunden</h3>
            <p class="text-muted">Füge Google, Microsoft, Todoist, Trello oder eigene MCP Server hinzu, damit deine Agents auf Kalender und Aufgaben zugreifen können.</p>
          </div>
          <UButton icon="i-lucide-plus" label="Jetzt Server hinzufügen" @click="openAdd()" />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <UModal title="MCP Server" :open="showModal" @update:open="showModal = $event">
    <template #content>
      <UCard>
        <UForm :state="form" class="space-y-4" @submit.prevent="saveServer">
          <UFormField label="Anbieter">
            <USelectMenu
              v-model="form.provider"
              :options="providerOptions"
              value-attribute="value"
              option-attribute="label"
            />
          </UFormField>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField label="Name">
              <UInput v-model="form.name" placeholder="Servername" />
            </UFormField>
            <UFormField label="Kategorie">
              <UInput :model-value="form.category" disabled />
            </UFormField>
          </div>

          <UFormField label="Basis-URL">
            <UInput v-model="form.url" placeholder="https://..." />
          </UFormField>

          <UFormField label="Beschreibung">
            <UTextarea v-model="form.description" :rows="3" autoresize />
          </UFormField>

          <USeparator />

          <div class="space-y-3">
            <h4 class="font-medium text-highlighted">Authentifizierung & Einstellungen</h4>
            <UFormField
              v-for="field in providerFields"
              :key="field.key"
              :label="field.label"
              :description="field.description"
            >
              <UInput
                :type="field.type || 'text'"
                :placeholder="field.placeholder"
                :model-value="getFieldValue(field.key)"
                @update:model-value="setFieldValue(field.key, $event)"
              />
            </UFormField>
          </div>

          <div class="flex items-center justify-end gap-2 pt-4">
            <UButton color="neutral" variant="ghost" label="Abbrechen" @click="showModal = false" />
            <UButton type="submit" :loading="isSaving" label="Speichern" />
          </div>
        </UForm>
      </UCard>
    </template>
  </UModal>
</template>
