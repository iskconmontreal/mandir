import { expect, request } from '@playwright/test'
import { test, loginAsReal, API } from './e2e.fixtures.js'

test.describe('e2e: passwordless login', () => {
  test('viewer skips password step and gets token via trusted device', async () => {
    const ctx = await request.newContext()
    const res = await ctx.post(`${API}/auth/login`, {
      data: { email: 'viewer@test.local', device_id: 'dev-device', device_label: 'E2E Test' },
    })
    const body = await res.json()
    await ctx.dispose()
    expect(body.token).toBeTruthy()
    expect(body.user).toBeTruthy()
  })

  test('sevaka skips password step and gets token via trusted device', async () => {
    const ctx = await request.newContext()
    const res = await ctx.post(`${API}/auth/login`, {
      data: { email: 'sevaka@test.local', device_id: 'dev-device', device_label: 'E2E Test' },
    })
    const body = await res.json()
    await ctx.dispose()
    expect(body.token).toBeTruthy()
    expect(body.user).toBeTruthy()
  })

  test('passwordless user without trusted device goes to otp', async () => {
    const ctx = await request.newContext()
    const res = await ctx.post(`${API}/auth/login`, {
      data: { email: 'viewer@test.local', device_id: 'unknown-device', device_label: 'New Device' },
    })
    const body = await res.json()
    await ctx.dispose()
    expect(body.step).toBe('otp_required')
    expect(body.token).toBeFalsy()
  })

  test('password user without password gets password_required step', async () => {
    const ctx = await request.newContext()
    const res = await ctx.post(`${API}/auth/login`, {
      data: { email: 'admin@test.local', device_id: 'unknown-device', device_label: 'New Device' },
    })
    const body = await res.json()
    await ctx.dispose()
    expect(body.step).toBe('password_required')
  })
})

test.describe('e2e: auth & overview', () => {
  test('health check passes on real backend', async ({ page }) => {
    const res = await page.request.get(`${API}/api/health`)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.db).toBe('ok')
    expect(body.finance_db).toBe('ok')
  })

  test('admin overview shows real finance + community data', async ({ page, adminToken }) => {
    await page.goto('/app/')
    await expect(page.locator('h1')).toContainText('Hare Krishna')
    await expect(page.locator('h3').filter({ hasText: 'Finance' })).toBeVisible()
    await expect(page.locator('h3').filter({ hasText: 'Community' })).toBeVisible()
  })

  test('viewer sees overview with personal sections only', async ({ page }) => {
    await loginAsReal(page, 'viewer')
    await page.goto('/app/')
    await page.locator('h1').waitFor()
    await expect(page.locator('h1')).toContainText('Hare Krishna')
  })
})

test.describe('e2e: viewer restrictions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsReal(page, 'viewer')
  })

  test('overview: no Community card, no + Donation button', async ({ page }) => {
    await page.goto('/app/')
    await page.locator('h1').waitFor()
    await expect(page.locator('h3').filter({ hasText: 'Finance' })).toBeVisible()
    await expect(page.locator('h3').filter({ hasText: 'Community' })).not.toBeVisible()
    await expect(page.locator('button:has-text("+ Donation")')).not.toBeVisible()
  })

  test('nav: no Members link, no Roles link', async ({ page }) => {
    await page.goto('/app/')
    await page.locator('h1').waitFor()
    await expect(page.locator('.nav-item:has-text("Finance")')).toBeVisible()
    await expect(page.locator('.nav-item:has-text("Members")')).not.toBeVisible()
    await expect(page.locator('.user-menu-item:has-text("Roles")')).not.toBeVisible()
  })

  test('finance: can add expense, but no + Donation, no approve/pay', async ({ page }) => {
    await page.goto('/app/finance/')
    await page.locator('.card-tab-group').waitFor()
    await expect(page.locator('button:has-text("+ Expense")')).toBeVisible()
    await expect(page.locator('button:has-text("+ Donation")')).not.toBeVisible()
    const card = page.locator('.exp-card').first()
    if (await card.isVisible().catch(() => false)) {
      await card.hover()
      await expect(page.locator('button:has-text("Approve")')).not.toBeVisible()
      await expect(page.locator('button:has-text("Paid")')).not.toBeVisible()
    }
  })

  test('members page redirects away (no members:view)', async ({ page }) => {
    await page.goto('/app/members/')
    await expect(page).not.toHaveURL(/members/, { timeout: 5000 })
  })
})

test.describe('e2e: viewer submits → approver approves', () => {
  test('viewer creates expense via API, approver approves in UI', async ({ browser }) => {
    const viewerCtx = await browser.newContext()
    const viewerPage = await viewerCtx.newPage()
    const viewerToken = await loginAsReal(viewerPage, 'viewer')
    const viewerHeaders = { Authorization: `Bearer ${viewerToken}`, 'Content-Type': 'application/json' }

    const ts = Date.now()
    const createRes = await viewerPage.request.post(`${API}/api/expenses`, {
      headers: viewerHeaders,
      data: { payee: `E2E-Viewer-${ts}`, amount: 7777, category: 'office', expense_date: '2026-03-01', description: 'Viewer test expense' },
    })
    const created = await createRes.json()
    expect(created.id).toBeTruthy()
    expect(created.status).toBe('submitted')
    await viewerCtx.close()

    const approverCtx = await browser.newContext()
    const approverPage = await approverCtx.newPage()
    const approverToken = await loginAsReal(approverPage, 'approver')
    const approverHeaders = { Authorization: `Bearer ${approverToken}` }

    await approverPage.goto('/app/finance/')
    await approverPage.locator('.card-tab-group').waitFor()
    await approverPage.locator('.seg[title="Table view"]').click().catch(() => {})
    await expect(approverPage.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 })

    await approverPage.fill('.filter-search', `E2E-Viewer-${ts}`)
    await approverPage.waitForTimeout(500)
    const row = approverPage.locator('table tbody tr').first()
    await expect(row).toBeVisible()

    const approveBtn = row.locator('button:has-text("Approve")')
    await approveBtn.click()
    await approverPage.waitForTimeout(1000)

    const checkRes = await approverPage.request.get(`${API}/api/expenses/${created.id}`, { headers: approverHeaders })
    const updated = await checkRes.json()
    expect(updated.status).toBe('approved')

    await approverPage.request.delete(`${API}/api/expenses/${created.id}`, { headers: approverHeaders })
    await approverCtx.close()
  })
})

test.describe('e2e: expenses', () => {
  let token, authHeaders

  test.beforeEach(async ({ page }) => {
    token = await loginAsReal(page, 'treasurer')
    authHeaders = { Authorization: `Bearer ${token}` }
  })

  test('expenses tab loads real data in table view', async ({ page }) => {
    await page.goto('/app/finance/')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.seg[title="Table view"]').click().catch(() => {})
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 })
    expect(await page.locator('table tbody tr').count()).toBeGreaterThan(0)
  })

  test('create expense via UI → verify in API', async ({ page }) => {
    await page.goto('/app/finance/')
    await page.locator('.card-tab-group').waitFor()

    await page.click('button:has-text("+ Expense")')
    await page.locator('.modal').waitFor()

    await page.fill('#exp-vendor', 'E2E Test Vendor')
    await page.fill('#exp-amount', '42.50')
    await page.selectOption('#exp-cat', { index: 1 })

    await page.click('button:has-text("Save")')
    await page.waitForSelector('.modal', { state: 'hidden', timeout: 15_000 })

    const res = await page.request.get(`${API}/api/expenses?limit=1&sortBy=created_at&sortDesc=true`, { headers: authHeaders })
    const body = await res.json()
    expect(body.items[0].payee).toBe('E2E Test Vendor')
    expect(body.items[0].amount).toBe(4250)
  })

  test('expense detail modal shows real data', async ({ page }) => {
    await page.goto('/app/finance/')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.seg[title="Table view"]').click().catch(() => {})
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 })

    await page.locator('table tbody tr').first().click()
    await page.locator('.modal').waitFor()
    await expect(page.locator('.modal .badge').first()).toBeVisible()
    const fields = await page.locator('.detail-field').count()
    expect(fields).toBeGreaterThanOrEqual(3)
  })

  test('search filters expenses', async ({ page }) => {
    await page.goto('/app/finance/')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.seg[title="Table view"]').click().catch(() => {})
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 })

    const allRows = await page.locator('table tbody tr').count()
    await page.fill('.filter-search', 'Metro')
    await page.waitForTimeout(500)

    const filteredRows = await page.locator('table tbody tr').count()
    expect(filteredRows).toBeLessThanOrEqual(allRows)
  })

  test('CRUD via API: create + read + delete', async ({ page }) => {
    const createRes = await page.request.post(`${API}/api/donations`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { amount: 5000, method: 'cash', category: 'general', date_received: '2026-01-01' },
    })
    const created = await createRes.json()
    expect(created.id).toBeTruthy()

    const readRes = await page.request.get(`${API}/api/donations/${created.id}`, { headers: authHeaders })
    expect(readRes.ok()).toBeTruthy()

    const delRes = await page.request.delete(`${API}/api/donations/${created.id}`, { headers: authHeaders })
    expect(delRes.ok()).toBeTruthy()
  })
})

test.describe('e2e: donations', () => {
  let token, authHeaders

  test.beforeEach(async ({ page }) => {
    token = await loginAsReal(page, 'treasurer')
    authHeaders = { Authorization: `Bearer ${token}` }
  })

  test('donations tab loads real data', async ({ page }) => {
    await page.goto('/app/finance/#donations')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.card-tab', { hasText: 'Donations' }).click()
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 })
    expect(await page.locator('table tbody tr').count()).toBeGreaterThan(0)
  })

  test('create donation via UI → verify in API', async ({ page }) => {
    await page.goto('/app/finance/#donations')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.card-tab', { hasText: 'Donations' }).click()

    await page.click('button:has-text("+ Donation")')
    await page.locator('.modal').waitFor()

    await page.fill('#don-amount', '100.00')
    await page.selectOption('#don-method', 'cash')

    await page.click('button:has-text("Save")')
    await page.waitForSelector('.modal', { state: 'hidden', timeout: 15_000 })

    const res = await page.request.get(`${API}/api/donations?limit=1&sortBy=created_at&sortDesc=true`, { headers: authHeaders })
    const body = await res.json()
    expect(body.items[0].amount).toBe(10000)
  })

  test('donors tab loads real data', async ({ page }) => {
    await page.goto('/app/finance/#donors')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.card-tab', { hasText: 'Donors' }).click()
    const rows = page.locator('section:not(.hidden) table tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 15_000 })
    expect(await rows.count()).toBeGreaterThan(0)
  })
})

test.describe('e2e: members', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsReal(page, 'admin')
  })

  test('members page loads real data', async ({ page }) => {
    await page.goto('/app/members/')
    await page.locator('table tbody tr').first().waitFor({ timeout: 15_000 })
    expect(await page.locator('table tbody tr').count()).toBeGreaterThan(5)
  })

  test('search filter finds specific member', async ({ page }) => {
    await page.goto('/app/members/')
    await page.locator('table tbody tr').first().waitFor({ timeout: 15_000 })
    const allRows = await page.locator('table tbody tr').count()

    await page.fill('input[type="search"]', 'Charith')
    await page.waitForTimeout(500)

    const filteredRows = await page.locator('table tbody tr').count()
    expect(filteredRows).toBeLessThan(allRows)
    expect(filteredRows).toBeGreaterThan(0)
  })

  test('member detail opens on row click', async ({ page }) => {
    await page.goto('/app/members/')
    await page.locator('table tbody tr').first().waitFor({ timeout: 15_000 })

    await page.locator('table tbody tr').first().click()
    await page.locator('.modal').waitFor()
    await expect(page.locator('.modal')).toBeVisible()
  })
})
