import { test, expect } from '@playwright/test'

async function login(page) {
  await page.addInitScript(() => {
    localStorage.setItem('mandala_token', 'test-jwt')
    localStorage.setItem('mandala_user', JSON.stringify({ name: 'Test User', email: 'test@example.com' }))
  })
}

test.describe('auth guard', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/app/')
    await expect(page).toHaveURL(/login\.html/)
  })

  test('unauthenticated user cannot access donations', async ({ page }) => {
    await page.goto('/app/donations.html')
    await expect(page).toHaveURL(/login\.html/)
  })

  test('unauthenticated user cannot access expenses', async ({ page }) => {
    await page.goto('/app/expenses.html')
    await expect(page).toHaveURL(/login\.html/)
  })

  test('unauthenticated user cannot access members', async ({ page }) => {
    await page.goto('/app/members.html')
    await expect(page).toHaveURL(/login\.html/)
  })

  test('unauthenticated user cannot access settings', async ({ page }) => {
    await page.goto('/app/settings.html')
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
    await page.locator('.btn-link').click()
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
    await page.goto('/app/', { waitUntil: 'commit' })
    await page.evaluate(() => {
      localStorage.setItem('mandala_token', 'test-jwt')
      localStorage.setItem('mandala_user', JSON.stringify({ name: 'Test User', email: 'test@example.com' }))
    })
    await page.goto('/app/')
    await page.locator('.user-trigger').click()
    await page.locator('.user-menu-danger').click()
    await expect(page).toHaveURL(/login\.html/)
  })
})
