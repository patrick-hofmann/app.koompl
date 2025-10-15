<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

definePageMeta({
  title: 'Koompls'
})

const { session } = await useUserSession()

// Get team domain
const { data: teamData } = await useAsyncData(
  'team-domain-agents',
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

// Get predefined koompls from config
const { getPredefinedKoompls } = useAgents()
const predefinedKoompls = getPredefinedKoompls()

// Fetch all agents (only predefined agents are supported now)
const { data: agents } = await useAsyncData('agents', () => $fetch<Agent[]>('/api/agents'), {
  server: false,
  lazy: true
})

// Track which predefined Koompls are enabled and get actual agent data
const enabledPredefined = computed(() => {
  const agentsList = agents.value || []
  return predefinedKoompls.map((pk) => {
    const actualAgent = agentsList.find((a) => a.id === pk.id && a.isPredefined)
    const username = actualAgent?.email || pk.email.split('@')[0]
    return {
      ...pk,
      email: username,
      fullEmail: constructFullEmail(username),
      enabled: !!actualAgent,
      mailLink: actualAgent ? `/agents/${actualAgent.id}` : undefined
    }
  })
})

const actions = ref<NavigationMenuItem[]>([])

function updateActions() {
  const predefinedItems = enabledPredefined.value
    .filter((pk) => pk.enabled && pk.mailLink)
    .map((pk) => ({
      label: pk.name,
      icon: 'i-lucide-user',
      to: pk.mailLink!
    }))

  actions.value = [
    {
      label: 'View Predefined Mailboxes',
      icon: 'i-lucide-mail',
      children: predefinedItems.length > 0 ? predefinedItems : undefined
    }
  ]
}

watch([agents, enabledPredefined], updateActions, { immediate: true })

// Test modal state
const testOpen = ref(false)
const testAgentId = ref<string | null>(null)
const roundTripOpen = ref(false)
const roundTripAgentId = ref<string | null>(null)

function testPredefined(id: string) {
  testAgentId.value = id
  testOpen.value = true
}

function testPredefinedRoundTrip(id: string) {
  roundTripAgentId.value = id
  roundTripOpen.value = true
}

// Info modal state
const infoOpen = ref(false)
const infoKoompl = ref<PredefinedKoompl | null>(null)

function openInfo(koompl: PredefinedKoompl) {
  infoKoompl.value = koompl
  infoOpen.value = true
}

// No toggle flow anymore
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardPanelHeader
        icon="i-lucide-users"
        title="Koompls"
        description="Manage your AI agents"
        :actions="actions"
      />
    </template>

    <template #content>
      <div class="space-y-6">
        <!-- Predefined Koompls Section -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-lg font-semibold text-highlighted">Predefined Koompls</h2>
              <p class="text-sm text-muted">AI agents with specialized capabilities</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AgentsPredefinedKoomplTile
              v-for="pk in enabledPredefined"
              :key="pk.id"
              :koompl="pk"
              @info="openInfo(pk)"
              @test-prompt="testPredefined(pk.id)"
              @test-round-trip="testPredefinedRoundTrip(pk.id)"
            />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

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

  <!-- Predefined Koompl Info Modal -->
  <AgentsPredefinedKoomplInfoModal
    :open="infoOpen"
    :koompl="infoKoompl"
    @update:open="(v: boolean) => (infoOpen = v)"
  />
</template>
