<script setup lang="ts">
import type { Member } from '~/types'

const { session, loggedIn: _unusedLoggedIn } = await useUserSession()

const { data: members } = await useFetch<Member[]>('/api/members', {
  default: () => [],
  server: false
})

const q = ref('')

const filteredMembers = computed(() => {
  const membersList = Array.isArray(members.value) ? members.value : []
  return membersList.filter((member) => {
    return member.name.search(new RegExp(q.value, 'i')) !== -1 || member.username.search(new RegExp(q.value, 'i')) !== -1
  })
})
</script>

<template>
  <div>
    <UPageCard
      :title="`Team Members ${session?.team ? '- ' + session.team.name : ''}`"
      :description="session?.team ? `Manage team members for ${session.team.name}` : 'Invite new members by email address.'"
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton
        label="Invite people"
        color="neutral"
        class="w-fit lg:ms-auto"
      />
    </UPageCard>

    <UPageCard variant="subtle" :ui="{ container: 'p-0 sm:p-0 gap-y-0', wrapper: 'items-stretch', header: 'p-4 mb-0 border-b border-default' }">
      <template #header>
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Search members"
          autofocus
          class="w-full"
        />
      </template>

      <SettingsMembersList :members="filteredMembers" />
    </UPageCard>
  </div>
</template>
