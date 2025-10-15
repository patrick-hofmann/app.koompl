<script setup lang="ts">
import type { PredefinedKoompl } from '~/composables/useAgents'

definePageMeta({
  title: 'Template Gallery'
})

// No toasts needed for templates anymore

// Predefined Koompls from config
const { getPredefinedKoompls } = useAgents()
const predefinedKoompls = getPredefinedKoompls()

// Get team domain
const { session } = await useUserSession()
const { data: teamData } = await useAsyncData(
  'team-domain-templates',
  () => $fetch<{ teamId: string; teamName: string; domain: string | null }>('/api/team/domain'),
  { server: false, lazy: true }
)
const teamDomain = computed(
  () => teamData.value?.domain || session.value?.team?.domain || 'agents.local'
)

// Helper to construct full email
function constructFullEmail(username: string): string {
  return `${username}@${teamDomain.value}`
}

// All templates are considered active; compute display data only
const displayTemplates = computed(() => {
  return predefinedKoompls.map((pk) => {
    const username = pk.email.split('@')[0]
    return {
      ...pk,
      email: username,
      fullEmail: constructFullEmail(username)
    }
  })
})

// Info modal
const infoOpen = ref(false)
const infoKoompl = ref<PredefinedKoompl | null>(null)

function showInfo(koompl: PredefinedKoompl) {
  infoKoompl.value = koompl
  infoOpen.value = true
}

// No toggling anymore

// Test modals
const testOpen = ref(false)
const testAgentId = ref<string | null>(null)
const roundTripOpen = ref(false)
const roundTripAgentId = ref<string | null>(null)

function testPrompt(koompl: PredefinedKoompl) {
  testAgentId.value = koompl.id
  testOpen.value = true
}

function testRoundTrip(koompl: PredefinedKoompl) {
  roundTripAgentId.value = koompl.id
  roundTripOpen.value = true
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Template Gallery">
        <template #description> Browse and activate ready-made Koompls for your team </template>
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-xl font-semibold text-highlighted">Predefined Templates</h2>
            <p class="text-sm text-muted">
              Enable ready-made Koompls with pre-configured roles and capabilities
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AgentsPredefinedKoomplTile
            v-for="pk in displayTemplates"
            :key="pk.id"
            :koompl="pk"
            :team-domain="teamDomain"
            @info="showInfo(pk)"
            @test-prompt="testPrompt(pk)"
            @test-round-trip="testRoundTrip(pk)"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Info Modal -->
  <AgentsPredefinedKoomplInfoModal
    :open="infoOpen"
    :koompl="infoKoompl"
    :team-domain="teamDomain"
    @update:open="(v: boolean) => (infoOpen = v)"
  />

  <!-- Test Agent Modal -->
  <AgentsTestAgentModal
    :open="testOpen"
    :agent-id="testAgentId"
    @update:open="(v: boolean) => (testOpen = v)"
  />

  <!-- Round-trip Test Modal -->
  <AgentsRoundTripAgentModal
    :open="roundTripOpen"
    :agent-id="roundTripAgentId"
    @update:open="(v: boolean) => (roundTripOpen = v)"
  />
</template>
