// Fetch wrapper for Goloka REST backend
// FEATURE: api — all HTTP communication

import { auth } from './auth.js'

export const BASE = localStorage.getItem('mandala_api') || 'https://api.iskconmontreal.ca'

let refreshPromise = null

async function tryRefresh() {
  if (!auth.refreshToken) return false
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: auth.refreshToken }),
      credentials: 'include',
    })
    if (!res.ok) return false
    const data = await res.json()
    if (data.token) { auth.save(data.token, data.user, data.refresh_token); return true }
  } catch {}
  return false
}

let _alive = false
export function keepAlive() {
  if (_alive) return
  _alive = true
  let lastActive = Date.now()
  for (const e of ['mousedown', 'keydown', 'touchstart', 'scroll'])
    addEventListener(e, () => { lastActive = Date.now() }, { passive: true })

  setInterval(async () => {
    if (!auth.token || !auth.refreshToken) return
    if (Date.now() - lastActive > 30 * 60 * 1000) return
    try {
      const { exp } = JSON.parse(atob(auth.token.split('.')[1]))
      if (exp * 1000 - Date.now() < 2 * 60 * 1000) {
        if (!refreshPromise) refreshPromise = tryRefresh().finally(() => { refreshPromise = null })
        await refreshPromise
      }
    } catch {}
  }, 60_000)
}

async function request(path, opts = {}, retry = false) {
  const headers = { ...opts.headers }
  if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`

  const res = await fetch(`${BASE}${path}`, { ...opts, headers, credentials: 'include' })

  if (res.status === 401 && auth.token && !retry) {
    if (!refreshPromise) refreshPromise = tryRefresh().finally(() => { refreshPromise = null })
    const refreshed = await refreshPromise
    if (refreshed) return request(path, opts, true)
    auth.logout('Your session has expired. Please sign in again.')
    return
  }

  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json') && res.status !== 204) {
    throw new Error(res.ok ? `Route not found: ${path}` : res.statusText)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || err.error || res.statusText)
  }

  return res.status === 204 ? null : res.json()
}

export const api = {
  get:  path        => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put:  (path, body) => request(path, { method: 'PUT',  body: JSON.stringify(body) }),
  del:  path        => request(path, { method: 'DELETE' }),

  login:     (email, password, device_id, device_label) => api.post('/auth/login',      { email, password, device_id, device_label }),
  verifyOtp: (email, otp, device_id, device_label)      => api.post('/auth/verify-otp', { email, otp, device_id, device_label }),
  googleUrl: () => api.get('/auth/google'),

  getUsers:       p    => api.get(`/api/users?${new URLSearchParams(p)}`),
  getUser:        id   => api.get(`/api/users/${id}`),
  createUser:     data => api.post('/api/users', data),
  updateUser:     (id, d) => api.put(`/api/users/${id}`, d),
  getRoles:             ()             => api.get('/api/roles'),
  createRole:           data           => api.post('/api/roles', data),
  updateRolePermission: (id, key, on)  => api.put(`/api/roles/${id}/permissions`, { permission_key: key, enabled: on }),
  resetRolePermissions: id             => api.post(`/api/roles/${id}/reset`),
  deleteRole:           id             => api.del(`/api/roles/${id}`),
  revokeDevice:   id   => api.del(`/api/users/${id}/device`),
  getMyDevices:   ()   => api.get('/api/me/devices'),
  revokeMyDevice: id   => api.del(`/api/me/devices/${id}`),

  getMembers:    p    => api.get(`/api/members?${new URLSearchParams(p)}`),
  getMember:     id   => api.get(`/api/members/${id}`),
  createMember:  data => api.post('/api/members', data),
  updateMember:  (id, d) => api.put(`/api/members/${id}`, d),
  archiveMember: id   => api.del(`/api/members/${id}`),
  inviteMember:      id         => api.post(`/api/members/${id}/invite`),
  uploadMemberPhoto: (id, file) => {
    const form = new FormData()
    form.append('photo', file)
    return request(`/api/members/${id}/photo`, { method: 'PUT', body: form })
  },

  getDonations:   p    => api.get(`/api/donations?${new URLSearchParams(p)}`),
  createDonation: data => api.post('/api/donations', data),
  updateDonation: (id, d) => api.put(`/api/donations/${id}`, d),
  deleteDonation: id   => api.del(`/api/donations/${id}`),

  uploadDoc: (file, intent) => {
    const form = new FormData()
    form.append('file', file)
    if (intent) form.append('intent', intent)
    return request('/api/documents/upload', { method: 'POST', body: form })
  },
  claimAttachment: id => api.post(`/api/documents/${id}/claim`),

  getExpenses:     p    => api.get(`/api/expenses?${new URLSearchParams(p)}`),
  getExpense:      id   => api.get(`/api/expenses/${id}`),
  createExpense:   data => api.post('/api/expenses', data),
  updateExpense:   (id, d) => api.put(`/api/expenses/${id}`, d),
  deleteExpense:   id   => api.del(`/api/expenses/${id}`),

  approveExpense:   (id, note) => api.post(`/api/expenses/${id}/approve`, { note }),
  rejectExpense:    (id, note) => api.post(`/api/expenses/${id}/reject`,  { note }),
  payExpense:       (id, ref)  => api.post(`/api/expenses/${id}/pay`,     { bank_ref: ref }),
  getExpenseApprovals: id      => api.get(`/api/expenses/${id}/approvals`),

  getMyExpenses:        p    => api.get(`/api/me/expenses?${new URLSearchParams(p)}`),
  getMyDonations:       p    => api.get(`/api/me/donations?${new URLSearchParams(p)}`),
  getMyDonationSummary: year => api.get(`/api/me/donations/summary?year=${year}`),
  getMyTaxReceipts:     ()   => api.get('/api/me/tax-receipts'),
  getFinanceSummary:    p    => api.get(`/api/finance/summary?${new URLSearchParams(p)}`),
  getDonorsSummary:     p    => api.get(`/api/donors/summary?${new URLSearchParams(p)}`),
  getAuditLogs:         p    => api.get(`/api/audit?${new URLSearchParams(p)}`),
}
