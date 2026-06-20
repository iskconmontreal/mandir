// Finance formatting utilities
// FEATURE: finance/formatters

import { STATUS_LABELS } from './constants.js'

export const fmtCat = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—'
export const fmtStatus = s => STATUS_LABELS[s] || fmtCat(s)

export const fmtMonthShort = k => { if (!k?.includes('-')) return 'Undated'; const [y, m] = k.split('-'); return new Date(+y, +m - 1).toLocaleString('default', { month: 'long' }) }
export const fmtMonth = k => { if (!k?.includes('-')) return 'Undated'; const [y, m] = k.split('-'); return new Date(+y, +m - 1).toLocaleString('default', { month: 'long', year: 'numeric' }) }

export const expenseTitle = x => x?.payee || '—'
export const expenseModalTitle = x => x?.expense_no ? `Edit Expense #${x.expense_no}` : 'Edit Expense'
export const incomeModalTitle = x => x?.id ? `Edit Income #${x.id}` : 'Edit Income'

// Parse date string respecting local timezone.
// Date-only "2026-04-01" → local midnight (not UTC which shifts the day back in western TZs).
const parseLocal = d => !d ? null : new Date(typeof d === 'string' && !d.includes('T') ? d + 'T00:00:00' : d)

export function fmtDate(d) {
  if (!d) return '—'
  const dt = parseLocal(d), now = new Date(), ms = now - dt
  if (ms > 0 && ms < 3600000) return Math.floor(ms / 60000) + 'm ago'
  if (ms > 0 && ms < 86400000) return Math.floor(ms / 3600000) + 'h ago'
  const sameYear = dt.getFullYear() === now.getFullYear()
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) })
}
