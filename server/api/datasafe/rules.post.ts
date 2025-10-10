import { nanoid } from 'nanoid'
import { updateRules } from '../../features/datasafe'
import type { DatasafeRule, DatasafeRuleCondition } from '../../types/datasafe'

function nowIso(): string {
  return new Date().toISOString()
}

function sanitizeRule(rule: Partial<DatasafeRule>): DatasafeRule | null {
  const conditions = Array.isArray(rule.conditions)
    ? (rule.conditions.filter(Boolean) as DatasafeRuleCondition[])
    : []
  if (!rule.targetFolder || !conditions.length) {
    return null
  }
  return {
    id: rule.id || `rule-${nanoid(8)}`,
    name: rule.name || 'Untitled rule',
    description: rule.description,
    targetFolder: rule.targetFolder,
    conditions,
    autoCreateFolder: rule.autoCreateFolder ?? true,
    tags: rule.tags,
    createdAt: rule.createdAt || nowIso(),
    updatedAt: nowIso()
  }
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const teamId = session.team?.id

  if (!teamId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No team selected'
    })
  }

  const body = await readBody<{ rules?: Partial<DatasafeRule>[] }>(event)
  const rawRules = Array.isArray(body?.rules) ? body.rules : []
  const sanitized = rawRules
    .map((rule) => sanitizeRule(rule))
    .filter((rule): rule is DatasafeRule => !!rule)

  const context = { teamId, userId: session.user?.id }
  const rules = await updateRules(context, sanitized)

  return {
    ok: true,
    rules
  }
})
