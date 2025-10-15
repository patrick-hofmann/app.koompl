import { createStorage } from '../../utils/storage'

export interface Candidate {
  id: string
  name: string
  email: string
  position: string
  status: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
  resumeUrl?: string
  notes?: string
  appliedAt: string
  createdAt: string
  updatedAt: string
  teamId: string
}

export interface Interview {
  id: string
  candidateId: string
  interviewer: string
  date: string
  time: string
  type: 'phone' | 'video' | 'in-person'
  notes?: string
  status: 'scheduled' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
  teamId: string
}

export interface Employee {
  id: string
  name: string
  email: string
  position: string
  department: string
  startDate: string
  status: 'active' | 'inactive' | 'terminated'
  manager?: string
  notes?: string
  createdAt: string
  updatedAt: string
  teamId: string
}

export interface HRData {
  candidates: Candidate[]
  interviews: Interview[]
  employees: Employee[]
}

const defaultHRData: HRData = {
  candidates: [],
  interviews: [],
  employees: []
}

export function createHRStorage(teamId: string) {
  return createStorage<HRData>('hr', teamId, defaultHRData)
}

export async function createCandidate(
  teamId: string,
  candidateData: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<Candidate> {
  const storage = createHRStorage(teamId)
  const data = await storage.read()

  const candidate: Candidate = {
    id: `candidate_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...candidateData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.candidates.push(candidate)
  await storage.write(data)

  return candidate
}

export async function updateCandidate(
  teamId: string,
  candidateId: string,
  updates: Partial<Omit<Candidate, 'id' | 'createdAt' | 'teamId'>>
): Promise<Candidate | null> {
  const storage = createHRStorage(teamId)
  const data = await storage.read()

  const candidateIndex = data.candidates.findIndex((c) => c.id === candidateId)
  if (candidateIndex === -1) return null

  data.candidates[candidateIndex] = {
    ...data.candidates[candidateIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  await storage.write(data)
  return data.candidates[candidateIndex]
}

export async function listCandidates(
  teamId: string,
  status?: Candidate['status']
): Promise<Candidate[]> {
  const storage = createHRStorage(teamId)
  const data = await storage.read()

  if (status) {
    return data.candidates.filter((c) => c.status === status)
  }

  return data.candidates
}

export async function createInterview(
  teamId: string,
  interviewData: Omit<Interview, 'id' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<Interview> {
  const storage = createHRStorage(teamId)
  const data = await storage.read()

  const interview: Interview = {
    id: `interview_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...interviewData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.interviews.push(interview)
  await storage.write(data)

  return interview
}

export async function listInterviews(teamId: string): Promise<Interview[]> {
  const storage = createHRStorage(teamId)
  const data = await storage.read()
  return data.interviews
}

export async function createEmployee(
  teamId: string,
  employeeData: Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<Employee> {
  const storage = createHRStorage(teamId)
  const data = await storage.read()

  const employee: Employee = {
    id: `employee_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...employeeData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.employees.push(employee)
  await storage.write(data)

  return employee
}

export async function listEmployees(teamId: string): Promise<Employee[]> {
  const storage = createHRStorage(teamId)
  const data = await storage.read()
  return data.employees
}
