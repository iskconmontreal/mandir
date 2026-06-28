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
const _safeJSON = s => { try { return JSON.parse(s) } catch { return null } }

export function displayLabel(x) {
  const d = (typeof x?.details === 'string' ? _safeJSON(x.details) : x?.details) || {}
  if (d.source === 'boutique-counter')             return 'Shop Counter Sale'
  if (d.source === 'boutique-counter-donation')    return 'Counter Donation'
  if (d.source === 'boutique-counter-overpayment') return 'Counter Overpayment'
  return fmtCat(labelOf(x))
}

export function displayCls(x) {
  if (x?.type === 'sale' && x?.category === 'sankirtan') return catCls('sankirtan')
  return catCls((x?.type || 'donation') === 'donation' ? (x?.category || 'general') : (x?.type || 'other'))
}
