// Finance sorting utilities
// FEATURE: finance/sorting

import { STATUS_ORDER } from './constants.js'
import { changedAt } from './history.js'

const expenseSortDate = x => changedAt(x) || x?.expense_date || ''
export const sortExpenses = list => [...list].sort((a, b) => {
  const st = (STATUS_ORDER[a?.status || 'submitted'] ?? 9) - (STATUS_ORDER[b?.status || 'submitted'] ?? 9)
  if (st) return st
  const ad = expenseSortDate(a), bd = expenseSortDate(b)
  if (ad !== bd) return bd > ad ? 1 : -1
  const ae = a?.expense_date || '', be = b?.expense_date || ''
  if (ae !== be) return be > ae ? 1 : -1
  return (b?.id || 0) - (a?.id || 0)
})

const incomeSortDate = x => x?.date_received || x?.created_at || changedAt(x) || ''
const incomeChangedDate = x => changedAt(x) || x?.created_at || ''
export const sortIncome = list => [...list].sort((a, b) => {
  const ad = incomeSortDate(a), bd = incomeSortDate(b)
  if (ad !== bd) return bd > ad ? 1 : -1
  const au = incomeChangedDate(a), bu = incomeChangedDate(b)
  if (au !== bu) return bu > au ? 1 : -1
  const ae = a?.date_received || '', be = b?.date_received || ''
  if (ae !== be) return be > ae ? 1 : -1
  return (b?.id || 0) - (a?.id || 0)
})

export const sortNetTransactions = items => [...(items || [])].sort((a, b) =>
  (b._date || '').localeCompare(a._date || '')
  || (b._changedAt || '').localeCompare(a._changedAt || '')
  || (b.id || 0) - (a.id || 0)
)
