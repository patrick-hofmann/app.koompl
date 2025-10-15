import type { BuiltinMcpDefinition } from '../../shared'
import type { HRMcpContext } from './context'
import {
  createCandidate,
  updateCandidate,
  listCandidates,
  createInterview,
  listInterviews,
  createEmployee,
  listEmployees
} from './operations'

export const hrDefinition: BuiltinMcpDefinition<HRMcpContext> = {
  id: 'builtin-hr',
  serverName: 'builtin-hr-server',
  logPrefix: '[BuiltinHRMCP]',
  context: {
    spec: {
      teamIdEnv: 'HR_TEAM_ID',
      userIdEnv: 'HR_USER_ID',
      agentIdEnv: 'HR_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.HR_TEAM_ID as string,
      userId: env.HR_USER_ID as string,
      agentId: env.HR_AGENT_ID || undefined
    })
  },
  tools: [
    {
      name: 'create_candidate',
      description: 'Create a new job candidate',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name of the candidate' },
          email: { type: 'string', description: 'Email address of the candidate' },
          position: { type: 'string', description: 'Position they are applying for' },
          status: {
            type: 'string',
            enum: ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'],
            default: 'applied'
          },
          resumeUrl: { type: 'string', description: 'Optional URL to resume' },
          notes: { type: 'string', description: 'Optional notes about the candidate' },
          appliedAt: { type: 'string', format: 'date-time', description: 'When they applied' }
        },
        required: ['name', 'email', 'position', 'appliedAt'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const candidate = await createCandidate(context, args as any)
        return { success: true, data: candidate, summary: `Created candidate: ${candidate.name}` }
      }
    },
    {
      name: 'update_candidate',
      description: 'Update candidate information',
      inputSchema: {
        type: 'object',
        properties: {
          candidateId: { type: 'string', description: 'ID of the candidate' },
          updates: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']
              },
              notes: { type: 'string' },
              resumeUrl: { type: 'string' }
            },
            additionalProperties: false
          }
        },
        required: ['candidateId', 'updates'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const { candidateId, updates } = args as { candidateId: string; updates: any }
        const candidate = await updateCandidate(context, { candidateId, updates })
        return {
          success: true,
          data: candidate,
          summary: candidate ? `Updated candidate ${candidate.name}` : 'Candidate not found'
        }
      }
    },
    {
      name: 'list_candidates',
      description: 'List job candidates, optionally filtered by status',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'],
            description: 'Optional status filter'
          }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const { status } = args as { status?: string }
        const candidates = await listCandidates(context, { status })
        return { success: true, data: candidates, summary: `Found ${candidates.length} candidates` }
      }
    },
    {
      name: 'create_interview',
      description: 'Schedule an interview for a candidate',
      inputSchema: {
        type: 'object',
        properties: {
          candidateId: { type: 'string', description: 'ID of the candidate' },
          interviewer: { type: 'string', description: 'Name of the interviewer' },
          date: { type: 'string', format: 'date', description: 'Interview date' },
          time: { type: 'string', description: 'Interview time' },
          type: {
            type: 'string',
            enum: ['phone', 'video', 'in-person'],
            description: 'Type of interview'
          },
          notes: { type: 'string', description: 'Optional interview notes' }
        },
        required: ['candidateId', 'interviewer', 'date', 'time', 'type'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const interview = await createInterview(context, args as any)
        return {
          success: true,
          data: interview,
          summary: `Scheduled interview for candidate ${interview.candidateId}`
        }
      }
    },
    {
      name: 'list_interviews',
      description: 'List all scheduled interviews',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async ({ context }) => {
        const interviews = await listInterviews(context)
        return { success: true, data: interviews, summary: `Found ${interviews.length} interviews` }
      }
    },
    {
      name: 'create_employee',
      description: 'Create a new employee record',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name of the employee' },
          email: { type: 'string', description: 'Email address' },
          position: { type: 'string', description: 'Job position/title' },
          department: { type: 'string', description: 'Department' },
          startDate: { type: 'string', format: 'date', description: 'Start date' },
          manager: { type: 'string', description: 'Optional manager name' },
          notes: { type: 'string', description: 'Optional notes' }
        },
        required: ['name', 'email', 'position', 'department', 'startDate'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const employee = await createEmployee(context, args as any)
        return { success: true, data: employee, summary: `Created employee: ${employee.name}` }
      }
    },
    {
      name: 'list_employees',
      description: 'List all current employees',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async ({ context }) => {
        const employees = await listEmployees(context)
        return { success: true, data: employees, summary: `Found ${employees.length} employees` }
      }
    }
  ]
}
