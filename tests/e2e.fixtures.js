// Real auth helpers for E2E tests against live goloka sandbox
// FEATURE: tests — E2E login with real JWT via trusted device

import { test as base, request } from '@playwright/test'

export const API = 'http://localhost:8081'
const DEVICE = 'dev-device'

const CREDS = {
  admin:     { email: 'admin@test.local',     password: 'test123' },
  treasurer: { email: 'treasurer@test.local', password: 'test123' },
  approver:  { email: 'approver@test.local',  password: 'test123' },
  viewer:    { email: 'viewer@test.local',    password: 'test123' },
  sevaka:    { email: 'sevaka@test.local',    password: 'test123' },
}

const tokenCache = {}

async function fetchToken(role) {
  if (tokenCache[role]) return tokenCache[role]
  const ctx = await request.newContext()
  const { email, password } = CREDS[role]
  const res = await ctx.post(`${API}/auth/login`, {
    data: { email, password, device_id: DEVICE, device_label: 'E2E Test' },
  })
  const body = await res.json()
  await ctx.dispose()
  if (!body.token) throw new Error(`Login failed for ${role}: ${JSON.stringify(body)}`)
  tokenCache[role] = { token: body.token, user: body.user }
  return tokenCache[role]
}

export async function loginAsReal(page, role = 'admin') {
  const { token, user } = await fetchToken(role)
  await page.addInitScript(([t, u, api]) => {
    localStorage.setItem('mandala_token', t)
    localStorage.setItem('mandala_user', JSON.stringify(u))
    localStorage.setItem('mandala_api', api)
  }, [token, user, API])
  return token
}

export const test = base.extend({
  adminToken: async ({ page }, use) => {
    const token = await loginAsReal(page, 'admin')
    await use(token)
  },
})
