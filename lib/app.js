// Shared app shell: auth guard, sprae init, formatting utilities
// FEATURE: shell — every page imports this

import { start } from './sprae.js'
import { auth } from './auth.js'
import { keepAlive, api } from './api.js'
import { fmtCat } from './finance.js'
import { actionIcon, activityIcon, icon, methodIcon, statusIcon, trendIcon } from './icons.js'

auth.capture()
if (!auth.guard()) throw new Error('redirecting')

keepAlive()

const page = location.pathname.split('/').pop() || 'index.html'
const dir = location.pathname.split('/').at(-2) || ''
const grandparent = location.pathname.split('/').at(-3) || ''
const section = page === 'index.html' || page === ''
  ? (dir !== 'app' ? dir : 'index')
  : grandparent === 'admin' ? 'admin'
  : page.replace('.html', '')

export { fmtCat }
export const fmtAmt = c => ((c || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })
export const rawAmt = c => ((c || 0) / 100).toFixed(2)
export const toCents = v => Math.round(parseFloat(v) * 100)

export const hl = (str, q) => {
  str = String(str ?? '')
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  if (!q) return esc(str)
  const safe = esc(str), re = new RegExp('(' + esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')
  return safe.replace(re, '<mark class="hl-hit">$1</mark>')
}

export function uniq(list) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    const value = String(item || '').trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function parseRoleNames(value) {
  if (!value) return []
  if (Array.isArray(value)) return uniq(value.flatMap(parseRoleNames))
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return []
    if ((raw.startsWith('{') || raw.startsWith('[')) && raw.length > 1) {
      try { return parseRoleNames(JSON.parse(raw)) } catch {}
    }
    if (raw.includes(',')) return uniq(raw.split(',').flatMap(parseRoleNames))
    return [raw]
  }
  if (typeof value !== 'object') return []
  return uniq([
    ...parseRoleNames(value.name),
    ...parseRoleNames(value.role),
    ...parseRoleNames(value.roles),
    ...parseRoleNames(value.role_name),
    ...parseRoleNames(value.meta?.roles),
    ...parseRoleNames(value.meta?.role),
    ...parseRoleNames(value.user?.roles),
    ...parseRoleNames(value.user?.role),
    ...parseRoleNames(value.data?.roles),
    ...parseRoleNames(value.data?.role),
  ])
}

export function userRoleNames(user = auth.user) {
  return uniq([
    ...parseRoleNames(user?.roles),
    ...parseRoleNames(user?.role),
    ...parseRoleNames(user?.meta?.roles),
    ...parseRoleNames(user?.meta?.role),
    ...parseRoleNames(user?.user?.roles),
    ...parseRoleNames(user?.user?.role),
    ...parseRoleNames(user?.data?.roles),
    ...parseRoleNames(user?.data?.role),
  ])
}

export function hasUserRole(user = auth.user, role = '') {
  const want = String(role || '').trim().toLowerCase()
  return !!want && userRoleNames(user).some(name => name.toLowerCase() === want)
}

export function canEditOrgSettings(user = auth.user) {
  return auth.can('settings:manage')
    || auth.can('roles:update')
    || hasUserRole(user, 'administrator')
    || hasUserRole(user, 'admin')
    || hasUserRole(user, 'president')
}

let _rolesCache = null
let _rolesReq = null

export async function loadSystemRoles(force = false) {
  if (!force && _rolesCache) return _rolesCache
  if (!force && _rolesReq) return _rolesReq

  _rolesReq = api.getRoles().then(res => {
    _rolesCache = (res.roles || []).filter(r => r?.name)
    return _rolesCache
  }).finally(() => { _rolesReq = null })

  return _rolesReq
}

export async function loadRoleNames(force = false) {
  const roles = await loadSystemRoles(force)
  return roles.map(r => r.name)
}

export const SERVICES = ['pujari', 'cook', 'treasurer', 'signee', 'board member', 'president', 'volunteer', 'temple commander', 'ashram leader']

let toastContainer
export function toast(msg, type = 'error') {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.className = 'toast-stack'
    document.body.appendChild(toastContainer)
  }
  const el = document.createElement('div')
  el.className = `toast toast-${type}`

  const text = document.createElement('span')
  text.className = 'toast-msg'
  text.textContent = msg
  el.appendChild(text)

  const close = document.createElement('button')
  close.className = 'toast-close'
  close.type = 'button'
  close.setAttribute('aria-label', 'Dismiss')
  close.innerHTML = '&times;'
  el.appendChild(close)

  toastContainer.appendChild(el)
  requestAnimationFrame(() => el.classList.add('toast-in'))
  const dismiss = () => {
    if (el._dismissed) return
    el._dismissed = true
    el.classList.remove('toast-in')
    el.addEventListener('transitionend', () => el.remove())
    setTimeout(() => el.remove(), 300)
  }
  close.onclick = e => { e.stopPropagation(); dismiss() }
  el.onclick = dismiss
  const duration = type === 'warn' ? 12000 : type === 'success' ? 4000 : 5000
  setTimeout(dismiss, duration)
}

export function init(state = {}) {
  state.user = auth.user
  state.userRoles ??= userRoleNames(auth.user)
  state.section = section
  state.active = (s) => s === section
  state.tab = (p) => p === page
  state.logout = () => auth.logout()
  state.can = (p) => auth.can(p)
  state.hasRole ??= role => hasUserRole(auth.user, role)
  state.orgEditor ??= canEditOrgSettings(auth.user)
  state.canEditOrganization ??= () => canEditOrgSettings(auth.user)
  state.userMenu ??= false
  state.icon ??= icon
  state.actionIcon ??= actionIcon
  state.activityIcon ??= activityIcon
  state.statusIcon ??= statusIcon
  state.methodIcon ??= methodIcon
  state.trendIcon ??= trendIcon
  state.mixerUrl ??= sessionStorage.getItem('mandir_mixer_url') || ''
  const reactive = start(document.body, state)
  if (auth.can('settings:manage') && !reactive.mixerUrl) {
    api.getProxyStatus()
      .then(st => {
        const url = st?.mixer?.local_url || ''
        if (url) {
          sessionStorage.setItem('mandir_mixer_url', url)
          reactive.mixerUrl = url
        }
      })
      .catch(() => {})
  }
  return reactive
}

export { auth }
