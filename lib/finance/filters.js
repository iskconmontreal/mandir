// Finance filter predicates and utilities
// FEATURE: finance/filters

import { normIncomeMethod } from './normalizers.js'
import { bucketOf, sourceOf } from './classifiers.js'

export const incomeTypeMatch = (row, filter) => { const type = row?.type || 'donation'; return !filter || type === filter }
export const incomeMethodMatch = (row, filters) => !filters?.length || filters.includes(normIncomeMethod(row?.method || 'cash'))
export const donorRowMatch = (row, search = '') => {
  const q = String(search || '').trim().toLowerCase()
  return !q || String(row?.name || '').toLowerCase().includes(q)
}
export const filterDonorRows = (rows, search = '') => (rows || []).filter(row => donorRowMatch(row, search))
