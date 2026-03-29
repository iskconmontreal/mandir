// Token storage, route guard, and OAuth capture
// FEATURE: auth — JWT and device persistence

const TOKEN_KEY = 'mandir_token'
const USER_KEY = 'mandir_user'
const DEVICE_KEY = 'mandir_device'
const REFRESH_KEY = 'mandir_refresh'

function deviceLabel() {
  const ua = navigator.userAgent
  const browser = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Browser'
  const os = /Mac/.test(ua) ? 'macOS' : /Win/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : 'Unknown'
  return `${browser} on ${os}`
}

// Resolve path relative to site root (works from any subdirectory)
const base = new URL('..', import.meta.url).pathname

export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY) },
  get user() { try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null } },
  get deviceId() {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id) }
    return id
  },
  get deviceLabel() { return deviceLabel() },

  get userId() {
    const u = this.user
    if (u?.id) return u.id
    if (u?.user_id) return u.user_id
    try { return JSON.parse(atob(this.token.split('.')[1])).user_id || null } catch { return null }
  },

  get refreshToken() { return localStorage.getItem(REFRESH_KEY) },

  save(token, user, refreshToken) {
    localStorage.setItem(TOKEN_KEY, token)
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
  },

  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },

  get permissions() {
    try { return JSON.parse(atob(this.token.split('.')[1])).permissions || [] }
    catch { return [] }
  },

  can(perm) {
    if (this.permissions.includes(perm)) return true
    const [scope, action] = String(perm || '').split(':')
    if (!scope || !action) return false
    const alias = scope === 'donations'
      ? `income:${action}`
      : scope === 'income'
        ? `donations:${action}`
        : ''
    return !!alias && this.permissions.includes(alias)
  },

  get active() { return !!this.token },

  // Redirect to login if not authenticated
  guard() {
    if (!this.active) {
      window.location.href = base + 'login.html'
      return false
    }
    return true
  },

  // Capture token from URL fragment (after OAuth redirect)
  capture() {
    const hash = window.location.hash
    if (!hash) return false
    const params = new URLSearchParams(hash.slice(1))
    const token = params.get('token')
    const user = params.get('user')
    if (token) {
      this.save(token, user ? JSON.parse(decodeURIComponent(user)) : null)
      history.replaceState(null, '', window.location.pathname)
      return true
    }
    return false
  },

  logout(msg = 'You have been signed out.') {
    this.clear()
    window.location.href = base + 'login.html' + (msg ? '?msg=' + encodeURIComponent(msg) : '')
  }
}
