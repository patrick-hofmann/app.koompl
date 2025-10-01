import { nanoid } from 'nanoid'

type IdentityRole = 'admin' | 'user'

export interface IdentityUser {
  id: string
  name: string
  email: string
  password: string
  createdAt?: string
  updatedAt?: string
}

export interface IdentityTeam {
  id: string
  name: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface IdentityMembership {
  id: string
  userId: string
  teamId: string
  role: IdentityRole
  createdAt?: string
  updatedAt?: string
}

export interface IdentityData {
  users: IdentityUser[]
  teams: IdentityTeam[]
  memberships: IdentityMembership[]
  superAdminIds: string[]
}

const STORAGE_NAMESPACE = 'identity'
const STORAGE_KEY = 'identity.json'

const DEFAULT_DATA: IdentityData = {
  users: [
    {
      id: '1',
      name: 'Member 1',
      email: 'test1@delta-mind.at',
      password: 'password1'
    },
    {
      id: '2',
      name: 'Member 2',
      email: 'test2@delta-mind.at',
      password: 'password2'
    }
  ],
  teams: [
    {
      id: '1',
      name: 'Team 1',
      description: 'Team 1 description'
    },
    {
      id: '2',
      name: 'Team 2',
      description: 'Team 2 description'
    }
  ],
  memberships: [
    {
      id: '1',
      userId: '1',
      teamId: '1',
      role: 'admin'
    },
    {
      id: '2',
      userId: '2',
      teamId: '1',
      role: 'user'
    },
    {
      id: '3',
      userId: '2',
      teamId: '2',
      role: 'admin'
    }
  ],
  superAdminIds: []
}

function cloneData<T>(value: T): T {
  return value ? (JSON.parse(JSON.stringify(value)) as T) : value
}

function withTimestamps<T extends { createdAt?: string; updatedAt?: string }>(
  entity: T,
  isNew: boolean
): T {
  const now = new Date().toISOString()
  if (isNew) {
    entity.createdAt = now
  }
  entity.updatedAt = now
  return entity
}

async function readStorage(): Promise<IdentityData | null> {
  const storage = useStorage(STORAGE_NAMESPACE)
  return storage.getItem<IdentityData>(STORAGE_KEY)
}

async function writeStorage(data: IdentityData): Promise<void> {
  const storage = useStorage(STORAGE_NAMESPACE)
  await storage.setItem(STORAGE_KEY, data)
}

export async function getIdentity(): Promise<IdentityData> {
  const existing = await readStorage()
  if (
    existing &&
    Array.isArray(existing.users) &&
    Array.isArray(existing.teams) &&
    Array.isArray(existing.memberships) &&
    Array.isArray(existing.superAdminIds)
  ) {
    return cloneData(existing)
  }

  const initial = cloneData(DEFAULT_DATA)
  await writeStorage(initial)
  return initial
}

export async function saveIdentity(next: IdentityData): Promise<IdentityData> {
  const normalized: IdentityData = {
    users: cloneData(next.users || []),
    teams: cloneData(next.teams || []),
    memberships: cloneData(next.memberships || []),
    superAdminIds: Array.from(new Set(next.superAdminIds || [])).filter(Boolean)
  }
  await writeStorage(normalized)
  return normalized
}

export async function upsertUser(
  payload: Omit<IdentityUser, 'id'> & { id?: string }
): Promise<IdentityUser> {
  const data = await getIdentity()
  const users = data.users || []
  const name = String(payload.name || '').trim()
  const email = String(payload.email || '')
    .trim()
    .toLowerCase()
  const password = String(payload.password || '').trim()

  if (!name || !email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user payload' })
  }

  const conflictingUser = users.find(
    (user) => user.email.toLowerCase() === email && user.id !== payload.id
  )
  if (conflictingUser) {
    throw createError({ statusCode: 409, statusMessage: 'Email already in use' })
  }

  if (payload.id) {
    const idx = users.findIndex((user) => user.id === payload.id)
    if (idx === -1) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }
    const updated = withTimestamps(
      { ...users[idx], name, email, password, id: payload.id },
      !users[idx].createdAt
    )
    users[idx] = updated
    await saveIdentity({ ...data, users })
    return updated
  }

  const id = nanoid(12)
  const newUser = withTimestamps(
    {
      id,
      name,
      email,
      password
    },
    true
  )
  users.push(newUser)
  await saveIdentity({ ...data, users })
  return newUser
}

export async function deleteUser(id: string): Promise<void> {
  const data = await getIdentity()
  const users = data.users.filter((user) => user.id !== id)
  const memberships = data.memberships.filter((membership) => membership.userId !== id)
  const superAdminIds = data.superAdminIds.filter((userId) => userId !== id)
  if (users.length === data.users.length) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  await saveIdentity({ ...data, users, memberships, superAdminIds })
}

export async function upsertTeam(
  payload: Omit<IdentityTeam, 'id'> & { id?: string }
): Promise<IdentityTeam> {
  const data = await getIdentity()
  const teams = data.teams || []
  const name = String(payload.name || '').trim()
  const description = payload.description ? String(payload.description).trim() : undefined

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid team payload' })
  }

  const conflictingTeam = teams.find(
    (team) => team.name.toLowerCase() === name.toLowerCase() && team.id !== payload.id
  )
  if (conflictingTeam) {
    throw createError({ statusCode: 409, statusMessage: 'Team name already in use' })
  }

  if (payload.id) {
    const idx = teams.findIndex((team) => team.id === payload.id)
    if (idx === -1) {
      throw createError({ statusCode: 404, statusMessage: 'Team not found' })
    }
    const updated = withTimestamps(
      { ...teams[idx], name, description, id: payload.id },
      !teams[idx].createdAt
    )
    teams[idx] = updated
    await saveIdentity({ ...data, teams })
    return updated
  }

  const id = nanoid(12)
  const newTeam = withTimestamps(
    {
      id,
      name,
      description
    },
    true
  )
  teams.push(newTeam)
  await saveIdentity({ ...data, teams })
  return newTeam
}

export async function deleteTeam(id: string): Promise<void> {
  const data = await getIdentity()
  const teams = data.teams.filter((team) => team.id !== id)
  if (teams.length === data.teams.length) {
    throw createError({ statusCode: 404, statusMessage: 'Team not found' })
  }
  const memberships = data.memberships.filter((membership) => membership.teamId !== id)
  await saveIdentity({ ...data, teams, memberships })
}

export async function upsertMembership(
  payload: Omit<IdentityMembership, 'id'> & { id?: string }
): Promise<IdentityMembership> {
  const data = await getIdentity()
  const memberships = data.memberships || []
  const userId = String(payload.userId || '').trim()
  const teamId = String(payload.teamId || '').trim()
  const role = payload.role === 'admin' || payload.role === 'user' ? payload.role : null

  if (!userId || !teamId || !role) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid membership payload' })
  }

  const userExists = data.users.some((user) => user.id === userId)
  const teamExists = data.teams.some((team) => team.id === teamId)
  if (!userExists || !teamExists) {
    throw createError({ statusCode: 400, statusMessage: 'User or team does not exist' })
  }

  const duplicate = memberships.find(
    (membership) =>
      membership.userId === userId && membership.teamId === teamId && membership.id !== payload.id
  )
  if (duplicate) {
    throw createError({ statusCode: 409, statusMessage: 'Membership already exists' })
  }

  if (payload.id) {
    const idx = memberships.findIndex((membership) => membership.id === payload.id)
    if (idx === -1) {
      throw createError({ statusCode: 404, statusMessage: 'Membership not found' })
    }
    const updated = withTimestamps(
      { ...memberships[idx], userId, teamId, role, id: payload.id },
      !memberships[idx].createdAt
    )
    memberships[idx] = updated
    await saveIdentity({ ...data, memberships })
    return updated
  }

  const id = nanoid(12)
  const newMembership = withTimestamps(
    {
      id,
      userId,
      teamId,
      role
    },
    true
  )
  memberships.push(newMembership)
  await saveIdentity({ ...data, memberships })
  return newMembership
}

export async function deleteMembership(id: string): Promise<void> {
  const data = await getIdentity()
  const memberships = data.memberships.filter((membership) => membership.id !== id)
  if (memberships.length === data.memberships.length) {
    throw createError({ statusCode: 404, statusMessage: 'Membership not found' })
  }
  await saveIdentity({ ...data, memberships })
}

export async function setSuperAdminIds(userIds: string[]): Promise<string[]> {
  const data = await getIdentity()
  const validIds = new Set(data.users.map((user) => user.id))
  const filtered = Array.from(new Set(userIds.filter((id) => validIds.has(id))))
  const next = { ...data, superAdminIds: filtered }
  await saveIdentity(next)
  return next.superAdminIds
}

export async function addSuperAdmin(id: string): Promise<string[]> {
  const data = await getIdentity()
  if (!data.users.some((user) => user.id === id)) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  const next = { ...data, superAdminIds: Array.from(new Set([...data.superAdminIds, id])) }
  await saveIdentity(next)
  return next.superAdminIds
}

export async function removeSuperAdmin(id: string): Promise<string[]> {
  const data = await getIdentity()
  if (!data.superAdminIds.includes(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Super admin not found' })
  }
  const next = { ...data, superAdminIds: data.superAdminIds.filter((current) => current !== id) }
  await saveIdentity(next)
  return next.superAdminIds
}
