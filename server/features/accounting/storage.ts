import { createStorage } from '../../utils/storage'

export interface Invoice {
  id: string
  invoiceNumber: string
  customerName: string
  customerEmail: string
  amount: number
  currency: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  dueDate: string
  issueDate: string
  paidDate?: string
  description?: string
  items: InvoiceItem[]
  notes?: string
  createdAt: string
  updatedAt: string
  teamId: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

export interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  category: string
  vendor?: string
  date: string
  status: 'pending' | 'approved' | 'rejected' | 'paid'
  receiptUrl?: string
  notes?: string
  approvedBy?: string
  approvedAt?: string
  createdAt: string
  updatedAt: string
  teamId: string
}

export interface Budget {
  id: string
  name: string
  category: string
  amount: number
  period: 'monthly' | 'quarterly' | 'yearly'
  startDate: string
  endDate: string
  spent: number
  createdAt: string
  updatedAt: string
  teamId: string
}

export interface AccountingData {
  invoices: Invoice[]
  expenses: Expense[]
  budgets: Budget[]
}

const defaultAccountingData: AccountingData = {
  invoices: [],
  expenses: [],
  budgets: []
}

export function createAccountingStorage(teamId: string) {
  return createStorage<AccountingData>('accounting', teamId, defaultAccountingData)
}

export async function createInvoice(
  teamId: string,
  invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<Invoice> {
  const storage = createAccountingStorage(teamId)
  const data = await storage.read()

  const invoice: Invoice = {
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...invoiceData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.invoices.push(invoice)
  await storage.write(data)

  return invoice
}

export async function updateInvoice(
  teamId: string,
  invoiceId: string,
  updates: Partial<Omit<Invoice, 'id' | 'createdAt' | 'teamId'>>
): Promise<Invoice | null> {
  const storage = createAccountingStorage(teamId)
  const data = await storage.read()

  const invoiceIndex = data.invoices.findIndex((i) => i.id === invoiceId)
  if (invoiceIndex === -1) return null

  data.invoices[invoiceIndex] = {
    ...data.invoices[invoiceIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  await storage.write(data)
  return data.invoices[invoiceIndex]
}

export async function getInvoice(teamId: string, invoiceId: string): Promise<Invoice | null> {
  const storage = createAccountingStorage(teamId)
  const data = await storage.read()
  return data.invoices.find((i) => i.id === invoiceId) || null
}

export async function listInvoices(teamId: string, status?: Invoice['status']): Promise<Invoice[]> {
  const storage = createAccountingStorage(teamId)
  const data = await storage.read()

  if (status) {
    return data.invoices.filter((i) => i.status === status)
  }

  return data.invoices
}

export async function createExpense(
  teamId: string,
  expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<Expense> {
  const storage = createAccountingStorage(teamId)
  const data = await storage.read()

  const expense: Expense = {
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...expenseData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.expenses.push(expense)
  await storage.write(data)

  return expense
}

export async function updateExpense(
  teamId: string,
  expenseId: string,
  updates: Partial<Omit<Expense, 'id' | 'createdAt' | 'teamId'>>
): Promise<Expense | null> {
  const storage = createAccountingStorage(teamId)
  const data = await storage.read()

  const expenseIndex = data.expenses.findIndex((e) => e.id === expenseId)
  if (expenseIndex === -1) return null

  data.expenses[expenseIndex] = {
    ...data.expenses[expenseIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  await storage.write(data)
  return data.expenses[expenseIndex]
}

export async function listExpenses(
  teamId: string,
  status?: Expense['status'],
  category?: string
): Promise<Expense[]> {
  const storage = createAccountingStorage(teamId)
  const data = await storage.read()

  let expenses = data.expenses

  if (status) {
    expenses = expenses.filter((e) => e.status === status)
  }

  if (category) {
    expenses = expenses.filter((e) => e.category === category)
  }

  return expenses
}

export async function getExpense(teamId: string, expenseId: string): Promise<Expense | null> {
  const storage = createAccountingStorage(teamId)
  const data = await storage.read()
  return data.expenses.find((e) => e.id === expenseId) || null
}

export async function createBudget(
  teamId: string,
  budgetData: Omit<Budget, 'id' | 'spent' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<Budget> {
  const storage = createAccountingStorage(teamId)
  const data = await storage.read()

  const budget: Budget = {
    id: `bud_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...budgetData,
    spent: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.budgets.push(budget)
  await storage.write(data)

  return budget
}

export async function updateBudget(
  teamId: string,
  budgetId: string,
  updates: Partial<Omit<Budget, 'id' | 'createdAt' | 'teamId'>>
): Promise<Budget | null> {
  const storage = createAccountingStorage(teamId)
  const data = await storage.read()

  const budgetIndex = data.budgets.findIndex((b) => b.id === budgetId)
  if (budgetIndex === -1) return null

  data.budgets[budgetIndex] = {
    ...data.budgets[budgetIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  await storage.write(data)
  return data.budgets[budgetIndex]
}

export async function listBudgets(teamId: string): Promise<Budget[]> {
  const storage = createAccountingStorage(teamId)
  const data = await storage.read()
  return data.budgets
}

export async function getBudget(teamId: string, budgetId: string): Promise<Budget | null> {
  const storage = createAccountingStorage(teamId)
  const data = await storage.read()
  return data.budgets.find((b) => b.id === budgetId) || null
}

export async function getFinancialReport(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<{
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  invoiceCount: number
  expenseCount: number
  topExpenseCategories: { category: string; amount: number }[]
  overdueInvoices: Invoice[]
}> {
  const storage = createAccountingStorage(teamId)
  const data = await storage.read()

  const start = new Date(startDate)
  const end = new Date(endDate)

  // Filter invoices by date range
  const invoicesInRange = data.invoices.filter((i) => {
    const issueDate = new Date(i.issueDate)
    return issueDate >= start && issueDate <= end
  })

  // Filter expenses by date range
  const expensesInRange = data.expenses.filter((e) => {
    const expenseDate = new Date(e.date)
    return expenseDate >= start && expenseDate <= end
  })

  // Calculate totals
  const totalRevenue = invoicesInRange
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + i.amount, 0)

  const totalExpenses = expensesInRange
    .filter((e) => e.status === 'paid')
    .reduce((sum, e) => sum + e.amount, 0)

  const netIncome = totalRevenue - totalExpenses

  // Top expense categories
  const categoryTotals = new Map<string, number>()
  expensesInRange.forEach((e) => {
    if (e.status === 'paid') {
      const current = categoryTotals.get(e.category) || 0
      categoryTotals.set(e.category, current + e.amount)
    }
  })

  const topExpenseCategories = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  // Overdue invoices
  const now = new Date()
  const overdueInvoices = data.invoices.filter((i) => {
    if (i.status === 'paid' || i.status === 'cancelled') return false
    const dueDate = new Date(i.dueDate)
    return dueDate < now
  })

  return {
    totalRevenue,
    totalExpenses,
    netIncome,
    invoiceCount: invoicesInRange.length,
    expenseCount: expensesInRange.length,
    topExpenseCategories,
    overdueInvoices
  }
}
