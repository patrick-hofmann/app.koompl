<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const schema = z.object({
  openaiKey: z.string().optional(),
  claudeKey: z.string().optional(),
  mailgunApiKey: z.string().optional()
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ openaiKey: '', claudeKey: '', mailgunApiKey: '' })

const toast = useToast()
onMounted(async () => {
  const settings = await $fetch<{ mailgunApiKey?: string }>('/api/settings')
  state.mailgunApiKey = settings.mailgunApiKey || ''
})

async function onSubmit(_unusedEvent: FormSubmitEvent<Schema>) {
  await $fetch('/api/settings', { method: 'PATCH', body: { mailgunApiKey: state.mailgunApiKey } })
  toast.add({ title: 'Saved', description: 'Settings updated.', color: 'success', icon: 'i-lucide-check' })
}
</script>

<template>
  <UForm id="ai-settings" :schema="schema" :state="state" @submit="onSubmit">
    <UPageCard
      title="AI Providers"
      description="Provide API keys for OpenAI and/or Claude. Static mock for now."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton form="ai-settings" label="Save changes" color="neutral" type="submit" class="w-fit lg:ms-auto" />
    </UPageCard>

    <UPageCard variant="subtle">
      <UFormField name="openaiKey" label="OpenAI API Key" class="flex max-sm:flex-col justify-between items-start gap-4">
        <UInput v-model="state.openaiKey" placeholder="sk-..." type="password" autocomplete="off" />
      </UFormField>
      <USeparator />
      <UFormField name="claudeKey" label="Claude API Key" class="flex max-sm:flex-col justify-between items-start gap-4">
        <UInput v-model="state.claudeKey" placeholder="sk-ant-..." type="password" autocomplete="off" />
      </UFormField>
      <USeparator />
      <UFormField name="mailgunApiKey" label="Mailgun API Key" class="flex max-sm:flex-col justify-between items-start gap-4">
        <UInput v-model="state.mailgunApiKey" placeholder="key-..." type="password" autocomplete="off" />
      </UFormField>
    </UPageCard>
  </UForm>
</template>
