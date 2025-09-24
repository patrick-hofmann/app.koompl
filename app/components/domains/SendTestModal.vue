<script setup lang="ts">
interface Props {
  open: boolean
  domain: string | null
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'sent'): void }>()

const form = reactive<{ to: string; subject: string; text: string; from?: string }>({ to: '', subject: 'Test from Koompl', text: 'This is a test email.' })

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    form.to = ''
    form.subject = 'Test from Koompl'
    form.text = 'This is a test email.'
    form.from = undefined
  }
})

async function send() {
  if (!props.domain) return
  await $fetch(`/api/mailgun/domains/${encodeURIComponent(props.domain)}/send`, { method: 'POST', body: form })
  emit('update:open', false)
  emit('sent')
}
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard>
        <h3 class="font-medium text-highlighted mb-2">Send Test Email</h3>
        <UForm :state="form" @submit="send">
          <div class="space-y-3">
            <UFormField label="To">
              <UInput v-model="form.to" type="email" placeholder="you@example.com" />
            </UFormField>
            <UFormField label="Subject">
              <UInput v-model="form.subject" />
            </UFormField>
            <UFormField label="Message">
              <UTextarea v-model="form.text" :rows="5" autoresize />
            </UFormField>
            <UFormField label="From (optional)">
              <UInput v-model="form.from" placeholder="Custom From <noreply@domain>" />
            </UFormField>
            <div class="flex items-center gap-2 justify-end">
              <UButton label="Cancel" color="neutral" variant="ghost" @click="emit('update:open', false)" />
              <UButton type="submit" label="Send" />
            </div>
          </div>
        </UForm>
      </UCard>
    </template>
  </UModal>
</template>


