<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()

// Determine if we're on team settings or user settings based on the current route
const isTeamSettings = computed(() => {
  const teamSettingRoutes = ['/settings/ai', '/settings/members']
  return teamSettingRoutes.includes(route.path)
})

// Team Settings tabs - shown when navigating team settings pages
const teamLinks: NavigationMenuItem[][] = [[{
  label: 'AI Providers',
  icon: 'i-lucide-brain',
  to: '/settings/ai'
}, {
  label: 'Members',
  icon: 'i-lucide-users',
  to: '/settings/members'
}], [{
  label: 'Documentation',
  icon: 'i-lucide-book-open',
  to: 'https://ui.nuxt.com/docs/getting-started/installation/nuxt',
  target: '_blank'
}]]

// User Settings tabs - shown when navigating user settings pages
const userLinks: NavigationMenuItem[][] = [[{
  label: 'Profile',
  icon: 'i-lucide-user',
  to: '/settings',
  exact: true
}, {
  label: 'Notifications',
  icon: 'i-lucide-bell',
  to: '/settings/notifications'
}, {
  label: 'Security',
  icon: 'i-lucide-shield',
  to: '/settings/security'
}], [{
  label: 'Documentation',
  icon: 'i-lucide-book-open',
  to: 'https://ui.nuxt.com/docs/getting-started/installation/nuxt',
  target: '_blank'
}]]

// Dynamic links based on the settings context
const links = computed(() => isTeamSettings.value ? teamLinks : userLinks)
</script>

<template>
  <UDashboardPanel id="settings" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="Settings">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
        <UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full lg:max-w-2xl mx-auto">
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>
