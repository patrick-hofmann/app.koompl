<script setup lang="ts">
import type { CalendarEvent } from '~/server/types/calendar'
import EventModal from '~/components/calendar/EventModal.vue'
import CalendarView from '~/components/calendar/CalendarView.vue'

const toast = useToast()

// Fetch team members
const { data: membersData } = await useFetch('/api/members', {
  server: false,
  default: () => ({ members: [] })
})

const members = computed(() => membersData.value?.members ?? [])

// User filtering
const selectedUserIds = ref<string[]>([])
const showAllUsers = ref(true)

// Fetch calendar events
const { data, pending, refresh } = await useFetch<{ events: CalendarEvent[] }>(
  '/api/calendar/events',
  {
    server: false,
    default: () => ({ events: [] }),
    query: computed(() => ({
      userIds: showAllUsers.value ? undefined : selectedUserIds.value
    }))
  }
)

const events = computed(() => data.value?.events ?? [])

// Filter events based on selected users
const filteredEvents = computed(() => {
  if (showAllUsers.value) {
    return events.value
  }
  return events.value.filter((event) => selectedUserIds.value.includes(event.userId))
})

// Modals
const showEventModal = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)
const newEventDate = ref<Date | null>(null)

// Get user color by ID (for consistent coloring)
function getUserColor(userId: string) {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4']
  const index = members.value.findIndex((m: any) => m.id === userId)
  return colors[index % colors.length]
}

// Toggle user selection
function toggleUser(userId: string) {
  const index = selectedUserIds.value.indexOf(userId)
  if (index === -1) {
    selectedUserIds.value.push(userId)
  } else {
    selectedUserIds.value.splice(index, 1)
  }
}

function toggleAllUsers() {
  showAllUsers.value = !showAllUsers.value
  if (showAllUsers.value) {
    selectedUserIds.value = []
  }
}

// Open modal for new event
function openNewEventModal(date?: Date) {
  editingEvent.value = null
  newEventDate.value = date || new Date()
  showEventModal.value = true
}

// Open modal for editing event
function openEditEventModal(event: CalendarEvent) {
  editingEvent.value = event
  newEventDate.value = null
  showEventModal.value = true
}

// Save event (create or update)
async function saveEvent(eventData: Partial<CalendarEvent>) {
  try {
    if (editingEvent.value) {
      // Update existing event
      await $fetch(`/api/calendar/events/${editingEvent.value.id}`, {
        method: 'PATCH',
        body: eventData
      })
      toast.add({
        title: 'Event updated',
        color: 'success',
        icon: 'i-lucide-check'
      })
    } else {
      // Create new event
      await $fetch('/api/calendar/events', {
        method: 'POST',
        body: eventData
      })
      toast.add({
        title: 'Event created',
        color: 'success',
        icon: 'i-lucide-check'
      })
    }
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Failed to save event',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  }
}

// Delete event
async function deleteEvent() {
  if (!editingEvent.value) return

  try {
    await $fetch(`/api/calendar/events/${editingEvent.value.id}`, {
      method: 'DELETE'
    })
    toast.add({
      title: 'Event deleted',
      color: 'success',
      icon: 'i-lucide-check'
    })
    showEventModal.value = false
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Failed to delete event',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  }
}

// Handle day click to create new event
function handleDayClick(date: Date) {
  openNewEventModal(date)
}

// Handle event click to edit
function handleEventClick(event: CalendarEvent) {
  openEditEventModal(event)
}

// User items for the multiselect
const userItems = computed(() =>
  members.value.map((member: any) => ({
    id: member.id,
    label: member.name,
    avatar: member.avatar
  }))
)
</script>

<template>
  <UDashboardPanel id="calendar">
    <template #header>
      <UDashboardNavbar title="Team Calendar">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton label="New Event" icon="i-lucide-plus" @click="openNewEventModal()" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex h-full">
        <!-- Sidebar with user filters -->
        <div
          class="w-64 border-r border-gray-200 dark:border-gray-700 p-4 space-y-4 overflow-y-auto"
        >
          <div>
            <h3 class="text-sm font-semibold mb-3">Team Members</h3>

            <div class="space-y-2">
              <UCheckbox v-model="showAllUsers" label="Show All" @change="toggleAllUsers" />

              <div v-if="!showAllUsers" class="space-y-2 pl-4">
                <div v-for="member in userItems" :key="member.id" class="flex items-center gap-2">
                  <UCheckbox
                    :model-value="selectedUserIds.includes(member.id)"
                    @update:model-value="toggleUser(member.id)"
                  />
                  <UAvatar v-if="member.avatar" v-bind="member.avatar" size="xs" />
                  <span class="text-sm">{{ member.label }}</span>
                </div>
              </div>
            </div>
          </div>

          <USeparator />

          <div>
            <h3 class="text-sm font-semibold mb-2">Legend</h3>
            <div class="space-y-2">
              <div
                v-for="member in userItems"
                :key="`legend-${member.id}`"
                class="flex items-center gap-2"
              >
                <div
                  class="w-4 h-4 rounded"
                  :style="{ backgroundColor: getUserColor(member.id) }"
                />
                <span class="text-xs">{{ member.label }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Calendar view -->
        <div class="flex-1 p-6">
          <ClientOnly>
            <div v-if="pending" class="flex items-center justify-center h-full">
              <div class="flex flex-col items-center gap-4">
                <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin" />
                <p class="text-muted">Loading calendar...</p>
              </div>
            </div>

            <CalendarView
              v-else
              :events="filteredEvents"
              :selected-users="selectedUserIds"
              @event-click="handleEventClick"
              @day-click="handleDayClick"
            />
          </ClientOnly>
        </div>

        <!-- Event Modal -->
        <EventModal
          :open="showEventModal"
          :event="editingEvent || undefined"
          @update:open="showEventModal = $event"
          @save="saveEvent"
          @delete="deleteEvent"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
