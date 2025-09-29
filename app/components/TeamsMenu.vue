<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const { loggedIn, session, fetch } = await useUserSession()
const { clear } = await useUserSession()

// Get current team from session
const currentTeam = computed(() => {
  if (loggedIn.value && session.value?.team) {
    return {
      key: session.value.team.id,
      label: session.value.team.name,
      teamId: session.value.team.id,
      avatar: {
        text: session.value.team.name.charAt(0).toUpperCase(),
        alt: session.value.team.name
      }
    }
  }
  return null
})

// Get available teams for switching
const availableTeams = computed(() => {
  if (!loggedIn.value || !session.value?.availableTeams || !session.value?.team) {
    return []
  }

  const currentTeamId = session.value.team.id
  const availableTeamsRaw = session.value.availableTeams

  // Simple validation check to see if duplicates exist
  if (availableTeamsRaw.length > 2) {
    // More teams than expected - this might indicate a session issue
  }

  const filteredTeams = availableTeamsRaw.filter(team => team.id !== currentTeamId)
  return filteredTeams
})

// Switch to another team
const switchTeam = async (teamId: string) => {
  try {
    const response = await $fetch('/api/auth/switch-team', {
      method: 'POST',
      body: { teamId }
    })
    if (response.success) {
      // Force session refresh to get updated data from server
      await fetch()
    }
  } catch (error) {
    console.error('Failed to switch team:', error)
    await fetch()
  }
}

// Watch for session changes to update UI
watch([loggedIn, () => session.value?.availableTeams, () => session.value?.team], () => {
  // Session update will trigger reactive UI update
})

const items = computed<DropdownMenuItem[][]>(() => {
  const baseItems = [
    {
      label: 'Manage teams',
      icon: 'i-lucide-cog',
      onSelect() {
        // Navigate to team management
      }
    },
    {
      label: 'Logout',
      icon: 'i-lucide-log-out',
      onSelect() {
        clear()
      }
    }
  ]

  if (loggedIn.value && currentTeam.value) {
    // Build dropdown items for available teams
    const teamItems = []
    // Current team
    teamItems.push({
      key: currentTeam.value.key,
      label: currentTeam.value.label + ' (Current)',
      icon: 'i-lucide-check',
      onSelect() {
        // Current team, no action needed
      }
    })
    // Available teams for switching - Ensure we are not duplicating teams
    const switchableTeams = availableTeams.value.map(team => ({
      key: team.id,
      label: team.name,
      icon: 'i-lucide-arrow-right',
      onSelect() {
        switchTeam(team.id)
      }
    }))
    // Add only the filtered switchable teams to prevent duplicates
    teamItems.push(...switchableTeams)
    teamItems.push(...baseItems)
    return [teamItems]
  }

  return [baseItems]
})
</script>

<template>
  <div v-if="loggedIn && currentTeam">
    <UDropdownMenu
      :items="items"
      :content="{ align: 'center', collisionPadding: 12 }"
      :ui="{ content: collapsed ? 'w-40' : 'w-(--reka-dropdown-menu-trigger-width)' }"
    >
      <UButton
        v-bind="{
          key: currentTeam?.key,
          label: collapsed ? undefined : currentTeam?.label,
          trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down',
          avatar: currentTeam?.avatar
        }"
        color="neutral"
        variant="ghost"
        block
        :square="collapsed"
        class="data-[state=open]:bg-elevated"
        :class="[!collapsed && 'py-2']"
        :ui="{
          trailingIcon: 'text-dimmed'
        }"
      />
    </UDropdownMenu>
  </div>
  <div v-else-if="!loggedIn">
    <UButton
      :label="collapsed ? undefined : 'Login'"
      :icon="collapsed ? 'i-lucide-log-in' : undefined"
      :square="collapsed"
      color="neutral"
      variant="ghost"
      block
      to="/login"
      class="data-[state=open]:bg-elevated"
      :class="[!collapsed && 'py-2']"
    />
  </div>
</template>
