// Finance data classification utilities
// FEATURE: finance/classifiers

import { fmtCat } from './formatters.js'
import { catCls } from './colors.js'

export const bucketOf = x => {
  if (x.type === 'sale' && x.category === 'sankirtan') return 'sankirtan'
  return (x.type || 'donation') === 'donation' ? (x.category || 'general') : (x.type || 'other')
}
export const labelOf = x => {
  if (x.type === 'sale' && x.category === 'sankirtan') return 'sankirtan'
  return (x.type || 'donation') === 'donation' ? (x.category || 'general') : (x.type || 'other')
}
export const sourceOf = (x, names) => x.member_id ? (names[x.member_id] || x.source_name || '—') : (x.source_name || 'Anonymous')

// Display label that respects details.source for boutique-counter rows.
// Color (catCls) keeps reading the raw type/category — only the visible text changes here.
// Exception: a sankirtan book sold at the counter keeps its "Sankirtan" category label
// (its color is already saffron), so the badge text matches the color and reads the same
// as sankirtan-session rows.
const _safeJSON = s => { try { return JSON.parse(s) } catch { return null } }

export function displayLabel(x) {
  const d = (typeof x?.details === 'string' ? _safeJSON(x.details) : x?.details) || {}
  if (d.source === 'boutique-counter' && x.category !== 'sankirtan') return 'Shop Counter Sale'
  if (d.source === 'boutique-counter-donation')    return 'Counter Donation'
  if (d.source === 'boutique-counter-overpayment') return 'Counter Overpayment'
  return fmtCat(labelOf(x))
}

export function displayCls(x) {
  if (x?.type === 'sale' && x?.category === 'sankirtan') return catCls('sankirtan')
  return catCls((x?.type || 'donation') === 'donation' ? (x?.category || 'general') : (x?.type || 'other'))
}

// Title for an income row: member → source_name → the name stashed in details
// (distributor for sankirtan sessions, cashier for boutique rows) → 'Anonymous'.
export const displayName = (x, names = {}) => {
  if (x?.member_id && names[x.member_id]) return names[x.member_id]
  if (x?.source_name || x?.member_name) return x.source_name || x.member_name
  const d = (typeof x?.details === 'string' ? _safeJSON(x.details) : x?.details) || {}
  return d.distributor_name || d.cashier_name || 'Anonymous'
}

// '' | 'boutique' — subtitle note for rows that originated at the till.
export const displayNote = x => {
  const d = (typeof x?.details === 'string' ? _safeJSON(x.details) : x?.details) || {}
  return String(d.source || '').startsWith('boutique-counter') ? 'boutique' : ''
}
