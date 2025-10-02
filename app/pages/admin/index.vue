<script setup lang="ts">
import type { IdentityData, AuthUser, Team } from '~/types'

const toast = useToast()

definePageMeta({
  middleware: 'require-super-admin'
})

type MembershipRow = {
  id: string
  role: 'admin' | 'user'
  createdAt?: string
  updatedAt?: string
  user: AuthUser
  team: Team
}

const {
  data: identityData,
  pending,
  error,
  refresh
} = await useFetch<IdentityData>('/api/admin/identity', {
  default: () => ({ users: [], teams: [], memberships: [], superAdminIds: [] }),
  server: false
})

const editingUserId = ref<string | null>(null)
const userForm = reactive({
  name: '',
  email: '',
  password: ''
})
const isSavingUser = ref(false)

const editingTeamId = ref<string | null>(null)
const teamForm = reactive({
  name: '',
  description: ''
})
const isSavingTeam = ref(false)

const membershipForm = reactive({
  userId: '',
  teamId: '',
  role: 'user' as 'admin' | 'user'
})
const isSavingMembership = ref(false)

const processingIds = reactive({
  user: new Set<string>(),
  team: new Set<string>(),
  membership: new Set<string>(),
  superAdmin: new Set<string>()
})

const identity = computed(
  () => identityData.value || { users: [], teams: [], memberships: [], superAdminIds: [] }
)
const superAdminSet = computed(() => new Set(identity.value.superAdminIds || []))

const usersById = computed<Record<string, AuthUser>>(() => {
  return (identity.value.users || []).reduce(
    (acc, user) => {
      acc[user.id] = user
      return acc
    },
    {} as Record<string, AuthUser>
  )
})

const teamsById = computed<Record<string, Team>>(() => {
  return (identity.value.teams || []).reduce(
    (acc, team) => {
      acc[team.id] = team
      return acc
    },
    {} as Record<string, Team>
  )
})

const membershipRows = computed<MembershipRow[]>(() => {
  const rows = (identity.value.memberships || [])
    .map((membership) => {
      const user = usersById.value[membership.userId]
      const team = teamsById.value[membership.teamId]
      if (!user || !team) {
        return null
      }
      return {
        id: membership.id,
        role: membership.role,
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
        user,
        team
      }
    })
    .filter(Boolean) as MembershipRow[]

  return rows
})

const userItems = computed(() => {
  return (identity.value.users || []).map((user) => ({
    label: user.name,
    value: user.id,
    description: user.email
  }))
})

const teamItems = computed(() => {
  return (identity.value.teams || []).map((team) => ({
    label: team.name,
    value: team.id,
    description: team.description || ''
  }))
})

function parseErrorMessage(err: unknown, fallback = 'Something went wrong') {
  if (err && typeof err === 'object') {
    const errorObject = err as {
      statusMessage?: string
      message?: string
      data?: { statusMessage?: string; message?: string }
    }
    return (
      errorObject?.data?.statusMessage ||
      errorObject?.data?.message ||
      errorObject?.statusMessage ||
      errorObject?.message ||
      fallback
    )
  }
  return fallback
}

async function refreshIdentity() {
  await refresh()
}

function resetUserForm() {
  editingUserId.value = null
  userForm.name = ''
  userForm.email = ''
  userForm.password = ''
}

function resetTeamForm() {
  editingTeamId.value = null
  teamForm.name = ''
  teamForm.description = ''
}

async function submitUser() {
  if (isSavingUser.value) {
    return
  }
  isSavingUser.value = true
  try {
    if (editingUserId.value) {
      await $fetch(`/api/admin/users/${editingUserId.value}`, {
        method: 'PATCH',
        body: {
          name: userForm.name,
          email: userForm.email,
          ...(userForm.password ? { password: userForm.password } : {})
        }
      })
      toast.add({ title: 'User updated', color: 'success' })
    } else {
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: {
          name: userForm.name,
          email: userForm.email,
          password: userForm.password
        }
      })
      toast.add({ title: 'User created', color: 'success' })
    }
    await refreshIdentity()
    resetUserForm()
  } catch (err) {
    toast.add({
      title: parseErrorMessage(
        err,
        editingUserId.value ? 'Failed to update user' : 'Failed to create user'
      ),
      color: 'error'
    })
  } finally {
    isSavingUser.value = false
  }
}

async function submitTeam() {
  if (isSavingTeam.value) {
    return
  }
  isSavingTeam.value = true
  try {
    if (editingTeamId.value) {
      await $fetch(`/api/admin/teams/${editingTeamId.value}`, {
        method: 'PATCH',
        body: {
          name: teamForm.name,
          description: teamForm.description
        }
      })
      toast.add({ title: 'Team updated', color: 'success' })
    } else {
      await $fetch('/api/admin/teams', {
        method: 'POST',
        body: {
          name: teamForm.name,
          description: teamForm.description
        }
      })
      toast.add({ title: 'Team created', color: 'success' })
    }
    await refreshIdentity()
    resetTeamForm()
  } catch (err) {
    toast.add({
      title: parseErrorMessage(
        err,
        editingTeamId.value ? 'Failed to update team' : 'Failed to create team'
      ),
      color: 'error'
    })
  } finally {
    isSavingTeam.value = false
  }
}

async function submitMembership() {
  if (isSavingMembership.value) {
    return
  }
  isSavingMembership.value = true
  try {
    await $fetch('/api/admin/memberships', {
      method: 'POST',
      body: {
        userId: membershipForm.userId,
        teamId: membershipForm.teamId,
        role: membershipForm.role
      }
    })
    toast.add({ title: 'Membership added', color: 'success' })
    await refreshIdentity()
    membershipForm.userId = ''
    membershipForm.teamId = ''
    membershipForm.role = 'user'
  } catch (err) {
    toast.add({ title: parseErrorMessage(err, 'Failed to add membership'), color: 'error' })
  } finally {
    isSavingMembership.value = false
  }
}

async function removeUser(user: AuthUser) {
  if (processingIds.user.has(user.id)) {
    return
  }
  processingIds.user.add(user.id)
  try {
    await $fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    toast.add({ title: 'User removed', color: 'success' })
    await refreshIdentity()
    if (editingUserId.value === user.id) {
      resetUserForm()
    }
  } catch (err) {
    toast.add({ title: parseErrorMessage(err, 'Failed to remove user'), color: 'error' })
  } finally {
    processingIds.user.delete(user.id)
  }
}

async function removeTeam(team: Team) {
  if (processingIds.team.has(team.id)) {
    return
  }
  processingIds.team.add(team.id)
  try {
    await $fetch(`/api/admin/teams/${team.id}`, { method: 'DELETE' })
    toast.add({ title: 'Team removed', color: 'success' })
    await refreshIdentity()
    if (editingTeamId.value === team.id) {
      resetTeamForm()
    }
  } catch (err) {
    toast.add({ title: parseErrorMessage(err, 'Failed to remove team'), color: 'error' })
  } finally {
    processingIds.team.delete(team.id)
  }
}

async function removeMembership(id: string) {
  if (processingIds.membership.has(id)) {
    return
  }
  processingIds.membership.add(id)
  try {
    await $fetch(`/api/admin/memberships/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Membership removed', color: 'success' })
    await refreshIdentity()
  } catch (err) {
    toast.add({ title: parseErrorMessage(err, 'Failed to remove membership'), color: 'error' })
  } finally {
    processingIds.membership.delete(id)
  }
}

async function toggleMembershipRole(id: string, currentRole: 'admin' | 'user') {
  if (processingIds.membership.has(id)) {
    return
  }
  processingIds.membership.add(id)
  const nextRole = currentRole === 'admin' ? 'user' : 'admin'
  try {
    await $fetch(`/api/admin/memberships/${id}`, {
      method: 'PATCH',
      body: { role: nextRole }
    })
    toast.add({ title: `Membership set to ${nextRole}`, color: 'success' })
    await refreshIdentity()
  } catch (err) {
    toast.add({ title: parseErrorMessage(err, 'Failed to update membership'), color: 'error' })
  } finally {
    processingIds.membership.delete(id)
  }
}

async function toggleSuperAdmin(user: AuthUser) {
  if (processingIds.superAdmin.has(user.id)) {
    return
  }
  processingIds.superAdmin.add(user.id)
  const currentlySuper = superAdminSet.value.has(user.id)
  try {
    if (currentlySuper) {
      await $fetch(`/api/admin/super-admins/${user.id}`, { method: 'DELETE' })
      toast.add({ title: 'Super admin revoked', color: 'success' })
    } else {
      await $fetch('/api/admin/super-admins', {
        method: 'POST',
        body: { userId: user.id }
      })
      toast.add({ title: 'User is now super admin', color: 'success' })
    }
    await refreshIdentity()
  } catch (err) {
    toast.add({
      title: parseErrorMessage(err, 'Failed to update super admin status'),
      color: 'error'
    })
  } finally {
    processingIds.superAdmin.delete(user.id)
  }
}

function startEditUser(user: AuthUser) {
  editingUserId.value = user.id
  userForm.name = user.name
  userForm.email = user.email
  userForm.password = ''
}

function startEditTeam(team: Team) {
  editingTeamId.value = team.id
  teamForm.name = team.name
  teamForm.description = team.description || ''
}

function formatDateTime(value?: string) {
  if (!value) {
    return ''
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value))
  } catch {
    return value
  }
}
</script>

<template>
  <UDashboardPanel id="admin">
    <template #header>
      <UDashboardNavbar title="Admin" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <UAlert
          v-if="error"
          icon="i-lucide-alert-triangle"
          :title="parseErrorMessage(error, 'Failed to load identity data')"
          color="error"
          variant="subtle"
        />

        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-base font-medium text-highlighted">Users</h3>
                <p class="text-sm text-muted">Manage application users and elevate privileges.</p>
              </div>
              <UButton
                v-if="editingUserId"
                color="neutral"
                variant="ghost"
                label="Cancel edit"
                @click="resetUserForm"
              />
            </div>
          </template>

          <div class="space-y-6">
            <div class="grid gap-4">
              <div
                v-for="user in identity.users"
                :key="user.id"
                class="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-default p-4"
              >
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <h4 class="font-medium text-highlighted">{{ user.name }}</h4>
                    <UBadge
                      v-if="superAdminSet.has(user.id)"
                      label="Super admin"
                      color="primary"
                      size="xs"
                    />
                  </div>
                  <p class="text-sm text-muted">{{ user.email }}</p>
                  <p class="text-xs text-muted">User-ID: {{ user.id }}</p>
                  <p v-if="user.updatedAt" class="text-xs text-muted">
                    Updated {{ formatDateTime(user.updatedAt) }}
                  </p>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="solid"
                    icon="i-lucide-pencil"
                    @click="startEditUser(user)"
                  >
                    Edit
                  </UButton>
                  <UButton
                    size="xs"
                    :color="superAdminSet.has(user.id) ? 'warning' : 'neutral'"
                    variant="subtle"
                    :loading="processingIds.superAdmin.has(user.id)"
                    icon="i-lucide-shield"
                    @click="toggleSuperAdmin(user)"
                  >
                    {{ superAdminSet.has(user.id) ? 'Revoke super admin' : 'Make super admin' }}
                  </UButton>
                  <UButton
                    size="xs"
                    color="error"
                    variant="outline"
                    icon="i-lucide-trash"
                    :loading="processingIds.user.has(user.id)"
                    @click="removeUser(user)"
                  >
                    Delete
                  </UButton>
                </div>
              </div>
              <p v-if="!identity.users.length && !pending" class="text-sm text-muted">
                No users yet. Add your first user below.
              </p>
            </div>

            <USeparator />

            <form class="grid gap-4 md:grid-cols-3" @submit.prevent="submitUser">
              <UFormField label="Name" class="md:col-span-1">
                <UInput v-model="userForm.name" placeholder="Jane Doe" required />
              </UFormField>
              <UFormField label="Email" class="md:col-span-1">
                <UInput
                  v-model="userForm.email"
                  type="email"
                  placeholder="jane@example.com"
                  required
                />
              </UFormField>
              <UFormField
                :label="editingUserId ? 'Password (optional)' : 'Password'"
                class="md:col-span-1"
              >
                <UInput
                  v-model="userForm.password"
                  type="password"
                  :required="!editingUserId"
                  placeholder="••••••••"
                />
              </UFormField>
              <div class="md:col-span-3 flex justify-end gap-2">
                <UButton
                  type="submit"
                  :label="editingUserId ? 'Update user' : 'Add user'"
                  :loading="isSavingUser"
                />
              </div>
            </form>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-base font-medium text-highlighted">Teams</h3>
                <p class="text-sm text-muted">Create collaborative spaces and assign members.</p>
              </div>
              <UButton
                v-if="editingTeamId"
                color="neutral"
                variant="ghost"
                label="Cancel edit"
                @click="resetTeamForm"
              />
            </div>
          </template>

          <div class="space-y-6">
            <div class="grid gap-4">
              <div
                v-for="team in identity.teams"
                :key="team.id"
                class="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-default p-4"
              >
                <div class="space-y-1">
                  <h4 class="font-medium text-highlighted">{{ team.name }}</h4>
                  <p v-if="team.description" class="text-sm text-muted">{{ team.description }}</p>
                  <p class="text-xs text-muted">Team-ID: {{ team.id }}</p>
                  <p class="text-xs text-muted">
                    Members: {{ identity.memberships.filter((m) => m.teamId === team.id).length }}
                  </p>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="solid"
                    icon="i-lucide-pencil"
                    @click="startEditTeam(team)"
                  >
                    Edit
                  </UButton>
                  <UButton
                    size="xs"
                    color="error"
                    variant="outline"
                    icon="i-lucide-trash"
                    :loading="processingIds.team.has(team.id)"
                    @click="removeTeam(team)"
                  >
                    Delete
                  </UButton>
                </div>
              </div>
              <p v-if="!identity.teams.length && !pending" class="text-sm text-muted">
                No teams configured yet.
              </p>
            </div>

            <USeparator />

            <form class="grid gap-4 md:grid-cols-3" @submit.prevent="submitTeam">
              <UFormField label="Name" class="md:col-span-1">
                <UInput v-model="teamForm.name" placeholder="Core team" required />
              </UFormField>
              <UFormField label="Description" class="md:col-span-2">
                <UInput v-model="teamForm.description" placeholder="Optional description" />
              </UFormField>
              <div class="md:col-span-3 flex justify-end gap-2">
                <UButton
                  type="submit"
                  :label="editingTeamId ? 'Update team' : 'Add team'"
                  :loading="isSavingTeam"
                />
              </div>
            </form>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-medium text-highlighted">Team Memberships</h3>
                <p class="text-sm text-muted">Link users to teams and set their role.</p>
              </div>
              <UButton
                color="neutral"
                variant="outline"
                icon="i-lucide-refresh-ccw"
                :loading="pending"
                @click="refreshIdentity"
              >
                Refresh
              </UButton>
            </div>
          </template>

          <div class="space-y-6">
            <div class="grid gap-4">
              <div
                v-for="membership in membershipRows"
                :key="membership.id"
                class="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-default p-4"
              >
                <div class="space-y-1">
                  <div class="flex items-center gap-2 text-sm">
                    <span class="font-medium text-highlighted">{{ membership.user.name }}</span>
                    <span class="text-muted">→</span>
                    <span class="font-medium text-highlighted">{{ membership.team.name }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <UBadge
                      :label="membership.role === 'admin' ? 'Admin' : 'Member'"
                      :color="membership.role === 'admin' ? 'primary' : 'neutral'"
                    />
                    <p v-if="membership.updatedAt" class="text-xs text-muted">
                      Updated {{ formatDateTime(membership.updatedAt) }}
                    </p>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="subtle"
                    icon="i-lucide-shield-check"
                    :loading="processingIds.membership.has(membership.id)"
                    @click="toggleMembershipRole(membership.id, membership.role)"
                  >
                    Make {{ membership.role === 'admin' ? 'member' : 'admin' }}
                  </UButton>
                  <UButton
                    size="xs"
                    color="error"
                    variant="outline"
                    icon="i-lucide-trash"
                    :loading="processingIds.membership.has(membership.id)"
                    @click="removeMembership(membership.id)"
                  >
                    Remove
                  </UButton>
                </div>
              </div>
              <p v-if="!membershipRows.length && !pending" class="text-sm text-muted">
                No memberships defined yet.
              </p>
            </div>

            <USeparator />

            <form class="grid gap-4 md:grid-cols-4" @submit.prevent="submitMembership">
              <UFormField label="User" class="md:col-span-1">
                <USelectMenu
                  v-model="membershipForm.userId"
                  :items="userItems"
                  value-key="value"
                  label-key="label"
                  :filter-fields="['label', 'description']"
                  placeholder="Select user"
                  searchable
                  required
                />
              </UFormField>
              <UFormField label="Team" class="md:col-span-1">
                <USelectMenu
                  v-model="membershipForm.teamId"
                  :items="teamItems"
                  value-key="value"
                  label-key="label"
                  :filter-fields="['label', 'description']"
                  placeholder="Select team"
                  searchable
                  required
                />
              </UFormField>
              <UFormField label="Role" class="md:col-span-1">
                <USelect
                  v-model="membershipForm.role"
                  :items="[
                    { label: 'Member', value: 'user' },
                    { label: 'Admin', value: 'admin' }
                  ]"
                  required
                />
              </UFormField>
              <div class="md:col-span-1 flex justify-end items-end">
                <UButton
                  type="submit"
                  label="Add membership"
                  :loading="isSavingMembership"
                  class="w-full"
                />
              </div>
            </form>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
