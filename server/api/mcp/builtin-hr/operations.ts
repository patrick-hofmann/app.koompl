import * as hr from '../../../features/hr'
import type { HRMcpContext } from './context'

export async function createCandidate(
  context: HRMcpContext,
  args: Parameters<typeof hr.createCandidate>[1]
) {
  return hr.createCandidate(context.teamId, args)
}

export async function updateCandidate(
  context: HRMcpContext,
  args: Parameters<typeof hr.updateCandidate>[1]
) {
  return hr.updateCandidate(context.teamId, args.candidateId, args.updates)
}

export async function listCandidates(
  context: HRMcpContext,
  args: Parameters<typeof hr.listCandidates>[1]
) {
  return hr.listCandidates(context.teamId, args.status)
}

export async function createInterview(
  context: HRMcpContext,
  args: Parameters<typeof hr.createInterview>[1]
) {
  return hr.createInterview(context.teamId, args)
}

export async function listInterviews(context: HRMcpContext) {
  return hr.listInterviews(context.teamId)
}

export async function createEmployee(
  context: HRMcpContext,
  args: Parameters<typeof hr.createEmployee>[1]
) {
  return hr.createEmployee(context.teamId, args)
}

export async function listEmployees(context: HRMcpContext) {
  return hr.listEmployees(context.teamId)
}
