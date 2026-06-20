// Finance date manipulation utilities
// FEATURE: finance/dates

import { changedAt } from './history.js'

// Parse date string respecting local timezone.
// Date-only "2026-04-01" → local midnight (not UTC which shifts the day back in western TZs).
const parseLocal = d => !d ? null : new Date(typeof d === 'string' && !d.includes('T') ? d + 'T00:00:00' : d)

// Local-timezone month key: "2026-04-01T02:00Z" → local month, not raw-string month.
export const localMonthKey = d => { const dt = parseLocal(d); return dt && !isNaN(dt) ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` : 'unknown' }

// Strip time from business dates — Go serializes time.Time as RFC3339
// even for date-only fields, causing UTC midnight → wrong local day at month boundaries.
export const dateOnly = d => typeof d === 'string' && d.length > 10 ? d.slice(0, 10) : d

export const expenseMonthKey = x => localMonthKey(dateOnly(x?.expense_date))
export const incomeMonthKey = x => localMonthKey(dateOnly(x?.date_received) || x?.created_at || x?.updated_at)

export const monthRange = key => { const [year, month] = key.split('-').map(Number); const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); return { dateFrom: `${key}-01`, dateTo: `${key}-${String(lastDay).padStart(2, '0')}` } }

export const expenseTxDate = x => dateOnly(x?.expense_date) || x?.created_at || ''
export const incomeTxDate = x => dateOnly(x?.date_received) || x?.created_at || ''

export const toNetTransactions = ({ expenses = [], income = [] } = {}) => [
  ...expenses.map(x => ({ ...x, _isExp: true, _date: expenseTxDate(x), _changedAt: changedAt(x) || x?.expense_date || '' })),
  ...income.map(d => ({ ...d, _isExp: false, _date: incomeTxDate(d), _changedAt: changedAt(d) || d?.date_received || '' })),
]

