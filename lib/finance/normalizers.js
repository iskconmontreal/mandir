// Finance data normalization utilities
// FEATURE: finance/normalizers

import { CATS, INCOME_TYPES, METHODS } from './constants.js'

export const normTab = tab =>
  tab === 'donations' || tab === 'income' || tab === 'expenses' || tab === 'net' ? 'transactions' :
  (['transactions', 'donors', 'reports', 'shop-sales'].includes(tab) ? tab : 'transactions')

export const normIncomeType = value => INCOME_TYPES.includes(String(value || '').toLowerCase()) ? String(value || '').toLowerCase() : ''
export const normIncomeMethod = value => { const m = String(value || '').toLowerCase(); return METHODS.includes(m) ? m : '' }
export const normIncomeMethods = value => { const list = Array.isArray(value) ? value : String(value || '').split(','); return [...new Set(list.map(normIncomeMethod).filter(Boolean))] }
export const normExpenseCats = value => { const list = Array.isArray(value) ? value : String(value || '').split(','); return [...new Set(list.map(item => String(item || '').toLowerCase()).filter(cat => CATS.includes(cat)))] }
export const normAmt = v => { const n = parseInt(v, 10); return n > 0 ? n : '' }
