// app.js — shared app shell init (DRY: every page needs this)

import sprae from './sprae.js'
import { auth } from './auth.js'

auth.capture()
if (!auth.guard()) throw new Error('redirecting')

const page = location.pathname.split('/').pop() || 'index.html'
const dir = location.pathname.split('/').at(-2) || ''
const section = page === 'index.html' || page === '' ? (dir !== 'app' ? dir : 'index') : page.replace('.html', '')

export const DON_CATS = ['general', 'sunday_feast', 'book_distribution', 'deity_worship', 'building_fund', 'annadana', 'festival', 'other']
export const EXP_CATS = ['utilities', 'kitchen', 'deity', 'maintenance', 'office', 'rent', 'insurance', 'travel', 'other']
export const DON_METHODS = ['cash', 'cheque', 'e-transfer', 'card', 'in-kind']
export const fmtCat = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—'
export const fmtAmt = c => ((c || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })
export const rawAmt = c => ((c || 0) / 100).toFixed(2)
export const toCents = v => Math.round(parseFloat(v) * 100)

export const ROLES = ['Devotee', 'Volunteer', 'Board Member', 'Treasurer', 'President', 'Other']

let toastContainer
export function toast(msg, type = 'error') {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.className = 'toast-stack'
    document.body.appendChild(toastContainer)
  }
  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  el.textContent = msg
  toastContainer.appendChild(el)
  requestAnimationFrame(() => el.classList.add('toast-in'))
  const dismiss = () => {
    el.classList.remove('toast-in')
    el.addEventListener('transitionend', () => el.remove())
  }
  el.onclick = dismiss
  setTimeout(dismiss, 5000)
}

export function dlCSV(rows, name) {
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
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

export function init(state = {}) {
  state.user = auth.user
  state.section = section
  state.active = (s) => s === section
  state.tab = (p) => p === page
  state.logout = () => auth.logout()
  state.can = (p) => auth.can(p)
  state.userMenu ??= false
  return sprae(document, state)
}

export { auth }
