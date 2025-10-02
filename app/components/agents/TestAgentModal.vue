<script setup lang="ts">
const props = defineProps<{ open: boolean; agentId: string | null }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

// Get current user session (single session ref for stability across pages)
const { session } = useUserSession()

const userId = computed(() => session.value?.user?.id)
const teamId = computed(() => session.value?.team?.id)

// Initialize form with current user's name and email
const form = reactive<{ subject: string; text: string }>({
  subject: 'Test Email',
  text: `Hello, this is a test from ${session.value?.user?.name || 'User'} (${session.value?.user?.email || 'user@example.com'}).`
})
const loading = ref(false)
const result = ref<string | null>(null)

async function runTest() {
  if (!props.agentId) return
  loading.value = true
  result.value = null
  try {
    const res = await $fetch<{ ok: boolean; result?: string; error?: string }>(
      `/api/agents/${props.agentId}/test`,
      {
        method: 'POST',
        body: {
          subject: form.subject,
          text: form.text,
          // Help server-side MCP resolve context
          teamId: teamId.value,
          userId: userId.value
        }
      }
    )
    result.value = res.ok ? res.result || '' : `Error: ${res.error}`
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    title="Test Agent"
    description="Generate a sample AI reply for this agent"
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <UCard>
        <div class="space-y-3">
          <p class="text-sm text-muted">Team ID: {{ teamId }}</p>
          <p class="text-sm text-muted">User ID: {{ userId }}</p>
          <UForm :state="form" @submit="runTest">
            <UFormField label="Subject">
              <UInput v-model="form.subject" />
            </UFormField>
            <UFormField label="Body">
              <UTextarea v-model="form.text" :rows="5" autoresize />
            </UFormField>
            <div class="flex items-center gap-2 justify-end">
              <UButton
                label="Close"
                color="neutral"
                variant="ghost"
                @click="emit('update:open', false)"
              />
              <UButton type="submit" :loading="loading" label="Run Test" />
            </div>
          </UForm>
          <div v-if="result" class="mt-2">
            <h4 class="font-medium text-highlighted mb-1">Result</h4>
            <UTextarea :model-value="result" readonly :rows="8" />
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>
