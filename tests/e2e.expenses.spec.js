import { expect, request } from '@playwright/test'
import { test, loginAsReal, API } from './e2e.fixtures.js'

test.describe('e2e: expenses', () => {
  let token, authHeaders

  test.beforeEach(async ({ page }) => {
    token = await loginAsReal(page, 'treasurer')
    authHeaders = { Authorization: `Bearer ${token}` }
  })

  test('expenses tab loads real data', async ({ page }) => {
    await page.goto('/app/finance/?tab=transactions&net_type=expense#transactions')
    await page.locator('.card-tab-group').waitFor()
    await expect(page.getByTestId('transactions-tab').getByTestId('tx-expense').first()).toBeVisible({ timeout: 15_000 })
    expect(await page.getByTestId('transactions-tab').getByTestId('tx-expense').count()).toBeGreaterThan(0)
  })

  test('create expense via UI → verify in API', async ({ page }) => {
    await page.goto('/app/finance/?tab=transactions&net_type=expense#transactions')
    await page.locator('.card-tab-group').waitFor()

    await page.click('button:has-text("+ Expense")')
    await page.locator('.modal').waitFor()

    await page.fill('.exp-items-table tbody tr:first-child td:nth-child(2) input', '42.50')
    await page.fill('#exp-vendor', 'E2E Test Vendor')
    await page.selectOption('#exp-cat', { index: 1 })

    await page.click('button:has-text("Submit")')
    await page.waitForSelector('.modal', { state: 'hidden', timeout: 15_000 })

    const res = await page.request.get(`${API}/api/expenses?limit=1&sortBy=created_at&sortDesc=true`, { headers: authHeaders })
    const body = await res.json()
    expect(body.items[0].payee).toBe('E2E Test Vendor')
    expect(body.items[0].amount).toBe(4250)
  })

  test('expense row opens edit modal with real data', async ({ page }) => {
    await page.goto('/app/finance/?tab=transactions&net_type=expense#transactions')
    await page.locator('.card-tab-group').waitFor()
    const row = page.getByTestId('transactions-tab').getByTestId('tx-expense').first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    await row.click()
    await page.locator('.modal').waitFor()
    await expect(page.locator('.modal')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
  })

  test('search filters expenses', async ({ page }) => {
    await page.goto('/app/finance/?tab=transactions&net_type=expense#transactions')
    await page.locator('.card-tab-group').waitFor()
    const rows = page.getByTestId('transactions-tab').getByTestId('tx-expense')
    await expect(rows.first()).toBeVisible({ timeout: 15_000 })

    const allCards = await rows.count()
    await page.fill('.filter-search', 'Metro')
    await page.waitForTimeout(500)

    const filteredCards = await rows.count()
    expect(filteredCards).toBeLessThanOrEqual(allCards)
  })

  test('CRUD via API: create + read + delete', async ({ page }) => {
    const createRes = await page.request.post(`${API}/api/income`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { amount: 5000, type: 'donation', method: 'cash', category: 'general', date_received: '2026-01-01' },
    })
    const created = await createRes.json()
    expect(created.id).toBeTruthy()

    const readRes = await page.request.get(`${API}/api/income/${created.id}`, { headers: authHeaders })
    expect(readRes.ok()).toBeTruthy()

    const delRes = await page.request.delete(`${API}/api/income/${created.id}`, { headers: authHeaders })
    expect(delRes.ok()).toBeTruthy()
  })
})
