<script setup lang="ts">
import type { PredefinedKoompl } from '~/composables/usePredefinedKoompls'

interface Props {
  open: boolean
  koompl: PredefinedKoompl | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const iconBgClass = computed(() => {
  if (!props.koompl) return ''
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
  }
  return colors[props.koompl.color] || colors.blue
})
</script>

<template>
  <UModal
    :open="open"
    :title="koompl?.name || 'Predefined Koompl'"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <UCard v-if="koompl">
        <div class="max-h-[70vh] overflow-y-auto space-y-6">
          <!-- Header -->
          <div class="flex items-start gap-4">
            <div :class="['rounded-xl p-4', iconBgClass]">
              <UIcon :name="koompl.icon" class="w-8 h-8" />
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-highlighted mb-1">{{ koompl.name }}</h3>
              <p class="text-sm text-muted mb-2">{{ koompl.email }}@{{ teamDomain }}</p>
              <UBadge :color="koompl.color" variant="subtle">
                {{ koompl.role }}
              </UBadge>
            </div>
          </div>

          <!-- Description -->
          <div>
            <h4 class="text-sm font-medium text-highlighted mb-2">Description</h4>
            <p class="text-sm text-default">{{ koompl.description }}</p>
          </div>

          <USeparator />

          <!-- System Prompt -->
          <div>
            <h4 class="text-sm font-medium text-highlighted mb-3 flex items-center gap-2">
              <UIcon name="i-lucide-message-square-code" class="w-4 h-4" />
              System Prompt
            </h4>
            <div class="bg-muted/30 rounded-lg p-4 border border-default">
              <pre class="text-xs text-default whitespace-pre-wrap font-mono leading-relaxed">{{
                koompl.prompt
              }}</pre>
            </div>
          </div>

          <!-- Configuration Details -->
          <div>
            <h4 class="text-sm font-medium text-highlighted mb-3 flex items-center gap-2">
              <UIcon name="i-lucide-settings" class="w-4 h-4" />
              Configuration
            </h4>
            <div class="space-y-3 text-sm">
              <div class="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-md">
                <span class="text-muted">Max Rounds</span>
                <span class="font-medium text-highlighted">{{
                  koompl.multiRoundConfig.maxRounds
                }}</span>
              </div>
              <div class="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-md">
                <span class="text-muted">Timeout</span>
                <span class="font-medium text-highlighted"
                  >{{ koompl.multiRoundConfig.timeoutMinutes }} minutes</span
                >
              </div>
              <div class="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-md">
                <span class="text-muted">Inter-Agent Communication</span>
                <UBadge
                  :color="koompl.multiRoundConfig.canCommunicateWithAgents ? 'green' : 'gray'"
                  variant="subtle"
                  size="xs"
                >
                  {{ koompl.multiRoundConfig.canCommunicateWithAgents ? 'Enabled' : 'Disabled' }}
                </UBadge>
              </div>
              <div class="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-md">
                <span class="text-muted">Auto-Resume</span>
                <UBadge
                  :color="koompl.multiRoundConfig.autoResumeOnResponse ? 'green' : 'gray'"
                  variant="subtle"
                  size="xs"
                >
                  {{ koompl.multiRoundConfig.autoResumeOnResponse ? 'Enabled' : 'Disabled' }}
                </UBadge>
              </div>
            </div>
          </div>

          <!-- MCP Servers -->
          <div v-if="koompl.mcpServerIds.length > 0">
            <h4 class="text-sm font-medium text-highlighted mb-3 flex items-center gap-2">
              <UIcon name="i-lucide-plug" class="w-4 h-4" />
              MCP Servers
            </h4>
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="serverId in koompl.mcpServerIds"
                :key="serverId"
                variant="outline"
                size="sm"
              >
                {{ serverId }}
              </UBadge>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end pt-4 border-t border-default">
            <UButton
              label="Close"
              color="neutral"
              variant="ghost"
              @click="emit('update:open', false)"
            />
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>
