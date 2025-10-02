<script setup lang="ts">
const { session } = useUserSession()

const sessionInfo = computed(() => ({
  user: session.value?.user || null,
  team: session.value?.team || null,
  availableTeams: session.value?.availableTeams || [],
  loggedInAt: session.value?.loggedInAt || ''
}))

function formatDateTime(value?: string) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value))
  } catch {
    return value
  }
}
</script>

<template>
  <UDashboardPanel id="profile">
    <template #header>
      <UDashboardNavbar title="Profile" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UCard>
          <template #header>
            <h3 class="text-base font-medium text-highlighted">Current Session</h3>
            <p class="text-sm text-muted">These values are read from your server-side session.</p>
          </template>

          <div class="grid gap-6 md:grid-cols-2">
            <div class="space-y-1">
              <h4 class="font-medium text-highlighted">User</h4>
              <p class="text-sm text-muted">Name: {{ sessionInfo.user?.name || '—' }}</p>
              <p class="text-sm text-muted">Email: {{ sessionInfo.user?.email || '—' }}</p>
              <p class="text-xs text-muted">User-ID: {{ sessionInfo.user?.id || '—' }}</p>
              <p class="text-xs text-muted">Role: {{ sessionInfo.team?.role || '—' }}</p>
            </div>

            <div class="space-y-1">
              <h4 class="font-medium text-highlighted">Team</h4>
              <p class="text-sm text-muted">Name: {{ sessionInfo.team?.name || '—' }}</p>
              <p class="text-sm text-muted">
                Description: {{ sessionInfo.team?.description || '—' }}
              </p>
              <p class="text-xs text-muted">Team-ID: {{ sessionInfo.team?.id || '—' }}</p>
            </div>
          </div>

          <USeparator class="my-4" />

          <div class="space-y-2">
            <h4 class="font-medium text-highlighted">Available Teams</h4>
            <div v-if="sessionInfo.availableTeams.length" class="grid gap-3">
              <div
                v-for="t in sessionInfo.availableTeams"
                :key="t.id"
                class="rounded-lg border border-default p-3 text-sm"
              >
                <div class="font-medium text-highlighted">{{ t.name }}</div>
                <div class="text-xs text-muted">Team-ID: {{ t.id }}</div>
                <div class="text-xs text-muted">Role: {{ t.role }}</div>
                <div v-if="t.description" class="text-xs text-muted">{{ t.description }}</div>
              </div>
            </div>
            <p v-else class="text-sm text-muted">No teams available.</p>
          </div>

          <USeparator class="my-4" />

          <div class="text-sm text-muted">
            Logged in at: {{ formatDateTime(sessionInfo.loggedInAt) || '—' }}
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
