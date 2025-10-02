<script setup lang="ts">
import type { CalendarEvent } from '~/server/types/calendar'

const props = defineProps<{
  events: CalendarEvent[]
  selectedUsers: string[]
}>()

const emit = defineEmits<{
  'event-click': [event: CalendarEvent]
  'day-click': [date: Date]
}>()

const currentDate = ref(new Date())

const currentMonth = computed(() => currentDate.value.getMonth())
const currentYear = computed(() => currentDate.value.getFullYear())

const monthName = computed(() => {
  return new Date(currentYear.value, currentMonth.value).toLocaleString('default', {
    month: 'long',
    year: 'numeric'
  })
})

const daysInMonth = computed(() => {
  return new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
})

const firstDayOfMonth = computed(() => {
  return new Date(currentYear.value, currentMonth.value, 1).getDay()
})

const days = computed(() => {
  const result: Array<{ date: number; events: CalendarEvent[] }> = []

  for (let i = 1; i <= daysInMonth.value; i++) {
    const date = new Date(currentYear.value, currentMonth.value, i)
    const dayEvents = props.events.filter((event) => {
      const eventStart = new Date(event.startDate)
      const eventEnd = new Date(event.endDate)
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

      return eventStart <= dayEnd && eventEnd >= dayStart
    })

    result.push({
      date: i,
      events: dayEvents
    })
  }

  return result
})

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function previousMonth() {
  if (currentMonth.value === 0) {
    currentDate.value = new Date(currentYear.value - 1, 11)
  } else {
    currentDate.value = new Date(currentYear.value, currentMonth.value - 1)
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentDate.value = new Date(currentYear.value + 1, 0)
  } else {
    currentDate.value = new Date(currentYear.value, currentMonth.value + 1)
  }
}

function goToToday() {
  currentDate.value = new Date()
}

function handleEventClick(event: CalendarEvent) {
  emit('event-click', event)
}

function handleDayClick(day: number) {
  const date = new Date(currentYear.value, currentMonth.value, day)
  emit('day-click', date)
}

function isToday(day: number) {
  const today = new Date()
  return (
    day === today.getDate() &&
    currentMonth.value === today.getMonth() &&
    currentYear.value === today.getFullYear()
  )
}

function formatEventTime(event: CalendarEvent) {
  if (event.allDay) return 'All day'
  const start = new Date(event.startDate)
  return start.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Calendar Header -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">{{ monthName }}</h2>
      <div class="flex items-center gap-2">
        <UButton icon="i-lucide-chevron-left" size="sm" variant="ghost" @click="previousMonth" />
        <UButton label="Today" size="sm" variant="ghost" @click="goToToday" />
        <UButton icon="i-lucide-chevron-right" size="sm" variant="ghost" @click="nextMonth" />
      </div>
    </div>

    <!-- Calendar Grid -->
    <div class="flex-1 overflow-auto">
      <div
        class="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700"
      >
        <!-- Week day headers -->
        <div
          v-for="day in weekDays"
          :key="day"
          class="bg-white dark:bg-gray-800 p-2 text-center text-sm font-semibold"
        >
          {{ day }}
        </div>

        <!-- Empty cells for days before first day of month -->
        <div
          v-for="i in firstDayOfMonth"
          :key="`empty-${i}`"
          class="bg-gray-50 dark:bg-gray-900 min-h-24"
        />

        <!-- Calendar days -->
        <div
          v-for="day in days"
          :key="day.date"
          class="bg-white dark:bg-gray-800 min-h-24 p-2 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
          :class="{
            'ring-2 ring-primary': isToday(day.date)
          }"
          @click="handleDayClick(day.date)"
        >
          <div class="text-sm font-medium mb-1" :class="{ 'text-primary': isToday(day.date) }">
            {{ day.date }}
          </div>
          <div class="space-y-1">
            <div
              v-for="event in day.events.slice(0, 3)"
              :key="event.id"
              class="text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
              :style="{
                backgroundColor: event.color || '#3b82f6',
                color: 'white'
              }"
              @click.stop="handleEventClick(event)"
            >
              <span class="font-medium">{{ formatEventTime(event) }}</span> {{ event.title }}
            </div>
            <div v-if="day.events.length > 3" class="text-xs text-muted">
              +{{ day.events.length - 3 }} more
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
