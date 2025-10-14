<script setup lang="ts">
import type { ComposeData } from '~/types'

const props = defineProps<{
  agentId: string
  composeData?: ComposeData
}>()

const emits = defineEmits(['close', 'sent'])

const isOpen = defineModel<boolean>({ required: true })

const form = reactive({
  to: props.composeData?.to || '',
  subject: props.composeData?.subject || '',
  body: props.composeData?.body || ''
})

const sending = ref(false)
const toast = useToast()

async function handleSend() {
  if (!form.to || !form.subject || !form.body) {
    toast.add({
      title: 'Validation error',
      description: 'Please fill in all fields',
      icon: 'i-lucide-alert-circle',
      color: 'red'
    })
    return
  }

  sending.value = true

  try {
    const mode = props.composeData?.mode || 'new'

    await $fetch(`/api/agents/${props.agentId}/compose`, {
      method: 'POST',
      body: {
        to: form.to,
        subject: form.subject,
        body: form.body,
        type: mode,
        inReplyTo: props.composeData?.inReplyTo
      }
    })

    toast.add({
      title: 'Email sent',
      description: 'Your email has been sent successfully',
      icon: 'i-lucide-check-circle',
      color: 'success'
    })

    emits('sent')
    isOpen.value = false
  } catch (error) {
    console.error('Failed to send email:', error)
    toast.add({
      title: 'Send failed',
      description: error instanceof Error ? error.message : 'Failed to send email',
      icon: 'i-lucide-x-circle',
      color: 'red'
    })
  } finally {
    sending.value = false
  }
}

function handleCancel() {
  isOpen.value = false
  emits('close')
}

const modeLabel = computed(() => {
  switch (props.composeData?.mode) {
    case 'reply':
      return 'Reply to Email'
    case 'forward':
      return 'Forward Email'
    default:
      return 'Compose New Email'
  }
})
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-2xl' }">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">{{ modeLabel }}</h3>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="handleCancel"
          />
        </div>
      </template>

      <form class="space-y-4" @submit.prevent="handleSend">
        <UFormGroup label="To" required>
          <UInput
            v-model="form.to"
            type="email"
            placeholder="recipient@example.com"
            :disabled="sending || composeData?.mode === 'reply'"
            required
          />
        </UFormGroup>

        <UFormGroup label="Subject" required>
          <UInput v-model="form.subject" placeholder="Email subject" :disabled="sending" required />
        </UFormGroup>

        <UFormGroup label="Message" required>
          <UTextarea
            v-model="form.body"
            placeholder="Write your message..."
            :rows="12"
            :disabled="sending"
            autoresize
            required
          />
        </UFormGroup>

        <div class="flex items-center justify-end gap-2 pt-4">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            :disabled="sending"
            @click="handleCancel"
          />
          <UButton
            type="submit"
            label="Send"
            icon="i-lucide-send"
            color="primary"
            :loading="sending"
          />
        </div>
      </form>
    </UCard>
  </UModal>
</template>
