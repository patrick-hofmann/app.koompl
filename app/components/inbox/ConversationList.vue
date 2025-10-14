<script setup lang="ts">
import { format, isToday } from 'date-fns'
import type { EmailConversation } from '~/types'

const props = defineProps<{
  conversations: EmailConversation[]
}>()

const conversationsRefs = ref<Element[]>([])

const selectedConversation = defineModel<EmailConversation | null>()

watch(selectedConversation, () => {
  if (!selectedConversation.value) {
    return
  }
  const ref = conversationsRefs.value[selectedConversation.value.id]
  if (ref) {
    ref.scrollIntoView({ block: 'nearest' })
  }
})

defineShortcuts({
  arrowdown: () => {
    const index = props.conversations.findIndex(
      (conv) => conv.id === selectedConversation.value?.id
    )

    if (index === -1) {
      selectedConversation.value = props.conversations[0]
    } else if (index < props.conversations.length - 1) {
      selectedConversation.value = props.conversations[index + 1]
    }
  },
  arrowup: () => {
    const index = props.conversations.findIndex(
      (conv) => conv.id === selectedConversation.value?.id
    )

    if (index === -1) {
      selectedConversation.value = props.conversations[props.conversations.length - 1]
    } else if (index > 0) {
      selectedConversation.value = props.conversations[index - 1]
    }
  }
})

function formatParticipants(participants: string[]): string {
  if (participants.length === 0) return 'No participants'
  if (participants.length === 1) return participants[0]
  if (participants.length === 2) return participants.join(', ')
  return `${participants[0]} and ${participants.length - 1} others`
}
</script>

<template>
  <div class="overflow-y-auto divide-y divide-default">
    <div
      v-for="conversation in conversations"
      :key="conversation.id"
      :ref="
        (el) => {
          conversationsRefs[conversation.id] = el as Element
        }
      "
    >
      <div
        class="p-4 sm:px-6 text-sm cursor-pointer border-l-2 transition-colors"
        :class="[
          conversation.hasUnread ? 'text-highlighted' : 'text-toned',
          selectedConversation && selectedConversation.id === conversation.id
            ? 'border-primary bg-primary/10'
            : 'border-(--ui-bg) hover:border-primary hover:bg-primary/5'
        ]"
        @click="selectedConversation = conversation"
      >
        <div
          class="flex items-center justify-between mb-1"
          :class="[conversation.hasUnread && 'font-semibold']"
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="truncate">{{ formatParticipants(conversation.participants) }}</span>
            <UChip v-if="conversation.hasUnread" />
            <UBadge v-if="conversation.messageCount > 1" variant="subtle" size="xs">
              {{ conversation.messageCount }}
            </UBadge>
          </div>

          <span class="text-muted text-xs ml-2">
            {{
              isToday(new Date(conversation.lastMessageDate))
                ? format(new Date(conversation.lastMessageDate), 'HH:mm')
                : format(new Date(conversation.lastMessageDate), 'dd MMM')
            }}
          </span>
        </div>
        <p class="truncate mb-1" :class="[conversation.hasUnread && 'font-semibold']">
          {{ conversation.subject }}
        </p>
        <p class="text-dimmed text-xs line-clamp-2">
          {{ conversation.excerpt }}
        </p>
      </div>
    </div>
  </div>
</template>
