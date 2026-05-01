import { expect, request } from '@playwright/test'
import { test, loginAsReal, API } from './e2e.fixtures.js'

test.describe('e2e: income', () => {
  let token, authHeaders

  test.beforeEach(async ({ page }) => {
    token = await loginAsReal(page, 'treasurer')
    authHeaders = { Authorization: `Bearer ${token}` }
  })

  test('income tab loads real data', async ({ page }) => {
    await page.goto('/app/finance/?tab=transactions&net_type=income#transactions')
    await page.locator('.card-tab-group').waitFor()
    await expect(page.getByTestId('transactions-tab').getByTestId('tx-income').first()).toBeVisible({ timeout: 15_000 })
    expect(await page.getByTestId('transactions-tab').getByTestId('tx-income').count()).toBeGreaterThan(0)
  })

  test('create income via UI → verify in API', async ({ page }) => {
    await page.goto('/app/finance/?tab=transactions&net_type=income#transactions')
    await page.locator('.card-tab-group').waitFor()

    await page.click('button:has-text("+ Income")')
    await page.locator('.modal').waitFor()

    await page.fill('#don-amount', '100.00')
    await page.selectOption('#don-method', 'cash')

    await page.click('button:has-text("Save")')
    await page.waitForSelector('.modal', { state: 'hidden', timeout: 15_000 })

    const res = await page.request.get(`${API}/api/income?limit=1&sortBy=created_at&sortDesc=true`, { headers: authHeaders })
    const body = await res.json()
    expect(body.items[0].amount).toBe(10000)
  })

  test('create income via UI → appears in income list without reload', async ({ page }) => {
    await page.goto('/app/finance/?tab=transactions&net_type=income#transactions')
    await page.locator('.card-tab-group').waitFor()
    const section = page.getByTestId('transactions-tab')
    await expect(section).toBeVisible({ timeout: 10_000 })

    await page.click('button:has-text("+ Income")')
    await page.locator('.modal').waitFor()

    // Use a distinctive amount unlikely to collide with existing data
    await page.fill('#don-amount', '83.00')
    await page.click('button:has-text("Save")')
    await page.waitForSelector('.modal', { state: 'hidden', timeout: 15_000 })

    // After save, loadAll() refreshes the list in-place — new item must be visible without page reload
    await expect(
      section.locator('.recent-inc-value').filter({ hasText: '83.00' })
    ).toBeVisible({ timeout: 15_000 })

    // Cleanup
    const res = await page.request.get(`${API}/api/income?limit=5&sortBy=created_at&sortDesc=true`, { headers: authHeaders })
    const body = await res.json()
    const created = (body.items || []).find(i => i.amount === 8300)
    if (created) await page.request.delete(`${API}/api/income/${created.id}`, { headers: authHeaders })
  })

  test('income filter clear all restores rows after empty result', async ({ page }) => {
    const create = await page.request.post(`${API}/api/income`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { amount: 4321, type: 'donation', method: 'cash', category: 'general', date_received: '2026-03-07', note: 'e2e clear all regression' },
    })
    expect(create.ok()).toBeTruthy()

    await page.goto('/app/finance/?tab=transactions&net_type=income#transactions')
    await page.locator('.card-tab-group').waitFor()
    const section = page.getByTestId('transactions-tab')
    await expect(section.getByTestId('tx-income').first()).toBeVisible({ timeout: 15_000 })

    const before = await section.getByTestId('tx-income').count()
    expect(before).toBeGreaterThan(0)

    await section.locator('.btn-filter').click()
    await section.locator('.filter-dropdown select').first().selectOption('sale')
    await page.waitForTimeout(150)

    if (await section.getByTestId('tx-income').count()) {
      const nextYear = String(new Date().getFullYear() + 1)
      await section.locator('.filter-dropdown input[type="date"]').first().fill(`${nextYear}-01-01`)
    }

    await expect(section.getByTestId('tx-income')).toHaveCount(0)
    await expect(section).toContainText('No income matches filters')

    await expect(section.locator('.filter-dropdown')).toBeVisible()
    await section.locator('.filter-dropdown .btn-link', { hasText: 'Clear all' }).click()

    await expect(page).toHaveURL(/\?tab=transactions&net_type=income#transactions$/)
    await expect(section.getByTestId('tx-income').first()).toBeVisible({ timeout: 15_000 })
    expect(await section.getByTestId('tx-income').count()).toBeGreaterThan(0)
  })

  test('income tab loads via direct URL', async ({ page }) => {
    await page.goto('/app/finance/?tab=transactions&net_type=income#transactions')
    await page.locator('.card-tab-group').waitFor()
    await expect(page.getByTestId('transactions-tab').getByTestId('tx-income').first()).toBeVisible({ timeout: 15_000 })
    expect(await page.getByTestId('transactions-tab').getByTestId('tx-income').count()).toBeGreaterThan(0)
  })

  test('create income with receipt via API → attachments stored', async ({ page }) => {
    test.skip(true, 'requires ENVIRONMENT=test for OCR')
    const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    const upload = await page.request.post(`${API}/api/documents/upload`, {
      headers: authHeaders,
      multipart: {
        file: { name: 'e2e-receipt.png', mimeType: 'image/png', buffer: pngBytes },
        intent: 'donation',
      },
    })
    expect(upload.ok()).toBeTruthy()
    const { attachment } = await upload.json()
    expect(attachment.id).toBeGreaterThan(0)
    expect(attachment.id).toBeTruthy()

    const create = await page.request.post(`${API}/api/income`, {
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      data: { amount: 7777, type: 'donation', method: 'cash', category: 'general', date_received: '2026-03-01', attachment_ids: [attachment.id] },
    })
    expect(create.status()).toBe(201)
    const income = await create.json()
    expect(income.attachments).toHaveLength(1)
    expect(income.attachments[0].parent_type).toBe('income')
    expect(income.attachments[0].file_path).toContain('uploads/finance/')

    const get = await page.request.get(`${API}/api/income/${income.id}`, { headers: authHeaders })
    const fetched = await get.json()
    expect(fetched.attachments).toHaveLength(1)

    const serve = await page.request.get(`${API}/${attachment.file_path}`, { headers: authHeaders })
    expect(serve.status()).toBe(200)

    await page.request.delete(`${API}/api/income/${income.id}`, { headers: authHeaders })
  })

  test('income receipt upload via UI → verify attachment linked', async ({ page }) => {
    test.skip(true, 'requires ENVIRONMENT=test for OCR')
    await page.goto('/app/finance/?tab=transactions&net_type=income#transactions')
    await page.locator('.card-tab-group').waitFor()

    await page.click('button:has-text("+ Income")')
    await page.locator('.modal').waitFor()

    const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    await page.locator('#don-receipt-input').setInputFiles({
      name: 'ui-receipt.png',
      mimeType: 'image/png',
      buffer: pngBytes,
    })
    await expect(page.locator('.scan-area')).toHaveClass(/has-image/, { timeout: 15_000 })
    await expect(page.locator('.scan-area :text("Scanning")')).not.toBeVisible({ timeout: 60_000 })

    await page.fill('#don-amount', '55.55')
    await page.selectOption('#don-method', 'e-transfer')

    await page.click('button:has-text("Save")')
    await page.waitForSelector('.modal', { state: 'hidden', timeout: 30_000 })

    const res = await page.request.get(`${API}/api/income?limit=1&sortBy=created_at&sortDesc=true`, { headers: authHeaders })
    const body = await res.json()
    const latest = body.items[0]
    expect(latest.amount).toBe(5555)
    expect(latest.attachments).toHaveLength(1)
    expect(latest.attachments[0].parent_type).toBe('income')
    expect(latest.attachments[0].file_path).toContain('uploads/finance/')
  })
})
