<script setup lang="ts">
type McpServer = {
  id: string
  name: string
  url: string
  description?: string
  auth: {
    type: 'apiKey' | 'basic' | 'bearer'
    fields: { label: string; placeholder?: string; value?: string }[]
  }
}

const servers: McpServer[] = [
  {
    id: 'calendar',
    name: 'Calendar MCP',
    url: 'https://mcp.example.com/calendar',
    description: 'Manage events and availability',
    auth: {
      type: 'apiKey',
      fields: [
        { label: 'API Key', placeholder: 'sk-...' }
      ]
    }
  },
  {
    id: 'email',
    name: 'Email MCP',
    url: 'https://mcp.example.com/email',
    description: 'Read and send emails',
    auth: {
      type: 'basic',
      fields: [
        { label: 'Username', placeholder: 'user@example.com' },
        { label: 'Password', placeholder: '••••••••' }
      ]
    }
  },
  {
    id: 'linear',
    name: 'Linear MCP',
    url: 'https://mcp.example.com/linear',
    description: 'Sync with Linear issues',
    auth: {
      type: 'bearer',
      fields: [
        { label: 'Bearer Token', placeholder: 'lin_xxx' }
      ]
    }
  }
]
</script>

<template>
  <UDashboardPanel id="mcp">
    <template #header>
      <UDashboardNavbar title="MCP Servers">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="Add Server" color="neutral" variant="outline" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <UCard v-for="s in servers" :key="s.id" class="flex flex-col">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="font-medium text-highlighted truncate">{{ s.name }}</h3>
              <p class="text-sm text-muted truncate">{{ s.url }}</p>
            </div>
            <UBadge variant="subtle">{{ s.auth.type }}</UBadge>
          </div>
          <p class="text-sm mt-2">{{ s.description }}</p>
          <USeparator class="my-4" />
          <form class="space-y-2">
            <UFormField
              v-for="field in s.auth.fields"
              :key="field.label"
              :label="field.label"
            >
              <UInput :placeholder="field.placeholder" disabled />
            </UFormField>
          </form>
          <div class="mt-4 flex items-center gap-2">
            <UButton label="Test" color="neutral" variant="subtle" icon="i-lucide-plug-2" />
            <UButton label="Save" color="neutral" />
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>


