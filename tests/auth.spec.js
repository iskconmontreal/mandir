import { test, expect } from '@playwright/test'
import { loginAs, API } from './fixtures.js'

const login = page => loginAs(page, 'viewer')
const mkToken = (perms, expSec) => 'header.' + btoa(JSON.stringify({ permissions: perms, exp: Math.floor(Date.now() / 1000) + expSec })) + '.sig'

test.describe('auth guard', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/app/')
    await expect(page).toHaveURL(/login\.html/)
  })

  test('unauthenticated user cannot access finance', async ({ page }) => {
    await page.goto('/app/finance/')
    await expect(page).toHaveURL(/login\.html/)
  })

  test('unauthenticated user cannot access members', async ({ page }) => {
    await page.goto('/app/members/')
    await expect(page).toHaveURL(/login\.html/)
  })

  test('unauthenticated user cannot access profile', async ({ page }) => {
    await page.goto('/app/profile.html')
    await expect(page).toHaveURL(/login\.html/)
  })
})

test.describe('login page', () => {
  test('renders email-first form', async ({ page }) => {
    await page.goto('/login.html')
    await expect(page.locator('h1')).toHaveText('Sign in')
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).not.toBeVisible()
  })

  test('already authenticated user is redirected to app', async ({ page }) => {
    await login(page)
    await page.goto('/login.html')
    await expect(page).toHaveURL(/app\/index\.html/)
  })

  test('password user sees password step after email', async ({ page }) => {
    await page.goto('/login.html')
    await page.route('**/auth/login', route => {
      const body = JSON.parse(route.request().postData())
      if (!body.password) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'password_required' }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'otp_required' }) })
    })
    await page.locator('#email').fill('admin@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('h1')).toHaveText('Password')
    await expect(page.locator('#password')).toBeVisible()
  })

  test('password toggle shows/hides password', async ({ page }) => {
    await page.goto('/login.html')
    await page.route('**/auth/login', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'password_required' })
    }))
    await page.locator('#email').fill('admin@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#password')).toBeVisible()
    const pw = page.locator('#password')
    const toggle = page.locator('.toggle-pw')
    await expect(pw).toHaveAttribute('type', 'password')
    await toggle.click()
    await expect(pw).toHaveAttribute('type', 'text')
    await toggle.click()
    await expect(pw).toHaveAttribute('type', 'password')
  })
})

test.describe('otp flow', () => {
  test('passwordless user goes straight to otp', async ({ page }) => {
    await page.goto('/login.html')
    await page.route('**/auth/login', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'otp_required' })
    }))
    await page.locator('#email').fill('otp@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('h1')).toHaveText('Verify')
    await expect(page.locator('#otp')).toBeVisible()
  })

  test('password user gets otp after password', async ({ page }) => {
    await page.goto('/login.html')
    await page.route('**/auth/login', route => {
      const body = JSON.parse(route.request().postData())
      if (!body.password) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'password_required' }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'otp_required' }) })
    })
    await page.locator('#email').fill('admin@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#password')).toBeVisible()
    await page.locator('#password').fill('test123')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('h1')).toHaveText('Verify')
    await expect(page.locator('#otp')).toBeVisible()
  })

  test('back from otp returns to email step', async ({ page }) => {
    await page.goto('/login.html')
    await page.route('**/auth/login', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'otp_required' })
    }))
    await page.locator('#email').fill('otp@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#otp')).toBeVisible()
    await page.locator('.login-back').click()
    await expect(page.locator('h1')).toHaveText('Sign in')
    await expect(page.locator('#email')).toBeVisible()
  })

  test('trusted device gets token directly', async ({ page }) => {
    await page.goto('/login.html')
    await page.route('**/auth/login', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ token: 'test-jwt', user: { name: 'Test', email: 'admin@test.local' } })
    }))
    await page.locator('#email').fill('admin@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/app\/index\.html/)
  })

  test('otp verify error is displayed', async ({ page }) => {
    await page.goto('/login.html')
    await page.route('**/auth/login', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'otp_required' })
    }))
    await page.locator('#email').fill('otp@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#otp')).toBeVisible()
    await page.route('**/auth/verify-otp', route => route.fulfill({
      status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid verification code' })
    }))
    await page.locator('#otp').fill('000000')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('.login-error')).toHaveText('Invalid verification code')
  })

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/login.html')
    await page.route('**/auth/login', route => {
      const body = JSON.parse(route.request().postData())
      if (!body.password) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'password_required' }) })
      }
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid credentials' }) })
    })
    await page.locator('#email').fill('admin@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#password')).toBeVisible()
    await page.locator('#password').fill('wrongpass')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('.login-error')).toHaveText('Invalid credentials')
    await expect(page.locator('#password')).toBeVisible()
  })

  test('password user full login: email → password → otp → verify', async ({ page }) => {
    await page.goto('/login.html')
    await page.route('**/auth/login', route => {
      const body = JSON.parse(route.request().postData())
      if (!body.password) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'password_required' }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'otp_required' }) })
    })
    await page.route('**/auth/verify-otp', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ token: 'test-jwt', user: { name: 'Admin', email: 'admin@test.local' } })
    }))
    await page.locator('#email').fill('admin@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('h1')).toHaveText('Password')
    await page.locator('#password').fill('test123')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('h1')).toHaveText('Verify')
    await page.locator('#otp').fill('123456')
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/app\/index\.html/)
  })

  test('device_id is persisted in localStorage', async ({ page }) => {
    await page.goto('/login.html')
    const deviceId = await page.evaluate(async () => {
      const { auth } = await import('./lib/auth.js')
      return auth.deviceId
    })
    expect(deviceId).toMatch(/^[0-9a-f]{8}-/)
    const same = await page.evaluate(() => localStorage.getItem('mandala_device'))
    expect(same).toBe(deviceId)
  })

  test('otp login creates trusted device: second login skips otp', async ({ page }) => {
    await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok' } }))
    await page.goto('/login.html')
    let verifyOtpBody
    await page.route('**/auth/login', route => {
      const body = JSON.parse(route.request().postData())
      if (body.device_id && verifyOtpBody) {
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ token: 'jwt2', user: { name: 'Admin', email: 'admin@test.local' } }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ step: 'otp_required' }) })
    })
    await page.route('**/auth/verify-otp', route => {
      verifyOtpBody = JSON.parse(route.request().postData())
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ token: 'jwt1', user: { name: 'Admin', email: 'admin@test.local' } }) })
    })

    await page.locator('#email').fill('admin@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#otp')).toBeVisible()
    await page.locator('#otp').fill('123456')
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/app\/index\.html/)
    await page.waitForLoadState('load')

    expect(verifyOtpBody.device_id).toMatch(/^[0-9a-f]{8}-/)

    await page.evaluate(() => { localStorage.removeItem('mandala_token'); localStorage.removeItem('mandala_user') })
    await page.goto('/login.html')

    await page.locator('#email').fill('admin@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/app\/index\.html/)
  })

  test('otp step shows expiry countdown and resend button', async ({ page }) => {
    await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok' } }))
    await page.goto('/login.html')
    await page.route('**/auth/login', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'otp_required' })
    }))
    await page.locator('#email').fill('otp@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#otp')).toBeVisible()
    const meta = page.locator('.otp-meta')
    await expect(meta).toBeVisible()
    await expect(meta.locator('span')).toContainText('Expires in')
    await expect(meta.locator('button')).toContainText('Resend in')
    await expect(meta.locator('button')).toBeDisabled()
  })

  test('resend otp re-triggers login and resets countdown', async ({ page }) => {
    await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok' } }))
    await page.clock.install()
    await page.goto('/login.html')
    let loginCount = 0
    await page.route('**/auth/login', route => {
      loginCount++
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'otp_required' }) })
    })
    await page.locator('#email').fill('otp@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#otp')).toBeVisible()
    expect(loginCount).toBe(1)
    await page.clock.fastForward(31_000)
    const resendBtn = page.locator('.otp-meta button:not([disabled])')
    await expect(resendBtn).toBeVisible()
    await expect(resendBtn).toHaveText('Resend code')
    await resendBtn.click()
    expect(loginCount).toBe(2)
    await expect(page.locator('.otp-meta button')).toContainText('Resend in')
  })

  test('login sends device_label with browser info', async ({ page }) => {
    await page.goto('/login.html')
    let captured
    await page.route('**/auth/login', route => {
      captured = JSON.parse(route.request().postData())
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'otp_required' }) })
    })
    await page.locator('#email').fill('test@test.local')
    await page.locator('button[type="submit"]').click()
    expect(captured.device_id).toMatch(/^[0-9a-f]{8}-/)
    expect(captured.device_label).toMatch(/.+ on .+/)
  })
})

test.describe('logout', () => {
  test('sign out clears auth and redirects to login', async ({ page }) => {
    await loginAs(page, 'viewer')
    await page.route('https://api.iskconmontreal.ca/**', route => route.fulfill({ json: { items: [], total: 0 } }))
    await page.goto('/app/')
    await page.locator('.user-trigger').click()
    await page.locator('.user-menu-danger').click()
    await expect(page).toHaveURL(/login\.html/)
  })

  test('sign-out message shows as dismissing toast', async ({ page }) => {
    await page.goto('/login.html?msg=You+have+been+signed+out.')
    const toast = page.locator('.login-toast')
    await expect(toast).toBeVisible()
    await expect(toast).toHaveText('You have been signed out.')
    await toast.waitFor({ state: 'detached', timeout: 6000 })
  })
})

test.describe('login ui states', () => {
  test('back from password resets loading state', async ({ page }) => {
    await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok' } }))
    let resolve
    await page.route('**/auth/login', route => {
      const body = JSON.parse(route.request().postData())
      if (!body.password) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'password_required' }) })
      }
      return new Promise(r => { resolve = () => { r(); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'otp_required' }) }) } })
    })
    await page.goto('/login.html')
    await page.locator('#email').fill('admin@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#password')).toBeVisible()
    await page.locator('#password').fill('test123')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('button[type="submit"]')).toHaveClass(/btn-loading/)
    await page.locator('.login-back').click()
    await expect(page.locator('h1')).toHaveText('Sign in')
    await expect(page.locator('button[type="submit"]')).not.toHaveClass(/btn-loading/)
    if (resolve) resolve()
  })

  test('back from password step does not leave submit loading', async ({ page }) => {
    await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok' } }))
    await page.route('**/auth/login', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'password_required' })
    }))
    await page.goto('/login.html')
    await page.locator('#email').fill('admin@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#password')).toBeVisible()
    await page.locator('.login-back').click()
    await expect(page.locator('h1')).toHaveText('Sign in')
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).not.toHaveClass(/btn-loading/)
  })

  test('back from password shows welcome quotes', async ({ page }) => {
    await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok' } }))
    await page.route('**/auth/login', route => {
      const body = JSON.parse(route.request().postData())
      if (!body.password) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'password_required' }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ step: 'otp_required' }) })
    })
    await page.goto('/login.html')
    const firstQuote = await page.locator('.quote.active blockquote').textContent()
    await page.locator('#email').fill('admin@test.local')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('#password')).toBeVisible()
    const managerQuote = await page.locator('.quote.active blockquote').textContent()
    expect(managerQuote).not.toBe(firstQuote)
    await page.locator('.login-back').click()
    const backQuote = await page.locator('.quote.active blockquote').textContent()
    expect(backQuote).not.toBe(managerQuote)
  })
})

test.describe('keepAlive token refresh', () => {
  test('proactively refreshes token before expiry', async ({ page }) => {
    const token = mkToken([], 90)
    await page.addInitScript(([t, u]) => {
      localStorage.setItem('mandala_token', t)
      localStorage.setItem('mandala_user', JSON.stringify(u))
      localStorage.setItem('mandala_refresh', 'test-refresh')
    }, [token, { name: 'Test', email: 'test@test.local' }])

    let refreshCalled = false
    await page.route(`${API}/auth/refresh`, route => {
      refreshCalled = true
      const fresh = 'header.' + btoa(JSON.stringify({ permissions: [], exp: Math.floor(Date.now() / 1000) + 3600 })) + '.sig'
      route.fulfill({ json: { token: fresh, user: { name: 'Test', email: 'test@test.local' }, refresh_token: 'new-refresh' } })
    })
    await page.route(`${API}/api/**`, route => route.fulfill({ json: { items: [], total: 0 } }))

    await page.clock.install()
    await page.goto('/app/')
    await page.mouse.click(100, 100)
    await page.clock.fastForward(61_000)
    await page.waitForTimeout(200)
    expect(refreshCalled).toBe(true)
  })

  test('does not refresh when user is idle', async ({ page }) => {
    const token = mkToken([], 90)
    await page.addInitScript(([t, u]) => {
      localStorage.setItem('mandala_token', t)
      localStorage.setItem('mandala_user', JSON.stringify(u))
      localStorage.setItem('mandala_refresh', 'test-refresh')
    }, [token, { name: 'Test', email: 'test@test.local' }])

    let refreshCalled = false
    await page.route(`${API}/auth/refresh`, route => { refreshCalled = true; route.abort() })
    await page.route(`${API}/api/**`, route => route.fulfill({ json: { items: [], total: 0 } }))

    await page.clock.install()
    await page.goto('/app/')
    await page.clock.fastForward(31 * 60 * 1000)
    await page.clock.fastForward(61_000)
    await page.waitForTimeout(200)
    expect(refreshCalled).toBe(false)
  })
})
