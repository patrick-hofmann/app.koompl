// Public API for Accounting feature
export * from './storage'

export interface AccountingApi {
  // Invoice management
  createInvoice: typeof import('./storage').createInvoice
  updateInvoice: typeof import('./storage').updateInvoice
  getInvoice: typeof import('./storage').getInvoice
  listInvoices: typeof import('./storage').listInvoices

  // Expense management
  createExpense: typeof import('./storage').createExpense
  updateExpense: typeof import('./storage').updateExpense
  listExpenses: typeof import('./storage').listExpenses
  getExpense: typeof import('./storage').getExpense

  // Budget management
  createBudget: typeof import('./storage').createBudget
  updateBudget: typeof import('./storage').updateBudget
  listBudgets: typeof import('./storage').listBudgets
  getBudget: typeof import('./storage').getBudget

  // Reporting
  getFinancialReport: typeof import('./storage').getFinancialReport
}

// Re-export all storage functions for easy access
export {
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
} from './storage'
