// Domain constants and formatters for finance features
// FEATURE: finance — shared across dashboard and finance pages

import { fmtCat } from './app.js'

// Unified enums — single source for both expenses and income
export const CATS = ['admin', 'annadana', 'bhoga', 'book_distribution', 'books', 'building_fund', 'deity', 'deity_worship', 'equipment', 'events', 'festival', 'flowers', 'general', 'insurance', 'kitchen', 'maintenance', 'renovation', 'rent', 'salary', 'sunday_feast', 'travel', 'utilities', 'vehicle', 'other']
export const METHODS = ['cash', 'cheque', 'e-transfer', 'card', 'credit-card', 'debit', 'interac', 'direct-deposit', 'bank-deposit', 'wire', 'in-kind', 'other']
export const INCOME_TYPES = ['donation', 'sale', 'grant', 'interest', 'refund', 'rebate', 'other']

// Legacy aliases — consumed by existing form partials, filter dropdowns
export const DON_CATS = CATS
export const EXP_CATS = CATS
export const DON_METHODS = METHODS
export const EXP_METHODS = METHODS

export const STATUS_LABELS = { submitted: 'Approval', approved: 'Approved', paid: 'Paid', closed: 'Closed', rejected: 'Rejected' }
export const STATUS_ORDER = { submitted: 0, approved: 1, paid: 2, closed: 3, rejected: 4 }
export const AMT_MAX = 100_000

export const EXP_STATUSES = { submitted: 'var(--c-accent)', approved: 'var(--c-ok)', paid: 'var(--c-accent)', closed: 'var(--c-ok)', rejected: 'var(--c-err)' }

export const CAT_CLR = { deity: 'purple', deity_worship: 'purple', flowers: 'purple', bhoga: 'amber', kitchen: 'amber', sunday_feast: 'amber', annadana: 'amber', events: 'teal', festival: 'teal', travel: 'teal', vehicle: 'teal', admin: 'blue', book_distribution: 'blue', books: 'blue', salary: 'green', rent: 'brown', building_fund: 'brown', maintenance: 'brown', renovation: 'brown', equipment: 'brown', insurance: 'indigo', utilities: 'indigo' }
export const catCls = c => 'cat-' + (CAT_CLR[c] || 'gray')
export const catHex = c => `var(--c-cat-${CAT_CLR[c] || 'gray'})`
export const catBgHex = c => `var(--c-cat-${CAT_CLR[c] || 'gray'}-bg)`

export const DON_FIELDS = { Type: { id: 'type', label: 'type' }, Amount: { id: 'amount', label: 'amount' }, Method: { id: 'method', label: 'method' }, Category: { id: 'cat', label: 'category' }, DateReceived: { id: 'date', label: 'date' }, Note: { id: 'note', label: 'note' } }
export const EXP_FIELDS = { Payee: { id: 'vendor', label: 'payee' }, Amount: { id: 'amount', label: 'amount' }, Method: { id: 'exp-method', label: 'method' }, Category: { id: 'cat', label: 'category' }, ExpenseDate: { id: 'date', label: 'date' }, Note: { id: 'desc', label: 'note' } }

export const fmtStatus = s => STATUS_LABELS[s] || fmtCat(s)
export const expenseTitle = x => x?.payee || '—'
export const expenseModalTitle = x => x?.expense_no ? `Edit Expense #${x.expense_no}` : 'Edit Expense'
export const incomeModalTitle = x => x?.id ? `Edit Income #${x.id}` : 'Edit Income'

export function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d), now = new Date(), ms = now - dt
  if (ms > 0 && ms < 3600000) return Math.floor(ms / 60000) + 'm ago'
  if (ms > 0 && ms < 86400000) return Math.floor(ms / 3600000) + 'h ago'
  const sameYear = dt.getFullYear() === now.getFullYear()
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) })
}


const ACTION_BADGES = { approve: 'approved', reject: 'rejected', paid: 'paid', closed: 'closed', submitted: 'submitted', edited: 'update', create: 'create' }
const ACTION_LABELS = { create: 'Created', approve: 'Approved', reject: 'Rejected', paid: 'Paid', closed: 'Closed', submitted: 'Submitted', edited: 'Updated' }

export function eventBadge(h) {
  return ACTION_BADGES[h.action] || h.action
}

export function eventLabel(h) {
  const base = ACTION_LABELS[h.action] || fmtCat(h.action)
  return h.count ? `${base} (${h.count})` : base
}

export function eventDetail(h) {
  const parts = []
  if (h.note) parts.push(h.note)
  if (h.ref) parts.push('Ref ' + h.ref)
  if (h.method) parts.push(fmtCat(h.method))
  return parts.join(' · ')
}

export function actorName(uid, names, myUid) {
  if (!uid) return ''
  if (uid === myUid) return 'you'
  return names[uid] || `User #${uid}`
}

export function changedAt(item) {
  return item?.updated_at || item?.created_at || ''
}

export function buildMetaHistory(item) {
  if (!item) return []
  const rows = []
  if (Array.isArray(item.history) && item.history.length) {
    for (const h of item.history) {
      rows.push({ action: h.action, user_id: h.by || null, created_at: h.at, note: h.note, method: h.method, ref: h.ref, count: h.count })
    }
  } else {
    // No history array — synthesize from timestamps
    if (item.created_at) rows.push({ action: 'create', user_id: item.created_by || null, created_at: item.created_at })
    if (item.updated_at && item.updated_at !== item.created_at) {
      rows.push({ action: 'update', user_id: item.updated_by || null, created_at: item.updated_at })
    }
  }
  return rows.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
}

export function parseMemberNames(items) {
  const names = {}, unames = {}
  for (const c of items) {
    const d = typeof c.data === 'string' ? JSON.parse(c.data) : c.data
    const nm = d.spiritual_name || d.name || d.email || 'Unknown'
    names[c.id] = nm
    if (c.user_id) unames[c.user_id] = nm
  }
  return { names, unames }
}

export function setErr(msg, prefix, fields) {
  document.querySelectorAll('.field-err').forEach(el => el.classList.remove('field-err'))
  const matches = [...msg.matchAll(/validation for '(\w+)'/g)]
  if (!matches.length) return msg
  const names = []
  for (const [, f] of matches) {
    const m = fields?.[f]
    names.push(m?.label || f.toLowerCase())
    if (m?.id) document.getElementById(`${prefix}-${m.id}`)?.classList.add('field-err')
  }
  return 'Required: ' + names.join(', ')
}
