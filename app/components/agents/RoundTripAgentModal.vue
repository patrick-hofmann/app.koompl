<script setup lang="ts">
const props = defineProps<{ open: boolean, agentId: string | null }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const form = reactive<{ from: string, to: string, subject: string, text: string }>(
  { from: 'Tester <tester@example.com>', to: '', subject: 'Round-trip test', text: 'This is a round-trip test.' }
)
const loading = ref(false)
const result = ref<Record<string, unknown> | null>(null)

watch(() => props.agentId, (id) => {
  if (!id) return
  // Leave "to" empty to default to agent email on server; user can override
}, { immediate: true })

async function runRoundTrip() {
  if (!props.agentId) return
  loading.value = true
  result.value = null
  try {
    const res = await $fetch<{ ok: boolean, inboundSavedId?: string, outbound?: Record<string, unknown>, error?: string }>(`/api/agents/${props.agentId}/roundtrip`, {
      method: 'POST',
      body: { from: form.from, to: form.to || undefined, subject: form.subject, text: form.text }
    })
    result.value = res.ok ? { inboundSavedId: res.inboundSavedId, outbound: res.outbound } : { error: res.error }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal title="Test Round-trip" description="Simulate Mailgun inbound and send reply" :open="open" @update:open="emit('update:open', $event)">
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
            <div class="flex items-center gap-2 justify-end">
              <UButton label="Close" color="neutral" variant="ghost" @click="emit('update:open', false)" />
              <UButton type="submit" :loading="loading" label="Run Round-trip" />
            </div>
          </UForm>
          <div v-if="result" class="mt-2">
            <h4 class="font-medium text-highlighted mb-1">Result</h4>
            <pre class="p-4 bg-elevated rounded-lg overflow-auto">{{ JSON.stringify(result, null, 2) }}</pre>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>
