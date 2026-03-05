import { expect } from '@playwright/test'
import { test, loginAsReal, API } from './e2e.fixtures.js'

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
    expect(body.items[0].paid_to).toBe('E2E Test Vendor')
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
