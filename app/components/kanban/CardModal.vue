<script setup lang="ts">
import type { KanbanCard } from '~/server/types/kanban'

const props = defineProps<{
  open: boolean
  card?: KanbanCard & { columnId: string }
  columnId: string
  boardId: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', card: Partial<KanbanCard>): void
  (e: 'delete'): void
}>()

const form = reactive({
  title: '',
  description: '',
  assignee: '',
  priority: 'Medium' as 'Low' | 'Medium' | 'High',
  ticket: '',
  tags: [] as string[]
})

const tagInput = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.card) {
      form.title = props.card.title
      form.description = props.card.description || ''
      form.assignee = props.card.assignee || ''
      form.priority = props.card.priority || 'Medium'
      form.ticket = props.card.ticket || ''
      form.tags = props.card.tags ? [...props.card.tags] : []
    } else if (isOpen && !props.card) {
      form.title = ''
      form.description = ''
      form.assignee = ''
      form.priority = 'Medium'
      form.ticket = ''
      form.tags = []
    }
  }
)

function addTag() {
  const tag = tagInput.value.trim()
  if (tag && !form.tags.includes(tag)) {
    form.tags.push(tag)
    tagInput.value = ''
  }
}

function removeTag(tag: string) {
  form.tags = form.tags.filter((t) => t !== tag)
}

function save() {
  if (!form.title.trim()) return

  emit('save', {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    assignee: form.assignee.trim() || undefined,
    priority: form.priority,
    ticket: form.ticket.trim() || undefined,
    tags: form.tags.length > 0 ? form.tags : undefined
  })

  emit('update:open', false)
}

const priorityOptions = [
  { label: 'Low', value: 'Low' },
  { label: 'Medium', value: 'Medium' },
  { label: 'High', value: 'High' }
]
</script>

<template>
  <UModal
    :title="card ? 'Edit Card' : 'New Card'"
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <UCard>
        <UForm :state="form" @submit="save">
          <div class="space-y-3">
            <UFormField label="Title">
              <UInput v-model="form.title" placeholder="Card title" />
            </UFormField>

            <UFormField label="Description">
              <UTextarea
                v-model="form.description"
                placeholder="Card description"
                :rows="3"
                autoresize
              />
            </UFormField>

            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Assignee">
                <UInput v-model="form.assignee" placeholder="Username" />
              </UFormField>

              <UFormField label="Priority">
                <USelect v-model="form.priority" :items="priorityOptions" />
              </UFormField>
            </div>

            <UFormField label="Ticket">
              <UInput v-model="form.ticket" placeholder="e.g. MC-2037" />
            </UFormField>

            <UFormField label="Tags">
              <div class="space-y-2">
                <div class="flex gap-2">
                  <UInput v-model="tagInput" placeholder="Add a tag" @keyup.enter="addTag" />
                  <UButton icon="i-lucide-plus" size="sm" @click="addTag" />
                </div>
                <div v-if="form.tags.length" class="flex flex-wrap gap-2">
                  <UBadge v-for="tag in form.tags" :key="tag" color="neutral" variant="subtle">
                    {{ tag }}
                    <button type="button" class="ml-1" @click="removeTag(tag)">
                      <UIcon name="i-lucide-x" class="w-3 h-3" />
                    </button>
                  </UBadge>
                </div>
              </div>
            </UFormField>

            <div class="flex items-center gap-2 justify-between">
              <UButton
                v-if="card"
                label="Delete"
                color="error"
                variant="ghost"
                @click="emit('delete')"
              />
              <div class="flex items-center gap-2 ml-auto">
                <UButton
                  label="Cancel"
                  color="neutral"
                  variant="ghost"
                  @click="emit('update:open', false)"
                />
                <UButton type="submit" label="Save" :disabled="!form.title.trim()" />
              </div>
            </div>
          </div>
        </UForm>
      </UCard>
    </template>
  </UModal>
</template>
