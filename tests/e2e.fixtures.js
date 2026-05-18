// Real auth helpers for E2E tests against live goloka sandbox
// FEATURE: tests — E2E login with real JWT via trusted device

import { test as base, request } from '@playwright/test'

export const API = 'http://localhost:8081'
const DEVICE = 'dev-device'

// A valid 8×8 baseline JPEG. goloka's upload pipeline decodes images and
// re-encodes them to WebP, so receipt uploads must be genuinely decodable.
const BASE_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof' +
  'Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwh' +
  'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAAR' +
  'CAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAA' +
  'AAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAM' +
  'AwEAAhEDEQA/AJwAOdv/2Q==',
  'base64',
)

// Returns a valid, content-unique JPEG buffer for receipt-upload tests.
// Bytes appended after the EOI marker are ignored by image decoders but
// change the SHA-256, so each call dodges goloka's content-hash dedup.
export function uniqueJpeg(tag = '') {
  return Buffer.concat([BASE_JPEG, Buffer.from(`\ne2e-${tag}-${Date.now()}-${Math.random()}`)])
}

const CREDS = {
  admin:     { email: 'admin@test.local',     password: 'test123' },
  treasurer: { email: 'treasurer@test.local', password: 'test123' },
  approver:  { email: 'approver@test.local',  password: 'test123' },
  viewer:    { email: 'viewer@test.local' },
  member:    { email: 'sevaka@test.local' },
  sevaka:    { email: 'sevaka@test.local' },
}

const tokenCache = {}

async function fetchToken(role) {
  if (tokenCache[role]) return tokenCache[role]
  const { email, password } = CREDS[role]
  const data = { email, device_id: DEVICE, device_label: 'E2E Test' }
  if (password) data.password = password
  const ctx = await request.newContext()
  const res = await ctx.post(`${API}/auth/login`, { data })
  const body = await res.json()
  await ctx.dispose()
  if (!body.token) throw new Error(`Login failed for ${role}: ${JSON.stringify(body)}`)
  tokenCache[role] = { token: body.token, user: body.user, refresh_token: body.refresh_token }
  return tokenCache[role]
}

export async function freshLogin(role = 'admin') {
  const { email, password } = CREDS[role]
  const data = { email, device_id: DEVICE, device_label: 'E2E Test' }
  if (password) data.password = password
  const ctx = await request.newContext()
  const res = await ctx.post(`${API}/auth/login`, { data })
  const body = await res.json()
  await ctx.dispose()
  if (!body.token) throw new Error(`Login failed for ${role}: ${JSON.stringify(body)}`)
  return { token: body.token, user: body.user, refresh_token: body.refresh_token }
}

export async function loginAsReal(page, role = 'admin') {
  const { token, user, refresh_token } = await fetchToken(role)
  await page.addInitScript(([t, u, api, rt]) => {
    localStorage.setItem('mandir_token', t)
    localStorage.setItem('mandir_user', JSON.stringify(u))
    localStorage.setItem('mandir_api', api)
    if (rt) localStorage.setItem('mandir_refresh', rt)
  }, [token, user, API, refresh_token])
  return token
}

export const test = base.extend({
  adminToken: async ({ page }, use) => {
    const token = await loginAsReal(page, 'admin')
    await use(token)
  },
})
