import type { BuiltinMcpDefinition } from '../shared'
import type { AccountingMcpContext } from './context'
import {
  createAccountingInvoice,
  listAccountingInvoices,
  createAccountingExpense,
  listAccountingExpenses,
  createAccountingBudget,
  updateAccountingBudget,
  generateAccountingReport
} from './operations'

export const accountingDefinition: BuiltinMcpDefinition<AccountingMcpContext> = {
  id: 'builtin-accounting',
  serverName: 'builtin-accounting-server',
  logPrefix: '[BuiltinAccountingMCP]',
  context: {
    spec: {
      teamIdEnv: 'ACCOUNTING_TEAM_ID',
      userIdEnv: 'ACCOUNTING_USER_ID',
      agentIdEnv: 'ACCOUNTING_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.ACCOUNTING_TEAM_ID as string,
      userId: env.ACCOUNTING_USER_ID as string,
      agentId: env.ACCOUNTING_AGENT_ID || undefined
    })
  },
  tools: [
    {
      name: 'create_invoice',
      description: 'Create a new invoice',
      inputSchema: {
        type: 'object',
        properties: {
          invoiceNumber: {
            type: 'string',
            description: 'Unique invoice number'
          },
          customerName: {
            type: 'string',
            description: 'Name of the customer'
          },
          customerEmail: {
            type: 'string',
            description: 'Email address of the customer'
          },
          amount: {
            type: 'number',
            description: 'Total invoice amount'
          },
          currency: {
            type: 'string',
            description: 'Currency code (e.g., USD, EUR)'
          },
          status: {
            type: 'string',
            enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
            description: 'Invoice status'
          },
          dueDate: {
            type: 'string',
            description: 'Due date (ISO format)'
          },
          issueDate: {
            type: 'string',
            description: 'Issue date (ISO format)'
          },
          paidDate: {
            type: 'string',
            description: 'Paid date (ISO format, optional)'
          },
          description: {
            type: 'string',
            description: 'Invoice description'
          },
          items: {
            type: 'array',
            description: 'Invoice line items',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                quantity: { type: 'number' },
                unitPrice: { type: 'number' },
                amount: { type: 'number' }
              },
              required: ['description', 'quantity', 'unitPrice', 'amount']
            }
          },
          notes: {
            type: 'string',
            description: 'Additional notes'
          }
        },
        required: [
          'invoiceNumber',
          'customerName',
          'customerEmail',
          'amount',
          'currency',
          'dueDate',
          'issueDate',
          'items'
        ],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinAccountingMCP] Tool called: create_invoice', { args })

        try {
          const invoice = await createAccountingInvoice(context, args as any)
          console.log('[BuiltinAccountingMCP] Tool result: create_invoice', {
            invoiceId: invoice.id
          })

          return {
            success: true,
            data: invoice,
            summary: `Created invoice ${invoice.invoiceNumber} for ${invoice.customerName}`
          }
        } catch (error) {
          console.error('[BuiltinAccountingMCP] Error creating invoice:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'track_expense',
      description: 'Create a new expense record',
      inputSchema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Expense description'
          },
          amount: {
            type: 'number',
            description: 'Expense amount'
          },
          currency: {
            type: 'string',
            description: 'Currency code (e.g., USD, EUR)'
          },
          category: {
            type: 'string',
            description: 'Expense category (e.g., Travel, Office Supplies, Marketing)'
          },
          vendor: {
            type: 'string',
            description: 'Vendor name (optional)'
          },
          date: {
            type: 'string',
            description: 'Expense date (ISO format)'
          },
          status: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected', 'paid'],
            description: 'Expense status'
          },
          receiptUrl: {
            type: 'string',
            description: 'URL to receipt (optional)'
          },
          notes: {
            type: 'string',
            description: 'Additional notes'
          }
        },
        required: ['description', 'amount', 'currency', 'category', 'date'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinAccountingMCP] Tool called: track_expense', { args })

        try {
          const expense = await createAccountingExpense(context, args as any)
          console.log('[BuiltinAccountingMCP] Tool result: track_expense', {
            expenseId: expense.id
          })

          return {
            success: true,
            data: expense,
            summary: `Tracked expense: ${expense.description} for ${expense.amount} ${expense.currency}`
          }
        } catch (error) {
          console.error('[BuiltinAccountingMCP] Error tracking expense:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'list_invoices',
      description: 'List all invoices, optionally filtered by status',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
            description: 'Filter invoices by status (optional)'
          }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinAccountingMCP] Tool called: list_invoices', { args })

        try {
          const { status } = args as { status?: string }
          const invoices = await listAccountingInvoices(context, status as any)

          console.log('[BuiltinAccountingMCP] Tool result: list_invoices', {
            count: invoices.length
          })

          return {
            success: true,
            data: invoices,
            summary: `Found ${invoices.length} invoices${status ? ` with status "${status}"` : ''}`
          }
        } catch (error) {
          console.error('[BuiltinAccountingMCP] Error listing invoices:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'generate_report',
      description: 'Generate a financial report for a date range',
      inputSchema: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'Start date for the report (ISO format)'
          },
          endDate: {
            type: 'string',
            description: 'End date for the report (ISO format)'
          }
        },
        required: ['startDate', 'endDate'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinAccountingMCP] Tool called: generate_report', { args })

        try {
          const { startDate, endDate } = args as { startDate: string; endDate: string }
          const report = await generateAccountingReport(context, startDate, endDate)

          console.log('[BuiltinAccountingMCP] Tool result: generate_report', {
            revenue: report.totalRevenue,
            expenses: report.totalExpenses,
            netIncome: report.netIncome
          })

          return {
            success: true,
            data: report,
            summary: `Generated financial report: Revenue: ${report.totalRevenue}, Expenses: ${report.totalExpenses}, Net Income: ${report.netIncome}`
          }
        } catch (error) {
          console.error('[BuiltinAccountingMCP] Error generating report:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'manage_budget',
      description: 'Create or update a budget',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'update'],
            description: 'Action to perform'
          },
          budgetId: {
            type: 'string',
            description: 'Budget ID (required for update)'
          },
          name: {
            type: 'string',
            description: 'Budget name'
          },
          category: {
            type: 'string',
            description: 'Budget category'
          },
          amount: {
            type: 'number',
            description: 'Budget amount'
          },
          period: {
            type: 'string',
            enum: ['monthly', 'quarterly', 'yearly'],
            description: 'Budget period'
          },
          startDate: {
            type: 'string',
            description: 'Budget start date (ISO format)'
          },
          endDate: {
            type: 'string',
            description: 'Budget end date (ISO format)'
          }
        },
        required: ['action'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinAccountingMCP] Tool called: manage_budget', { args })

        try {
          const { action, budgetId, ...budgetData } = args as any

          if (action === 'create') {
            const budget = await createAccountingBudget(context, budgetData)
            console.log('[BuiltinAccountingMCP] Tool result: manage_budget (create)', {
              budgetId: budget.id
            })

            return {
              success: true,
              data: budget,
              summary: `Created budget "${budget.name}" with amount ${budget.amount}`
            }
          } else if (action === 'update') {
            if (!budgetId) {
              return {
                success: false,
                error: 'budgetId is required for update action'
              }
            }

            const budget = await updateAccountingBudget(context, budgetId, budgetData)
            if (!budget) {
              return {
                success: false,
                error: `Budget with ID ${budgetId} not found`
              }
            }

            console.log('[BuiltinAccountingMCP] Tool result: manage_budget (update)', { budgetId })

            return {
              success: true,
              data: budget,
              summary: `Updated budget "${budget.name}"`
            }
          } else {
            return {
              success: false,
              error: 'Invalid action. Must be "create" or "update"'
            }
          }
        } catch (error) {
          console.error('[BuiltinAccountingMCP] Error managing budget:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    },
    {
      name: 'list_expenses',
      description: 'List all expenses, optionally filtered by status or category',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected', 'paid'],
            description: 'Filter expenses by status (optional)'
          },
          category: {
            type: 'string',
            description: 'Filter expenses by category (optional)'
          }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        console.log('[BuiltinAccountingMCP] Tool called: list_expenses', { args })

        try {
          const { status, category } = args as { status?: string; category?: string }
          const expenses = await listAccountingExpenses(context, status as any, category)

          console.log('[BuiltinAccountingMCP] Tool result: list_expenses', {
            count: expenses.length
          })

          return {
            success: true,
            data: expenses,
            summary: `Found ${expenses.length} expenses${status ? ` with status "${status}"` : ''}${category ? ` in category "${category}"` : ''}`
          }
        } catch (error) {
          console.error('[BuiltinAccountingMCP] Error listing expenses:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
    }
  ]
}
