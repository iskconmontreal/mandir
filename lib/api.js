// api.js — fetch wrapper for Goloka backend

import { auth } from './auth.js'

export const BASE = localStorage.getItem('mandala_api') || 'https://api.iskconmontreal.ca'

async function request(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`

  const res = await fetch(`${BASE}${path}`, { ...opts, headers })

  if (res.status === 401 && auth.token) {
    auth.clear()
    auth.guard()
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || err.error || res.statusText)
  }

  return res.status === 204 ? null : res.json()
}

export const api = {
  get:  (path)       => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put:  (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del:  (path)       => request(path, { method: 'DELETE' }),

  login: (email, password, device_id, device_label) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, device_id, device_label })
  }),
  verifyOtp: (email, otp, device_id, device_label) => request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp, device_id, device_label })
  }),
  googleUrl: () => request('/auth/google'),

  getUsers:     (p)    => request(`/api/users?${new URLSearchParams(p)}`),
  getUser:      (id)   => request(`/api/users/${id}`),
  createUser:   (data) => request('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  revokeDevice:   (id)   => request(`/api/users/${id}/device`, { method: 'DELETE' }),
  getMyDevices:   ()     => request('/api/me/devices'),
  revokeMyDevice: (id)   => request(`/api/me/devices/${id}`, { method: 'DELETE' }),

  updateUser:    (id, d)  => request(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  getRoles:      ()       => request('/api/roles'),
  updateRolePerms: (id, d) => request(`/api/roles/${id}/permissions`, { method: 'PUT', body: JSON.stringify(d) }),

  getMembers:    (p)      => request(`/api/clients?${new URLSearchParams(p)}`),
  getMember:     (id)     => request(`/api/clients/${id}`),
  createMember:  (data)   => request('/api/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateMember:  (id, d)  => request(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  archiveMember: (id)     => request(`/api/clients/${id}`, { method: 'DELETE' }),
  inviteMember:  (id)     => request(`/api/clients/${id}/invite`, { method: 'POST' }),

  getDonations:    (p)      => request(`/api/donations?${new URLSearchParams(p)}`),
  createDonation:  (data)   => request('/api/donations', { method: 'POST', body: JSON.stringify(data) }),
  updateDonation:  (id, d)  => request(`/api/donations/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteDonation:  (id)     => request(`/api/donations/${id}`, { method: 'DELETE' }),

  extractDoc: (file) => {
    const form = new FormData()
    form.append('file', file)
    const headers = {}
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`
    return fetch(`${BASE}/api/documents/extract`, { method: 'POST', headers, body: form })
      .then(async r => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || e.error || r.statusText) }
        return r.json()
      })
  },

  getExpenses:     (p)      => request(`/api/expenses?${new URLSearchParams(p)}`),
  createExpense:   (data)   => request('/api/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense:   (id, d)  => request(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteExpense:   (id)     => request(`/api/expenses/${id}`, { method: 'DELETE' }),
}
