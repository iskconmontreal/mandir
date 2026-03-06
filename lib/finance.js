// Domain constants and formatters for finance features
// FEATURE: finance — shared across dashboard and finance pages

import { fmtCat, fmtAmt } from './app.js'

export const DON_CATS = ['general', 'sunday_feast', 'book_distribution', 'deity_worship', 'building_fund', 'annadana', 'festival', 'events', 'other']
export const EXP_CATS = ['admin', 'bhoga', 'books', 'deity', 'equipment', 'events', 'flowers', 'insurance', 'kitchen', 'maintenance', 'renovation', 'rent', 'salary', 'travel', 'utilities', 'vehicle', 'other']
export const DON_METHODS = ['cash', 'cheque', 'e-transfer', 'card', 'in-kind']

export const STATUS_LABELS = { submitted: 'Pending', approved: 'Approved', paid: 'Paid', rejected: 'Rejected' }
export const STATUS_ORDER = { submitted: 0, approved: 1, paid: 2, rejected: 3 }
export const AMT_MAX = 100_000

export const EXP_STATUSES = { submitted: 'var(--c-accent)', approved: 'var(--c-ok)', paid: 'var(--c-accent)', rejected: 'var(--c-err)' }

export const CAT_CLR = { deity: 'purple', deity_worship: 'purple', flowers: 'purple', bhoga: 'amber', kitchen: 'amber', sunday_feast: 'amber', annadana: 'amber', events: 'teal', festival: 'teal', travel: 'teal', vehicle: 'teal', admin: 'blue', book_distribution: 'blue', books: 'blue', salary: 'green', rent: 'brown', building_fund: 'brown', maintenance: 'brown', renovation: 'brown', equipment: 'brown', insurance: 'indigo', utilities: 'indigo' }
export const CAT_HEX = { purple: '#6b5ce7', amber: '#b8860b', teal: '#1a7a72', blue: '#3a6098', green: '#2d7a52', brown: '#7a5c30', indigo: '#504696', gray: '#aaa' }
export const catCls = c => 'cat-' + (CAT_CLR[c] || 'gray')
export const catHex = c => CAT_HEX[CAT_CLR[c]] || CAT_HEX.gray

export const DON_FIELDS = { Amount: { id: 'amount', label: 'amount' }, Method: { id: 'method', label: 'method' }, Category: { id: 'cat', label: 'category' }, DateReceived: { id: 'date', label: 'date' }, Note: { id: 'note', label: 'note' } }
export const EXP_FIELDS = { Payee: { id: 'vendor', label: 'payee' }, Amount: { id: 'amount', label: 'amount' }, Category: { id: 'cat', label: 'category' }, ExpenseDate: { id: 'date', label: 'date' }, Description: { id: 'desc', label: 'description' } }

export const fmtStatus = s => STATUS_LABELS[s] || fmtCat(s)

export function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d), now = new Date(), ms = now - dt
  if (ms < 3600000) return Math.floor(ms / 60000) + 'm ago'
  if (ms < 86400000) return Math.floor(ms / 3600000) + 'h ago'
  const sameYear = dt.getFullYear() === now.getFullYear()
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) })
}

const AMT_KEYS = new Set(['amount', 'tax_amount', 'eligible_amount'])
const META_KEYS = new Set(['id', 'created_at', 'updated_at', 'updated_by', 'attachments', 'submitter_name', 'due_date', 'currency', 'expense_no', 'member_id', 'paid_by', 'count', 'status', 'approval'])
const fmtFieldVal = (k, v) => v == null || v === '' ? '—' : AMT_KEYS.has(k) ? '$' + fmtAmt(v) : fmtCat(String(v))

export function parseDiff(d) {
  if (!d) return null
  if (typeof d === 'string') { try { return JSON.parse(d) } catch { return null } }
  return d
}

export function eventBadge(h) {
  if (h.action !== 'update') return h.action
  const d = parseDiff(h.diff)
  if (!d) return 'update'
  if (d.status) return d.status
  if (d.approval) return d.approval === 'approve' ? 'approved' : d.approval
  return 'update'
}

export function eventLabel(h) {
  if (h.action === 'create') return 'Created'
  if (h.action === 'archive' || h.action === 'delete') return 'Deleted'
  if (h.action !== 'update') return fmtCat(h.action)
  const d = parseDiff(h.diff)
  if (!d) return 'Updated'
  if (d.approval) return 'Approved' + (d.count ? ` (${d.count})` : '')
  if (d.status) return fmtStatus(d.status)
  return 'Updated'
}

export function eventDetail(h) {
  if (!h.diff || h.action === 'create' || h.action === 'archive' || h.action === 'delete') return ''
  const d = parseDiff(h.diff)
  if (!d) return ''
  const parts = []
  for (const [k, v] of Object.entries(d)) {
    if (META_KEYS.has(k)) continue
    if (v && typeof v === 'object' && 'old' in v && 'new' in v) parts.push(fmtCat(k) + ' ' + fmtFieldVal(k, v.old) + ' → ' + fmtFieldVal(k, v.new))
    else if (k === 'note' && v) parts.push(v)
    else if (AMT_KEYS.has(k)) parts.push(fmtCat(k) + ' $' + fmtAmt(v))
    else if (k === 'bank_ref' && v) parts.push('Ref ' + v)
  }
  return parts.join(' · ')
}

export function actorName(uid, names, myUid) {
  if (!uid || !names[uid]) return ''
  return uid === myUid ? 'you' : names[uid]
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
