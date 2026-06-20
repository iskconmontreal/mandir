// Finance module — re-exports all submodules for backward compatibility
// FEATURE: finance — shared across dashboard and finance pages
//
// This file now serves as a compatibility layer, re-exporting from the modularized finance/* directory.
// New code can import directly from submodules:
//   import { fmtCat } from 'lib/finance/formatters.js'
//   import { CATS } from 'lib/finance/constants.js'
//
// Legacy imports continue to work:
//   import { fmtCat, CATS } from 'lib/finance.js'

// Internal imports for functions defined in this file
import { normIncomeMethod, normIncomeType } from './finance/normalizers.js'
import { bucketOf, sourceOf } from './finance/classifiers.js'
import { incomeTypeMatch, incomeMethodMatch } from './finance/filters.js'
import { localMonthKey } from './finance/dates.js'
import { monthItemMap } from './finance/months.js'
import { sortNetTransactions } from './finance/sorting.js'

// Constants
export { CATS, METHODS, INCOME_TYPES, DON_CATS, EXP_CATS, DON_METHODS, EXP_METHODS, STATUS_LABELS, STATUS_ORDER, AMT_MAX, EXP_STATUSES, CAT_CLR, HIST_BINS } from './finance/constants.js'

// Formatters
export { fmtCat, fmtStatus, fmtMonthShort, fmtMonth, expenseTitle, expenseModalTitle, incomeModalTitle, fmtDate } from './finance/formatters.js'

// Colors
export { catCls, catHex, catBgHex } from './finance/colors.js'

// Normalizers
export { normTab, normIncomeType, normIncomeMethod, normIncomeMethods, normExpenseCats, normAmt } from './finance/normalizers.js'

// Classifiers
export { bucketOf, labelOf, sourceOf, displayLabel } from './finance/classifiers.js'

// Filters
export { incomeTypeMatch, incomeMethodMatch, donorRowMatch, filterDonorRows } from './finance/filters.js'

// History
export { eventBadge, eventLabel, eventDetail, actorName, changedAt, buildMetaHistory, parseMemberNames } from './finance/history.js'

// Dates
export { localMonthKey, dateOnly, expenseMonthKey, incomeMonthKey, monthRange, expenseTxDate, incomeTxDate, toNetTransactions } from './finance/dates.js'

// Months
export { monthOpenState, monthKeysWithData, monthItemMap, buildMonthGroups, groupMonthsByYear, buildNetMonthGroups } from './finance/months.js'

// Sorting
export { sortExpenses, sortIncome, sortNetTransactions } from './finance/sorting.js'

// Stats
export { amtHist, trend, trendDiff } from './finance/stats.js'

// UI
export { DON_FIELDS, EXP_FIELDS, setErr } from './finance/ui.js'

// Net transaction filtering
export function netTransactionMatch(tx, filters = {}, names = {}) {
  const q = String(filters.search || '').trim().toLowerCase()
  const filterType = filters.filterType || ''
  const isExpFilter = filterType === 'expense'
  const isIncFilter = filterType === 'income'
  const amount = tx?.amount || 0
  const date = (tx?._date || '').slice(0, 10)

  if (filters.amtMin && amount < filters.amtMin * 100) return false
  if (filters.amtMax && amount > filters.amtMax * 100) return false
  if (filters.dateFrom && date < filters.dateFrom) return false
  if (filters.dateTo && date > filters.dateTo) return false

  if (tx?._isExp) {
    if (isExpFilter && filters.expStatus && tx.status !== filters.expStatus) return false
    if (isExpFilter && filters.expCats?.length && !filters.expCats.includes(tx.category || 'other')) return false
    return !q || [tx.payee, tx.note, tx.category, tx.expense_no, tx.category].filter(Boolean).join(' ').toLowerCase().includes(q)
  }

  if (isIncFilter && filters.incType && !incomeTypeMatch(tx, filters.incType)) return false
  if (isIncFilter && filters.incMethods?.length && !incomeMethodMatch(tx, filters.incMethods)) return false
  return !q || [tx.note, tx.method, tx.type, bucketOf(tx), sourceOf(tx, names)].filter(Boolean).join(' ').toLowerCase().includes(q)
}

export const filterNetTransactions = (items, filters = {}, names = {}) =>
  (items || []).filter(tx => netTransactionMatch(tx, filters, names))

export const filterNetTransactionsByType = (items, type = '') => {
  if (!type) return items || []
  const isExp = type === 'expense'
  return (items || []).filter(tx => !!tx?._isExp === isExp)
}
