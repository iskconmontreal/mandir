// JWT rotation E2E: verify active sessions survive, idle sessions expire
// FEATURE: auth — token refresh under 10s JWT expiry

import { test, expect, request } from '@playwright/test'

const API = 'http://localhost:8082'
const DEVICE = 'dev-device'

async function freshLogin(role = 'admin') {
  const creds = { admin: { email: 'admin@test.local', password: 'test123' } }
  const { email, password } = creds[role]
  const data = { email, password, device_id: DEVICE, device_label: 'Rotation Test' }
  const ctx = await request.newContext()
  const res = await ctx.post(`${API}/auth/login`, { data })
  const body = await res.json()
  await ctx.dispose()
  if (!body.token) throw new Error(`Login failed: ${JSON.stringify(body)}`)
  return body
}

function setupSession(page, session, withRefresh = true) {
  return page.evaluate(({ token, user, refresh_token, api, store_refresh }) => {
    localStorage.setItem('mandir_token', token)
    localStorage.setItem('mandir_user', JSON.stringify(user))
    localStorage.setItem('mandir_api', api)
    if (store_refresh && refresh_token) localStorage.setItem('mandir_refresh', refresh_token)
  }, { ...session, api: API, store_refresh: withRefresh })
}

test.describe('jwt rotation (10s expiry)', () => {
  test('active user stays logged in after token expires', async ({ page }) => {
    const session = await freshLogin()
    await page.goto('/login.html')
    await setupSession(page, session)
    await page.goto('/app/')
    await expect(page).toHaveURL(/app\//)

    await page.waitForTimeout(12_000)

    const result = await page.evaluate(async () => {
      const { api } = await import('/lib/api.js')
      try {
        await api.getUsers({ page: 1, per_page: 1 })
        return 'ok'
      } catch (e) {
        return e.message
      }
    })

    expect(result).toBe('ok')
    const newToken = await page.evaluate(() => localStorage.getItem('mandir_token'))
    expect(newToken).toBeTruthy()
    expect(newToken).not.toBe(session.token)
  })

  test('user without refresh token is kicked out after expiry', async ({ page }) => {
    const session = await freshLogin()
    await page.goto('/login.html')
    await setupSession(page, session, false)
    await page.goto('/app/')
    await expect(page).toHaveURL(/app\//)

    await page.waitForTimeout(12_000)

    page.evaluate(async () => {
      const { api } = await import('/lib/api.js')
      await api.getUsers({ page: 1, per_page: 1 })
    }).catch(() => {})

    await expect(page).toHaveURL(/login/, { timeout: 10_000 })
  })

  test('multiple requests across token boundary all succeed', async ({ page }) => {
    const session = await freshLogin()
    await page.goto('/login.html')
    await setupSession(page, session)
    await page.goto('/app/')

    const results = await page.evaluate(async () => {
      const { api } = await import('/lib/api.js')
      const out = []
      for (let i = 0; i < 4; i++) {
        await new Promise(r => setTimeout(r, 4000))
        try {
          await api.getUsers({ page: 1, per_page: 1 })
          out.push({ i, ok: true })
        } catch (e) {
          out.push({ i, ok: false, error: e.message })
        }
      }
      return out
    })

    const failed = results.filter(r => !r.ok)
    expect(failed).toHaveLength(0)
    const newToken = await page.evaluate(() => localStorage.getItem('mandir_token'))
    expect(newToken).not.toBe(session.token)
  })
})
