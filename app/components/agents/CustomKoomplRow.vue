<template>
  <tr>
    <td>
      <UButton
        v-if="mailLink"
        icon="i-lucide-mail"
        size="xs"
        variant="ghost"
        color="primary"
        :to="mailLink"
        title="View mailbox"
        class="mr-2"
      />
      {{ agent.name }}
    </td>
    <td>{{ agent.email }}</td>
    <td>
      <UButton icon="i-lucide-eye" size="xs" variant="ghost" :to="detailLink" />
    </td>
  </tr>
</template>

<script setup lang="ts">
import type { Agent } from '~/types'

interface Props {
  agent: Agent
  detailLink: string
  mailLink?: string
}

defineProps<Props>()
</script>
