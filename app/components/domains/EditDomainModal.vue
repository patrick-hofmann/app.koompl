<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui'

interface Props {
  open: boolean
  domain: { name?: string, smtp_password?: string, spam_action?: string } | null
  mode?: 'add' | 'edit'
}
const props = withDefaults(defineProps<Props>(), { mode: 'add' })
const emit = defineEmits<{ (e: 'update:open', v: boolean): void, (e: 'saved'): void }>()

const local = reactive<{ name?: string, smtp_password?: string, spam_action?: string }>({})

const spamActionItems: SelectItem[] = [
  { label: 'Disabled', value: '' },
  { label: 'Tag', value: 'tag' },
  { label: 'Disabled (block)', value: 'disabled' }
]

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    Object.assign(local, props.domain || {})
    if (local.spam_action === undefined || local.spam_action === null) {
      local.spam_action = ''
    }
  } else {
    Object.keys(local).forEach(k => (local as Record<string, unknown>)[k] = undefined)
  }
}, { immediate: true })

async function save() {
  if (props.mode === 'add') {
    await $fetch('/api/mailgun/domains', { method: 'POST', body: local })
  } else if (props.domain?.name) {
    await $fetch(`/api/mailgun/domains/${encodeURIComponent(props.domain.name)}`, { method: 'PATCH', body: local })
  }
  emit('update:open', false)
  emit('saved')
}
</script>

<template>
  <UModal title="Edit Domain" description="Edit the domain settings" :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard>
        <h3 class="font-medium text-highlighted mb-2">{{ mode === 'add' ? 'Add Domain' : 'Edit Domain' }}</h3>
        <UForm :state="local" @submit="save">
          <div class="space-y-3">
            <UFormField label="Domain Name">
              <UInput v-model="local.name" :disabled="mode==='edit'" placeholder="agents.mydomain.com" />
            </UFormField>
            <UFormField label="SMTP Password (optional)">
              <UInput v-model="local.smtp_password" type="password" autocomplete="off" placeholder="********" show-password-on-focus />
            </UFormField>
            <!-- <UFormField label="Spam Action (optional)">
              <USelect v-model="local.spam_action" :items="spamActionItems" placeholder="Select action" />
            </UFormField> -->
            <div class="flex items-center gap-2 justify-end">
              <UButton label="Cancel" color="neutral" variant="ghost" @click="emit('update:open', false)" />
              <UButton type="submit" :label="mode==='add' ? 'Add' : 'Save'" />
            </div>
          </div>
        </UForm>
      </UCard>
    </template>
  </UModal>
</template>
