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
const fileInput = ref<HTMLInputElement | null>(null)

// File upload handling
function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    form.attachments = Array.from(target.files)
  }
}

function removeAttachment(index: number) {
  form.attachments.splice(index, 1)
}

// Convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix (data:mime/type;base64,)
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = (error) => reject(error)
  })
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

watch(
  () => props.agentId,
  (id) => {
    if (!id) return
    // Leave "to" empty to default to agent email on server; user can override
  },
  { immediate: true }
)

async function runRoundTrip() {
  if (!props.agentId) return
  loading.value = true
  result.value = null
  try {
    // Prepare the request body
    const requestBody: any = {
      from: form.from,
      to: form.to || undefined,
      subject: form.subject,
      text: form.text
    }

    // Add attachments if any
    if (form.attachments.length > 0) {
      console.log(`Converting ${form.attachments.length} attachment(s) to base64...`)
      requestBody.attachments = []

      for (const file of form.attachments) {
        const base64Data = await fileToBase64(file)
        requestBody.attachments.push({
          filename: file.name,
          data: base64Data,
          mimeType: file.type || 'application/octet-stream',
          size: file.size
        })
      }

      console.log(`Added ${requestBody.attachments.length} attachment(s) to request`)
    }

    const res = await $fetch<{
      ok: boolean
      inboundSavedId?: string
      outbound?: Record<string, unknown>
      error?: string
    }>(`/api/agents/${props.agentId}/roundtrip`, {
      method: 'POST',
      body: requestBody
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
    description="Simulate Mailgun inbound with attachments and send reply"
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

            <!-- Attachments -->
            <UFormField label="Attachments (optional)">
              <div class="space-y-3">
                <!-- File input -->
                <input
                  ref="fileInput"
                  type="file"
                  multiple
                  class="hidden"
                  accept="*/*"
                  @change="handleFileSelect"
                />
                <UButton
                  label="Add Files"
                  icon="i-lucide-paperclip"
                  variant="outline"
                  @click="() => (fileInput as any)?.click()"
                />

                <!-- Selected files list -->
                <div v-if="form.attachments.length > 0" class="space-y-2">
                  <div class="text-sm font-medium text-highlighted">Selected Files:</div>
                  <div
                    v-for="(file, index) in form.attachments"
                    :key="index"
                    class="flex items-center justify-between p-2 bg-elevated rounded-lg border"
                  >
                    <div class="flex items-center gap-2">
                      <UIcon name="i-lucide-file" class="w-4 h-4 text-muted" />
                      <div>
                        <div class="text-sm font-medium">{{ file.name }}</div>
                        <div class="text-xs text-muted">{{ formatFileSize(file.size) }}</div>
                      </div>
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
