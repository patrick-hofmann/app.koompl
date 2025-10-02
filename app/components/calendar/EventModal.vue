<script setup lang="ts">
import type { CalendarEvent } from '~/server/types/calendar'

const props = defineProps<{
  open: boolean
  event?: CalendarEvent
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [eventData: Partial<CalendarEvent>]
  delete: []
}>()

const isEditing = computed(() => !!props.event)

const formData = ref({
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  allDay: false,
  location: '',
  color: '#3b82f6',
  tags: [] as string[]
})

const tagInput = ref('')

watch(
  () => props.event,
  (event) => {
    if (event) {
      formData.value = {
        title: event.title,
        description: event.description || '',
        startDate: event.startDate,
        endDate: event.endDate,
        allDay: event.allDay || false,
        location: event.location || '',
        color: event.color || '#3b82f6',
        tags: event.tags || []
      }
    } else {
      // Set default dates to now
      const now = new Date()
      const end = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour later
      formData.value = {
        title: '',
        description: '',
        startDate: now.toISOString().slice(0, 16),
        endDate: end.toISOString().slice(0, 16),
        allDay: false,
        location: '',
        color: '#3b82f6',
        tags: []
      }
    }
  },
  { immediate: true }
)

function addTag() {
  const tag = tagInput.value.trim()
  if (tag && !formData.value.tags.includes(tag)) {
    formData.value.tags.push(tag)
    tagInput.value = ''
  }
}

function removeTag(tag: string) {
  formData.value.tags = formData.value.tags.filter((t) => t !== tag)
}

function handleSubmit() {
  emit('save', formData.value)
  emit('update:open', false)
}

function handleDelete() {
  emit('delete')
}

function handleClose() {
  emit('update:open', false)
}

const colors = [
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#10b981' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Yellow', value: '#f59e0b' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Gray', value: '#6b7280' }
]
</script>

<template>
  <UModal :title="isEditing ? 'Edit Event' : 'New Event'" :open="open" @update:open="handleClose">
    <template #content>
      <UCard>
        <UForm @submit="handleSubmit">
          <div class="space-y-4">
            <UFormField label="Title" required>
              <UInput v-model="formData.title" placeholder="Event title" required />
            </UFormField>

            <UFormField label="Description">
              <UTextarea v-model="formData.description" placeholder="Event description" :rows="3" />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Start Date" required>
                <UInput v-model="formData.startDate" type="datetime-local" required />
              </UFormField>

              <UFormField label="End Date" required>
                <UInput v-model="formData.endDate" type="datetime-local" required />
              </UFormField>
            </div>

            <UFormField label="All Day">
              <USwitch v-model="formData.allDay" />
            </UFormField>

            <UFormField label="Location">
              <UInput v-model="formData.location" placeholder="Event location" />
            </UFormField>

            <UFormField label="Color">
              <div class="flex items-center gap-2">
                <USelect
                  v-model="formData.color"
                  :items="
                    colors.map((c) => ({
                      label: c.label,
                      value: c.value
                    }))
                  "
                  class="flex-1"
                />
                <div class="w-8 h-8 rounded border" :style="{ backgroundColor: formData.color }" />
              </div>
            </UFormField>

            <UFormField label="Tags">
              <div class="space-y-2">
                <div class="flex gap-2">
                  <UInput
                    v-model="tagInput"
                    placeholder="Add a tag"
                    class="flex-1"
                    @keydown.enter.prevent="addTag"
                  />
                  <UButton label="Add" @click="addTag" />
                </div>
                <div v-if="formData.tags.length" class="flex flex-wrap gap-2">
                  <UBadge
                    v-for="tag in formData.tags"
                    :key="tag"
                    :label="tag"
                    color="primary"
                    variant="subtle"
                  >
                    <template #trailing>
                      <UButton
                        icon="i-lucide-x"
                        size="2xs"
                        color="primary"
                        variant="ghost"
                        @click="removeTag(tag)"
                      />
                    </template>
                  </UBadge>
                </div>
              </div>
            </UFormField>

            <div class="flex items-center gap-2 justify-end pt-4">
              <UButton
                v-if="isEditing"
                label="Delete"
                color="error"
                variant="ghost"
                icon="i-lucide-trash"
                @click="handleDelete"
              />
              <UButton label="Cancel" color="neutral" variant="ghost" @click="handleClose" />
              <UButton type="submit" label="Save" :disabled="!formData.title.trim()" />
            </div>
          </div>
        </UForm>
      </UCard>
    </template>
  </UModal>
</template>
