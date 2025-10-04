<script setup lang="ts">
const props = defineProps<{ open: boolean; agentId: string | null }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

// Get current user session
const { user: sessionUser } = await useUserSession()

// Initialize form with current user's name and email
const form = reactive<{
  from: string
  to: string
  subject: string
  text: string
  attachments: File[]
}>({
  from: `${sessionUser.value?.name || 'Tester'} <${sessionUser.value?.email || 'tester@example.com'}>`,
  to: '',
  subject: 'Round-trip test',
  text: `This is a round-trip test from ${sessionUser.value?.name || 'User'} (${sessionUser.value?.email || 'user@example.com'}).`,
  attachments: []
})
const loading = ref(false)
const result = ref<Record<string, unknown> | null>(null)

watch(
  () => props.agentId,
  (id) => {
    if (!id) return
    // Leave "to" empty to default to agent email on server; user can override
  },
  { immediate: true }
)

// File handling functions
function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    form.attachments = Array.from(target.files)
  }
}

function removeAttachment(index: number) {
  form.attachments.splice(index, 1)
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function runRoundTrip() {
  if (!props.agentId) return
  loading.value = true
  result.value = null
  try {
    // Convert files to base64 for transmission
    const attachments = await Promise.all(
      form.attachments.map(async (file) => {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
        return {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          data: base64.split(',')[1] // Remove data:type;base64, prefix
        }
      })
    )

    const res = await $fetch<{
      ok: boolean
      inboundSavedId?: string
      outbound?: Record<string, unknown>
      error?: string
    }>(`/api/agents/${props.agentId}/roundtrip`, {
      method: 'POST',
      body: {
        from: form.from,
        to: form.to || undefined,
        subject: form.subject,
        text: form.text,
        attachments: attachments.length > 0 ? attachments : undefined
      }
    })
    result.value = res.ok
      ? { inboundSavedId: res.inboundSavedId, outbound: res.outbound }
      : { error: res.error }
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
            <UFormField label="Attachments (optional)">
              <div class="space-y-2">
                <input
                  type="file"
                  multiple
                  class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                  @change="handleFileSelect"
                />
                <div v-if="form.attachments.length > 0" class="space-y-1">
                  <div
                    v-for="(file, index) in form.attachments"
                    :key="index"
                    class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <div class="flex items-center space-x-2">
                      <UIcon name="i-lucide-file" class="w-4 h-4 text-gray-500" />
                      <span class="text-sm font-medium">{{ file.name }}</span>
                      <span class="text-xs text-gray-500">({{ formatFileSize(file.size) }})</span>
                    </div>
                    <UButton
                      icon="i-lucide-x"
                      size="xs"
                      variant="ghost"
                      color="red"
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
