<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const toast = useToast()
const router = useRouter()

// Check authentication status
const { loggedIn, session } = await useUserSession()

// Redirect to login if not authenticated
watchEffect(() => {
  if (!loggedIn.value && route.path !== '/login') {
    router.push('/login')
  }
})

// If not logged in and not on login page, redirect
if (!loggedIn.value && route.path !== '/login') {
  await navigateTo('/login')
}

const open = ref(false)
const isSuperAdmin = computed(() => Boolean(session.value?.user?.isSuperAdmin))

const primaryLinks = computed<NavigationMenuItem[]>(() => {
  const items: NavigationMenuItem[] = [
    {
      label: 'Home',
      icon: 'i-lucide-house',
      to: '/',
      onSelect: () => {
        open.value = false
      }
    },
    {
      label: 'Koompls',
      icon: 'i-lucide-bot',
      to: '/agents',
      onSelect: () => {
        open.value = false
      }
    },
    {
      label: 'Domain',
      icon: 'i-lucide-globe',
      to: '/domain',
      onSelect: () => {
        open.value = false
      }
    },
    {
      label: 'Kanban',
      icon: 'i-lucide-kanban',
      to: '/kanban',
      onSelect: () => {
        open.value = false
      }
    },
    {
      label: 'Calendar',
      icon: 'i-lucide-calendar-days',
      to: '/calendar',
      onSelect: () => {
        open.value = false
      }
    },
    {
      label: 'MCP Servers',
      icon: 'i-lucide-server-cog',
      to: '/mcp',
      onSelect: () => {
        open.value = false
      }
    }
  ]

  if (isSuperAdmin.value) {
    items.push({
      label: 'Admin',
      icon: 'i-lucide-shield-check',
      to: '/admin',
      onSelect: () => {
        open.value = false
      }
    })
  }

  items.push(
    {
      label: 'Team Settings',
      icon: 'i-lucide-users',
      type: 'trigger',
      children: [
        {
          label: 'AI Providers',
          to: '/settings/ai',
          onSelect: () => {
            open.value = false
          }
        },
        {
          label: 'Members',
          to: '/settings/members',
          onSelect: () => {
            open.value = false
          }
        },
        {
          label: 'Security',
          to: '/settings/team-security',
          onSelect: () => {
            open.value = false
          }
        }
      ]
    },
    {
      label: 'User Settings',
      icon: 'i-lucide-user',
      type: 'trigger',
      children: [
        {
          label: 'Profile',
          to: '/settings',
          exact: true,
          onSelect: () => {
            open.value = false
          }
        },
        {
          label: 'Notifications',
          to: '/settings/notifications',
          onSelect: () => {
            open.value = false
          }
        },
        {
          label: 'Security',
          to: '/settings/security',
          onSelect: () => {
            open.value = false
          }
        }
      ]
    }
  )

  return items
})

const secondaryLinks: NavigationMenuItem[] = [
  {
    label: 'Feedback',
    icon: 'i-lucide-message-circle',
    to: '/feedback'
  },
  {
    label: 'Help & Support',
    icon: 'i-lucide-info',
    to: 'https://github.com/nuxt-ui-templates/dashboard',
    target: '_blank'
  }
]

const links = computed<NavigationMenuItem[][]>(() => [primaryLinks.value, secondaryLinks])

const groups = computed(() => [
  {
    id: 'links',
    label: 'Go to',
    items: links.value.flat()
  },
  {
    id: 'code',
    label: 'Code',
    items: [
      {
        id: 'source',
        label: 'View page source',
        icon: 'i-simple-icons-github',
        to: `https://github.com/nuxt-ui-templates/dashboard/blob/main/app/pages${route.path === '/' ? '/index' : route.path}.vue`,
        target: '_blank'
      }
    ]
  }
])

// Show cookie consent only for logged in users
watch(
  loggedIn,
  async (isLoggedIn) => {
    if (!isLoggedIn) {
      return
    }

    const cookie = useCookie('cookie-consent')
    if (cookie.value === 'accepted') {
      return
    }

    toast.add({
      title: 'We use first-party cookies to enhance your experience on our website.',
      duration: 0,
      close: false,
      actions: [
        {
          label: 'Accept',
          color: 'neutral',
          variant: 'outline',
          onClick: () => {
            cookie.value = 'accepted'
          }
        },
        {
          label: 'Opt out',
          color: 'neutral',
          variant: 'ghost'
        }
      ]
    })
  },
  { immediate: true }
)
</script>

<template>
  <!-- Show full dashboard with sidebar only when logged in -->
  <div v-if="loggedIn">
    <UDashboardGroup unit="rem">
      <UDashboardSidebar
        id="default"
        v-model:open="open"
        collapsible
        resizable
        class="bg-elevated/25"
        :ui="{ footer: 'lg:border-t lg:border-default' }"
      >
        <template #header="{ collapsed }">
          <TeamsMenu :collapsed="collapsed" />
        </template>

        <template #default="{ collapsed }">
          <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

          <UNavigationMenu
            :collapsed="collapsed"
            :items="links[0]"
            orientation="vertical"
            tooltip
            popover
          />

          <UNavigationMenu
            :collapsed="collapsed"
            :items="links[1]"
            orientation="vertical"
            tooltip
            class="mt-auto"
          />
        </template>

        <template #footer="{ collapsed }">
          <UserMenu :collapsed="collapsed" />
        </template>
      </UDashboardSidebar>

      <UDashboardSearch :groups="groups" />

      <slot />

      <NotificationsSlideover />
    </UDashboardGroup>
  </div>

  <!-- Show only content when not logged in (like login page) -->
  <div v-else>
    <slot />
  </div>
</template>
