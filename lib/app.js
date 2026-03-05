// Shared app shell: auth guard, sprae init, formatting utilities
// FEATURE: shell — every page imports this

import sprae from './sprae.js'
import { auth } from './auth.js'
import { keepAlive } from './api.js'

auth.capture()
if (!auth.guard()) throw new Error('redirecting')

keepAlive()

const page = location.pathname.split('/').pop() || 'index.html'
const dir = location.pathname.split('/').at(-2) || ''
const section = page === 'index.html' || page === '' ? (dir !== 'app' ? dir : 'index') : page.replace('.html', '')

export const fmtCat = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—'
export const fmtAmt = c => ((c || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })
export const rawAmt = c => ((c || 0) / 100).toFixed(2)
export const toCents = v => Math.round(parseFloat(v) * 100)

export const hl = (str, q) => {
  str = String(str ?? '')
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  if (!q) return esc(str)
  const safe = esc(str), re = new RegExp('(' + esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')
  return safe.replace(re, '<mark>$1</mark>')
}

export const ROLES = ['Devotee', 'Volunteer', 'Board Member', 'Treasurer', 'President', 'Other']

export const SERVICES = ['pujari', 'cook', 'treasurer', 'board member', 'president', 'volunteer', 'temple commander', 'ashram leader']

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
