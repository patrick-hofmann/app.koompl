<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { validateDomainPatterns } from '~/utils/domainMatcher'

const schema = z.object({
  allowedDomains: z.string().optional()
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  allowedDomains: ''
})

const toast = useToast()
const domainValidation = ref({ isValid: true, errors: [] as string[] })

onMounted(async () => {
  const settings = await $fetch<{
    allowedDomains?: string 
  }>('/api/settings')
  state.allowedDomains = settings.allowedDomains || ''
})

// Validate domain patterns when they change
watch(() => state.allowedDomains, (newValue) => {
  if (newValue) {
    domainValidation.value = validateDomainPatterns(newValue)
  } else {
    domainValidation.value = { isValid: true, errors: [] }
  }
}, { immediate: true })

async function onSubmit(_unusedEvent: FormSubmitEvent<Schema>) {
  // Validate domain patterns before submitting
  if (state.allowedDomains) {
    const validation = validateDomainPatterns(state.allowedDomains)
    if (!validation.isValid) {
      toast.add({
        title: 'Validation Error',
        description: validation.errors.join(', '),
        color: 'error',
        icon: 'i-lucide-alert-circle'
      })
      return
    }
  }

  await $fetch('/api/settings', {
    method: 'PATCH',
    body: {
      allowedDomains: state.allowedDomains
    }
  })
  toast.add({ title: 'Saved', description: 'Security settings updated.', color: 'success', icon: 'i-lucide-check' })
}
</script>

<template>
  <UForm id="security-settings" :schema="schema" :state="state" @submit="onSubmit">
    <UPageCard
      title="Team Security Settings"
      description="Configure security settings for your team including domain filtering for AI responses."
      variant="naked"
      orientation="horizontal"
      class="mb-4"
    >
      <UButton form="security-settings" label="Save changes" color="neutral" type="submit" class="w-fit lg:ms-auto" />
    </UPageCard>

    <UPageCard variant="subtle">
      <UFormField
        name="allowedDomains"
        label="Allowed Email Domains"
        description="Configure which email domains are allowed to trigger AI responses. This helps control costs and protect against bots."
        class="flex max-sm:flex-col justify-between items-start gap-4"
        :ui="{ container: 'w-full' }"
      >
        <div class="w-full">
          <UTextarea
            v-model="state.allowedDomains"
            placeholder="*@delta-mind.at, patrick@delta-mind.at, *test-*@*.delta-mind.at"
            :rows="4"
            autoresize
            class="w-full"
            :color="domainValidation.isValid ? 'primary' : 'red'"
          />
          <div v-if="!domainValidation.isValid" class="mt-2 text-sm text-red-500">
            <div v-for="error in domainValidation.errors" :key="error" class="flex items-center gap-1">
              <UIcon name="i-lucide-alert-circle" class="w-4 h-4" />
              {{ error }}
            </div>
          </div>
          <div v-else-if="state.allowedDomains" class="mt-2 text-sm text-green-600">
            <UIcon name="i-lucide-check-circle" class="w-4 h-4 inline mr-1" />
            Domain patterns are valid
          </div>
        </div>
      </UFormField>
    </UPageCard>
  </UForm>
</template>
