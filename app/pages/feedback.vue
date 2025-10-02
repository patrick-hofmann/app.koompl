<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const schema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  category: z.string().min(1, 'Category is required')
})

type Schema = z.output<typeof schema>

const { user: sessionUser, session } = await useUserSession()

const state = reactive<Schema>({
  subject: '',
  message: '',
  category: 'general'
})

const isSubmitting = ref(false)
const toast = useToast()

const categories = [
  { label: 'General', value: 'general' },
  { label: 'Bug Report', value: 'bug' },
  { label: 'Feature Request', value: 'feature' },
  { label: 'UI/UX Feedback', value: 'ui' },
  { label: 'Performance Issue', value: 'performance' }
]

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isSubmitting.value = true

  try {
    // Safely extract user data with comprehensive fallbacks
    const userData = {
      name: sessionUser?.value?.name || 'Unknown',
      email: sessionUser?.value?.email || 'No email',
      id: sessionUser?.value?.id || 'No ID',
      teamName: session?.value?.team?.name || 'No team',
      teamId: session?.value?.team?.id || 'No team ID'
    }

    await $fetch('/api/feedback', {
      method: 'POST',
      body: {
        ...event.data,
        user: userData
      }
    })

    toast.add({
      title: 'Feedback Sent',
      description: "Thank you for your feedback! We'll review it and get back to you soon.",
      icon: 'i-lucide-check',
      color: 'success'
    })

    // Reset form after successful submission
    Object.assign(state, {
      subject: '',
      message: '',
      category: 'general'
    })
  } catch (error) {
    console.error('Failed to send feedback:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to send feedback. Please try again.',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="feedback">
    <template #header>
      <UDashboardNavbar title="Feedback">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full lg:max-w-2xl mx-auto">
        <UPageCard
          title="Share Your Feedback"
          description="Help us improve Koompl by sharing your thoughts, reporting bugs, or suggesting new features."
          variant="naked"
          class="mb-4"
        />

        <UForm id="feedback-form" :schema="schema" :state="state" @submit="onSubmit">
          <UPageCard variant="subtle">
            <UFormField
              name="category"
              label="Category"
              description="What type of feedback are you sharing?"
              class="flex max-sm:flex-col justify-between items-start gap-4"
              required
            >
              <USelect v-model="state.category" :items="categories" placeholder="Select category" />
            </UFormField>

            <USeparator />

            <UFormField
              name="subject"
              label="Subject"
              description="Brief summary of your feedback"
              class="flex max-sm:flex-col justify-between items-start gap-4"
              required
            >
              <UInput
                v-model="state.subject"
                placeholder="e.g., Login page layout issue"
                autocomplete="off"
              />
            </UFormField>

            <USeparator />

            <UFormField
              name="message"
              label="Message"
              description="Detailed description of your feedback"
              class="flex max-sm:flex-col justify-between items-start gap-4"
              required
            >
              <UTextarea
                v-model="state.message"
                :rows="6"
                placeholder="Please describe your feedback in detail..."
                autoresize
              />
            </UFormField>
          </UPageCard>

          <UPageCard
            title="User Information"
            description="This information will be automatically included with your feedback"
            variant="naked"
            orientation="horizontal"
            class="mb-4 mt-6"
          >
            <div class="text-sm">
              <div v-if="sessionUser" class="space-y-1">
                <div><strong>Name:</strong> {{ sessionUser.name || 'Not provided' }}</div>
                <div><strong>Email:</strong> {{ sessionUser.email || 'Not provided' }}</div>
                <div v-if="session?.team"><strong>Team:</strong> {{ session.team.name }}</div>
              </div>
              <div v-else class="text-muted">
                You are not logged in. User information will not be included.
              </div>
            </div>
          </UPageCard>

          <UPageCard variant="naked" orientation="horizontal">
            <UButton
              form="feedback-form"
              label="Send Feedback"
              color="primary"
              type="submit"
              :loading="isSubmitting"
              :disabled="isSubmitting"
              class="w-fit"
            />
          </UPageCard>
        </UForm>
      </div>
    </template>
  </UDashboardPanel>
</template>
