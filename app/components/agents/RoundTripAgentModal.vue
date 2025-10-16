<script setup lang="ts">
const props = defineProps<{ open: boolean; agentEmail: string | null }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

// Get current user session
const { user: sessionUser } = await useUserSession()

// Initialize form with current user's name and email
const form = reactive<{ from: string; to: string; subject: string; text: string }>({
  from: `${sessionUser.value?.name || 'Tester'} <${sessionUser.value?.email || 'tester@example.com'}>`,
  to: '',
  subject: 'Round-trip test',
  text: `This is a round-trip test from ${sessionUser.value?.name || 'User'} (${sessionUser.value?.email || 'user@example.com'}).`
})
const loading = ref(false)
const result = ref<Record<string, unknown> | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const attachments = ref<
  Array<{ filename: string; base64: string; mimeType: string; size: number }>
>([])

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  Array.from(files).forEach((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const base64 = (e.target?.result as string)?.split(',')[1] || ''
      attachments.value.push({
        filename: file.name,
        base64,
        mimeType: file.type || 'application/octet-stream',
        size: file.size
      })
    }
    reader.readAsDataURL(file)
  })
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

watch(
  () => props.agentEmail,
  () => {
    // Leave "to" empty to default to agent email on server; user can override
  },
  { immediate: true }
)

async function runRoundTrip() {
  if (!props.agentEmail) return
  loading.value = true
  result.value = null
  try {
    const res = await $fetch<{
      ok: boolean
      testMessageId?: string
      messageId?: string
      agentId?: string
      agentEmail?: string
      teamId?: string
      conversationId?: string
      attachments?: number
      mcpProcessed?: boolean
      policyAllowed?: boolean
      policyReason?: string
      error?: string
      details?: string
    }>(`/api/agent/${props.agentEmail}/roundtrip`, {
      method: 'POST',
      body: {
        from: form.from,
        to: form.to || undefined,
        subject: form.subject,
        text: form.text,
        attachments: attachments.value.length > 0 ? attachments.value : undefined
      }
    })
    result.value = res
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    title="Test Round-trip"
    description="Simulate Mailgun inbound and send reply"
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <UCard>
        <div class="space-y-3">
          <UForm :state="form" @submit="runRoundTrip">
            <UFormField label="From">
              <UInput v-model="form.from" />
            </UFormField>
            <UFormField label="To (optional, defaults to agent email)">
              <UInput v-model="form.to" />
            </UFormField>
            <UFormField label="Subject">
              <UInput v-model="form.subject" />
            </UFormField>
            <UFormField label="Body">
              <UTextarea v-model="form.text" :rows="5" autoresize />
            </UFormField>

            <UFormField label="Attachments">
              <div class="space-y-2">
                <input
                  ref="fileInput"
                  type="file"
                  multiple
                  class="hidden"
                  @change="handleFileSelect"
                />
                <UButton
                  icon="i-lucide-paperclip"
                  color="neutral"
                  variant="outline"
                  label="Add Files"
                  @click="fileInput?.click()"
                />

                <div v-if="attachments.length > 0" class="space-y-2 mt-2">
                  <div
                    v-for="(attachment, index) in attachments"
                    :key="index"
                    class="flex items-center justify-between rounded border border-default px-3 py-2 text-sm"
                  >
                    <div class="flex items-center gap-2">
                      <UIcon name="i-lucide-file" class="size-4 text-muted" />
                      <div>
                        <p class="font-medium text-highlighted">{{ attachment.filename }}</p>
                        <p class="text-xs text-muted">
                          {{ attachment.mimeType }} · {{ formatFileSize(attachment.size) }}
                        </p>
                      </div>
                    </div>
                    <UButton
                      icon="i-lucide-x"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      @click="removeAttachment(index)"
                    />
                  </div>
                </div>
              </div>
            </UFormField>

            <div class="flex items-center gap-2 justify-end">
              <UButton
                label="Close"
                color="neutral"
                variant="ghost"
                @click="emit('update:open', false)"
              />
              <UButton type="submit" :loading="loading" label="Run Round-trip" />
            </div>
          </UForm>
          <div v-if="result" class="mt-2">
            <h4 class="font-medium text-highlighted mb-1">Result</h4>
            <pre class="p-4 bg-elevated rounded-lg overflow-auto">{{
              JSON.stringify(result, null, 2)
            }}</pre>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>
