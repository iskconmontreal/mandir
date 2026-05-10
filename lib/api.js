// Fetch wrapper for Goloka REST backend
// FEATURE: api — all HTTP communication

import { auth } from './auth.js'

export const BASE = localStorage.getItem('mandir_api') || 'https://api.iskconmontreal.ca'

let refreshPromise = null

function parseDetails(details) {
  if (!details) return {}
  if (typeof details === 'string') {
    try { return JSON.parse(details) || {} }
    catch { return {} }
  }
  return details
}

// Business date fields (date_received, expense_date) are calendar dates, not timestamps.
// Go serializes time.Time as "2026-04-01T00:00:00Z" — strip time so JS treats them as local dates.
const toDateOnly = d => typeof d === 'string' && d.length >= 10 ? d.slice(0, 10) : d || ''

function normalizeIncomeItem(item) {
  if (!item || typeof item !== 'object') return item
  const details = parseDetails(item.details)
  const type = item.type || 'donation'
  const sourceName = item.source_name || item.donor_name || ''
  const category = item.category || details.category || (type === 'donation' ? 'general' : '')
  return {
    ...item,
    type,
    source_name: sourceName,
    donor_name: sourceName,
    category,
    date_received: toDateOnly(item.date_received),
    event_name: item.event_name || details.event_name || '',
    reference: item.reference || details.reference || '',
    in_kind_description: item.in_kind_description || details.in_kind_description || '',
    fair_market_value: item.fair_market_value ?? details.fair_market_value ?? null,
    advantage_amount: item.advantage_amount ?? details.advantage_amount ?? 0,
    details,
  }
}

function normalizeIncomePage(res) {
  if (!res?.items) return res
  return { ...res, items: res.items.map(normalizeIncomeItem) }
}

function normalizeExpenseItem(item) {
  if (!item || typeof item !== 'object') return item
  const note = item.note ?? item.description ?? ''
  return {
    ...item,
    note,
    description: note,
    expense_date: toDateOnly(item.expense_date),
  }
}

function normalizeExpensePage(res) {
  if (!res?.items) return res
  return { ...res, items: res.items.map(normalizeExpenseItem) }
}

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

  getOrgSettings:    ()   => api.get('/api/org-settings'),
  updateOrgSettings: data => api.put('/api/org-settings', data),

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
  getMyMember:    ()   => api.get('/api/me/member'),
  updateMyMember: data => api.put('/api/me/member', data),
  updateMyMemberPhoto: file => {
    const form = new FormData()
    form.append('photo', file)
    return request('/api/me/member/photo', { method: 'PUT', body: form })
  },
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

  getIncome:      p    => api.get(`/api/income?${new URLSearchParams(p)}`).then(normalizeIncomePage),
  getIncomeById:  id   => api.get(`/api/income/${id}`).then(normalizeIncomeItem),
  createIncome:   data => api.post('/api/income', data).then(normalizeIncomeItem),
  updateIncome:   (id, d) => api.put(`/api/income/${id}`, d).then(normalizeIncomeItem),
  deleteIncome:   id   => api.del(`/api/income/${id}`),

  getDonations:   p    => api.getIncome({ ...(p || {}), type: (p || {}).type || 'donation' }),
  createDonation: data => api.createIncome({ type: 'donation', ...(data || {}) }),
  updateDonation: (id, d) => api.updateIncome(id, { type: 'donation', ...(d || {}) }),
  deleteDonation: id   => api.deleteIncome(id),

  uploadDoc: (file, intent) => {
    const form = new FormData()
    form.append('file', file)
    if (intent) form.append('intent', intent)
    return request('/api/documents/upload', { method: 'POST', body: form })
  },
  claimAttachment: id => api.post(`/api/documents/${id}/claim`),
  deleteAttachment: id => api.del(`/api/documents/${id}`),

  getExpenses:     p    => {
    const params = { ...(p || {}) }
    if (!params.level) params.level = 'list'
    return api.get(`/api/expenses?${new URLSearchParams(params)}`).then(normalizeExpensePage)
  },
  getExpense:      id   => api.get(`/api/expenses/${id}`).then(normalizeExpenseItem),
  createExpense:   data => api.post('/api/expenses', data).then(normalizeExpenseItem),
  updateExpense:   (id, d) => api.put(`/api/expenses/${id}`, d).then(normalizeExpenseItem),
  deleteExpense:   id   => api.del(`/api/expenses/${id}`),

  approveExpense:   (id, note) => api.post(`/api/expenses/${id}/approve`, { note }),
  rejectExpense:    (id, note) => api.post(`/api/expenses/${id}/reject`,  { note }),
  payExpense:       (id, ref, method) => api.post(`/api/expenses/${id}/pay`, { reference: ref, ...(method && { method }) }),
  closeExpense:     id         => api.post(`/api/expenses/${id}/close`),

  getMyExpenses:        p    => api.get(`/api/me/expenses?${new URLSearchParams(p)}`),
  getMyDonations:       p    => api.get(`/api/me/donations?${new URLSearchParams(p)}`),
  getMyDonationSummary: year => api.get(`/api/me/donations/summary?year=${year}`),
  getMyTaxReceipts:     ()   => api.get('/api/me/tax-receipts'),
  getFinanceSummary:    p    => api.get(`/api/finance/summary?${new URLSearchParams(p)}`),
  getDonorsSummary:     p    => api.get(`/api/donors/summary?${new URLSearchParams(p)}`),

  getTaxReceipts:    p    => api.get(`/api/tax-receipts?${new URLSearchParams(p || {})}`),
  issueTaxReceipt:   data => api.post('/api/tax-receipts', data),
  resendTaxReceipt:  id   => api.post(`/api/tax-receipts/${id}/resend`),
  uploadSignature:   (memberId, file) => {
    const form = new FormData()
    form.append('signature', file)
    return request(`/api/members/${memberId}/signature`, { method: 'POST', body: form })
  },
  fetchHtml: path => {
    const headers = {}
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`
    return fetch(`${BASE}${path}`, { headers }).then(r => r.ok ? r.text() : Promise.reject(new Error(r.statusText)))
  },

  getCounterSales: () => api.get('/api/finance/counter-sale'),

  getProxyStatus: () => api.get('/api/proxy/status'),
  proxySession: () => api.post('/api/proxy/session', {}),
  proxyUrl: path => new URL(path, BASE).href,
  proxyAuthorizedUrl: path => {
    const u = new URL(path, BASE)
    if (auth.token) u.searchParams.set('proxy_token', auth.token)
    return u.href
  },
}
