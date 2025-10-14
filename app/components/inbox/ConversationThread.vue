<script setup lang="ts">
import { format } from 'date-fns'
import type { EmailMessage, EmailConversation } from '~/types'

const props = defineProps<{
  conversation: EmailConversation
  agentId: string
}>()

const emits = defineEmits(['close', 'compose'])

const {
  data: emailsData,
  pending: emailsPending,
  refresh
} = await useAsyncData(
  `conversation-${props.conversation.id}`,
  async () => {
    const res = await $fetch<{ emails: Array<any> }>(
      `/api/agents/${props.agentId}/conversations/${props.conversation.id}`
    )
    return res.emails.map(
      (email): EmailMessage => ({
        id: email.id,
        messageId: email.messageId,
        conversationId: email.conversationId || props.conversation.id,
        from: email.from,
        to: email.to,
        subject: email.subject,
        body: email.body,
        html: email.html,
        timestamp: email.timestamp,
        direction: email.id.startsWith('inbound-') ? 'inbound' : 'outbound',
        isUnread: false,
        attachments: email.attachments || []
      })
    )
  },
  {
    server: false,
    immediate: true,
    watch: [() => props.conversation.id, () => props.agentId]
  }
)

const emails = computed(() => emailsData.value || [])

const expandedEmails = ref<Set<string>>(new Set(emails.value.map((e) => e.id)))

function formatFileSize(bytes: number | undefined): string {
  if (!bytes || Number.isNaN(bytes)) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size % 1 === 0 ? size : size.toFixed(1)} ${units[unitIndex]}`
}

// Expand all emails by default
watch(
  emails,
  (newEmails) => {
    if (newEmails.length > 0) {
      expandedEmails.value = new Set(newEmails.map((e) => e.id))
    }
  },
  { immediate: true }
)

function toggleEmail(emailId: string) {
  if (expandedEmails.value.has(emailId)) {
    expandedEmails.value.delete(emailId)
  } else {
    expandedEmails.value.add(emailId)
  }
}

function extractEmailAddress(header: string): string {
  const match = header.match(/<([^>]+)>/)
  return match ? match[1] : header
}

function extractName(header: string): string {
  const match = header.match(/^([^<]+)</)
  return match ? match[1].trim().replace(/['"]/g, '') : header.split('@')[0]
}

function downloadAttachment(messageId: string, filename: string) {
  // Create download link for email attachment
  const downloadUrl = `/api/mail/${messageId}/attachments/${encodeURIComponent(filename)}`

  // Trigger download by opening URL in new window
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = filename
  link.click()
}

function handleReply() {
  const lastEmail = emails.value[emails.value.length - 1]
  if (lastEmail) {
    emits('compose', {
      mode: 'reply',
      to: extractEmailAddress(lastEmail.from),
      subject: lastEmail.subject.startsWith('Re: ')
        ? lastEmail.subject
        : `Re: ${lastEmail.subject}`,
      inReplyTo: lastEmail.messageId,
      originalMessageId: lastEmail.messageId
    })
  }
}

const dropdownItems = [
  [
    {
      label: 'Reply',
      icon: 'i-lucide-reply',
      click: handleReply
    },
    {
      label: 'Forward',
      icon: 'i-lucide-forward'
    }
  ],
  [
    {
      label: 'Mark as unread',
      icon: 'i-lucide-circle-dot'
    }
  ]
]
</script>

<template>
  <UDashboardPanel id="conversation-thread">
    <UDashboardNavbar :title="conversation.subject" :toggle="false">
      <template #leading>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          class="-ms-1.5"
          @click="emits('close')"
        />
      </template>

      <template #right>
        <UTooltip text="Reply">
          <UButton icon="i-lucide-reply" color="neutral" variant="ghost" @click="handleReply" />
        </UTooltip>

        <UTooltip text="Refresh">
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            :loading="emailsPending"
            @click="refresh"
          />
        </UTooltip>

        <UDropdownMenu :items="dropdownItems">
          <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" />
        </UDropdownMenu>
      </template>
    </UDashboardNavbar>

    <div v-if="emailsPending" class="flex-1 p-4 sm:p-6">
      <div class="space-y-4">
        <USkeleton class="h-20 w-full" />
        <USkeleton class="h-20 w-full" />
      </div>
    </div>

    <div v-else-if="emails.length === 0" class="flex-1 flex items-center justify-center p-4">
      <div class="text-center">
        <UIcon name="i-lucide-mail-x" class="size-12 text-dimmed mx-auto mb-2" />
        <p class="text-muted">No emails in this conversation</p>
      </div>
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <!-- Email timeline -->
      <div class="divide-y divide-default">
        <div v-for="email in emails" :key="email.id" class="p-4 sm:p-6">
          <!-- Email header -->
          <div class="flex items-start gap-4 cursor-pointer" @click="toggleEmail(email.id)">
            <UAvatar
              :alt="extractName(email.from)"
              size="md"
              :src="`https://i.pravatar.cc/128?u=${encodeURIComponent(extractEmailAddress(email.from))}`"
            />

            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-highlighted truncate">
                    {{ extractName(email.from) }}
                    <span
                      v-if="email.direction === 'outbound'"
                      class="text-xs text-muted font-normal"
                      >(sent)</span
                    >
                  </p>
                  <p class="text-sm text-muted truncate">
                    {{ extractEmailAddress(email.from) }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <p class="text-sm text-muted whitespace-nowrap">
                    {{ format(new Date(email.timestamp), 'dd MMM HH:mm') }}
                  </p>
                  <UIcon
                    :name="
                      expandedEmails.has(email.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'
                    "
                    class="size-4 text-muted"
                  />
                </div>
              </div>

              <!-- Collapsed preview -->
              <p v-if="!expandedEmails.has(email.id)" class="text-sm text-dimmed line-clamp-1 mt-1">
                {{ email.body.substring(0, 100) }}...
              </p>
            </div>
          </div>

          <!-- Expanded email body -->
          <div v-if="expandedEmails.has(email.id)" class="mt-4 ml-0 sm:ml-14">
            <div class="prose prose-sm max-w-none">
              <pre class="whitespace-pre-wrap font-sans text-sm">{{ email.body }}</pre>
              <div v-if="email.attachments && email.attachments.length > 0" class="mt-4 space-y-2">
                <p class="text-xs font-semibold uppercase text-muted">Attachments</p>
                <div class="space-y-2">
                  <div
                    v-for="attachment in email.attachments"
                    :key="attachment.id || attachment.filename"
                    class="flex items-center justify-between rounded border border-dashed border-default px-3 py-2 text-sm"
                  >
                    <div class="flex items-center gap-2">
                      <UIcon name="i-lucide-paperclip" class="size-4 text-muted" />
                      <div>
                        <p class="font-medium text-highlighted">
                          {{ attachment.filename }}
                        </p>
                        <p class="text-xs text-muted">
                          {{ attachment.mimeType || 'Unknown type' }} ·
                          {{ formatFileSize(attachment.size) }}
                        </p>
                      </div>
                    </div>
                    <UButton
                      color="primary"
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-download"
                      label="Download"
                      @click="downloadAttachment(email.messageId, attachment.filename)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick reply section -->
      <div class="p-4 sm:p-6 border-t border-default bg-muted/5">
        <UButton label="Reply" icon="i-lucide-reply" color="primary" @click="handleReply" />
      </div>
    </div>
  </UDashboardPanel>
</template>
