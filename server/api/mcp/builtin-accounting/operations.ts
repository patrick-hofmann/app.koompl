import type { AccountingMcpContext } from './context'
import {
  createInvoice,
  updateInvoice,
  getInvoice,
  listInvoices,
  createExpense,
  updateExpense,
  listExpenses,
  getExpense,
  createBudget,
  updateBudget,
  listBudgets,
  getBudget,
  getFinancialReport
} from '../../../features/accounting'

export async function createAccountingInvoice(
  context: AccountingMcpContext,
  invoiceData: {
    invoiceNumber: string
    customerName: string
    customerEmail: string
    amount: number
    currency: string
    status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
    dueDate: string
    issueDate: string
    paidDate?: string
    description?: string
    items: Array<{
      description: string
      quantity: number
      unitPrice: number
      amount: number
    }>
    notes?: string
  }
) {
  return await createInvoice(context.teamId, {
    ...invoiceData,
    status: invoiceData.status || 'draft'
  })
}

export async function updateAccountingInvoice(
  context: AccountingMcpContext,
  invoiceId: string,
  updates: {
    invoiceNumber?: string
    customerName?: string
    customerEmail?: string
    amount?: number
    currency?: string
    status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
    dueDate?: string
    issueDate?: string
    paidDate?: string
    description?: string
    items?: Array<{
      description: string
      quantity: number
      unitPrice: number
      amount: number
    }>
    notes?: string
  }
) {
  return await updateInvoice(context.teamId, invoiceId, updates)
}

export async function getAccountingInvoice(context: AccountingMcpContext, invoiceId: string) {
  return await getInvoice(context.teamId, invoiceId)
}

export async function listAccountingInvoices(
  context: AccountingMcpContext,
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
) {
  return await listInvoices(context.teamId, status)
}

export async function createAccountingExpense(
  context: AccountingMcpContext,
  expenseData: {
    description: string
    amount: number
    currency: string
    category: string
    vendor?: string
    date: string
    status?: 'pending' | 'approved' | 'rejected' | 'paid'
    receiptUrl?: string
    notes?: string
    approvedBy?: string
    approvedAt?: string
  }
) {
  return await createExpense(context.teamId, {
    ...expenseData,
    status: expenseData.status || 'pending'
  })
}

export async function updateAccountingExpense(
  context: AccountingMcpContext,
  expenseId: string,
  updates: {
    description?: string
    amount?: number
    currency?: string
    category?: string
    vendor?: string
    date?: string
    status?: 'pending' | 'approved' | 'rejected' | 'paid'
    receiptUrl?: string
    notes?: string
    approvedBy?: string
    approvedAt?: string
  }
) {
  return await updateExpense(context.teamId, expenseId, updates)
}

export async function listAccountingExpenses(
  context: AccountingMcpContext,
  status?: 'pending' | 'approved' | 'rejected' | 'paid',
  category?: string
) {
  return await listExpenses(context.teamId, status, category)
}

export async function getAccountingExpense(context: AccountingMcpContext, expenseId: string) {
  return await getExpense(context.teamId, expenseId)
}

export async function createAccountingBudget(
  context: AccountingMcpContext,
  budgetData: {
    name: string
    category: string
    amount: number
    period: 'monthly' | 'quarterly' | 'yearly'
    startDate: string
    endDate: string
  }
) {
  return await createBudget(context.teamId, budgetData)
}

export async function updateAccountingBudget(
  context: AccountingMcpContext,
  budgetId: string,
  updates: {
    name?: string
    category?: string
    amount?: number
    period?: 'monthly' | 'quarterly' | 'yearly'
    startDate?: string
    endDate?: string
    spent?: number
  }
) {
  return await updateBudget(context.teamId, budgetId, updates)
}

export async function listAccountingBudgets(context: AccountingMcpContext) {
  return await listBudgets(context.teamId)
}

export async function getAccountingBudget(context: AccountingMcpContext, budgetId: string) {
  return await getBudget(context.teamId, budgetId)
}

export async function generateAccountingReport(
  context: AccountingMcpContext,
  startDate: string,
  endDate: string
) {
  return await getFinancialReport(context.teamId, startDate, endDate)
}
