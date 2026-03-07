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
    await expect(page.locator('h3').filter({ hasText: 'My Expenses' })).toHaveCount(0)
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

  test('overview: no Community card, no + Income button', async ({ page }) => {
    await page.goto('/app/')
    await page.locator('h1').waitFor()
    await expect(page.locator('h3').filter({ hasText: 'Finance' })).toBeVisible()
    await expect(page.locator('h3').filter({ hasText: 'Community' })).not.toBeVisible()
    await expect(page.locator('button:has-text("+ Income")')).not.toBeVisible()
  })

  test('nav: no Members link, no Roles link', async ({ page }) => {
    await page.goto('/app/')
    await page.locator('h1').waitFor()
    await expect(page.locator('.nav-item:has-text("Finance")')).toBeVisible()
    await expect(page.locator('.nav-item:has-text("Members")')).not.toBeVisible()
    await expect(page.locator('.user-menu-item:has-text("Roles")')).not.toBeVisible()
  })

  test('finance: can add expense, but no + Income, no approve/pay', async ({ page }) => {
    await page.goto('/app/finance/')
    await page.locator('.card-tab-group').waitFor()
    await expect(page.locator('button:has-text("+ Expense")')).toBeVisible()
    await expect(page.locator('button:has-text("+ Income")')).not.toBeVisible()
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

  test('overview: My Expenses table shows after submitting expense', async ({ page }) => {
    await page.goto('/app/')
    await page.locator('h1').waitFor()

    const ts = Date.now()
    await page.click('button:has-text("+ Expense")')
    await page.locator('.modal').waitFor()
    await page.fill('#home-exp-amount', '19.99')
    await page.selectOption('#home-exp-cat', 'books')
    await page.fill('#home-exp-desc', `E2E-myexp-${ts}`)
    await page.click('button:has-text("Submit")')
    await page.waitForSelector('.modal', { state: 'hidden', timeout: 15_000 })

    await expect(page.locator('h3').filter({ hasText: 'My Expenses' })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('table tbody tr', { hasText: '$19.99' }).first()).toBeVisible()
    await expect(page.locator('tfoot td', { hasText: '$' })).toBeVisible()
  })

  test('overview: click submitted expense → edit category/note → save', async ({ page }) => {
    await page.goto('/app/')
    await page.locator('h1').waitFor()
    const amount = (100 + ((Date.now() % 9000) / 100)).toFixed(2)
    const note = `Updated by E2E ${Date.now()}`

    const myExpTable = page.locator('h3').filter({ hasText: 'My Expenses' })
    await page.click('button:has-text("+ Expense")')
    await page.locator('.modal').waitFor()
    await page.fill('#home-exp-amount', amount)
    await page.selectOption('#home-exp-cat', 'admin')
    await page.click('button:has-text("Submit")')
    await page.waitForSelector('.modal', { state: 'hidden', timeout: 15_000 })
    await myExpTable.waitFor({ timeout: 10_000 })

    const submittedTable = myExpTable.locator('xpath=following::table[1]')
    const submittedRow = submittedTable.locator('tbody tr.row-link').filter({ hasText: `$${amount}` }).first()
    await expect(submittedRow).toBeVisible({ timeout: 10_000 })
    await submittedRow.click()

    const modal = page.locator('.modal')
    await modal.waitFor()
    await modal.locator('button:has-text("Edit")').click()
    await expect(modal.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    const catSelect = modal.locator('select')
    await expect(catSelect).toBeVisible()
    await expect(modal.locator('textarea')).toBeVisible()

    const currentCat = await catSelect.inputValue()
    const catValues = await catSelect.locator('option').evaluateAll(opts => opts.map(o => o.value).filter(Boolean))
    const nextCat = catValues.find(v => v !== currentCat)
    if (nextCat) await catSelect.selectOption(nextCat)
    await modal.locator('textarea').fill(note)
    await modal.locator('button:has-text("Update")').click()
    await page.waitForSelector('.modal', { state: 'hidden', timeout: 15_000 })

    await expect(submittedTable.locator('tbody tr.row-link').first()).toBeVisible({ timeout: 10_000 })
  })

  test('overview: approved expense row is read-only (no Save button)', async ({ browser }) => {
    const viewerCtx = await browser.newContext()
    const viewerPage = await viewerCtx.newPage()
    const viewerToken = await loginAsReal(viewerPage, 'viewer')
    const viewerHeaders = { Authorization: `Bearer ${viewerToken}`, 'Content-Type': 'application/json' }

    const ts = Date.now()
    const createRes = await viewerPage.request.post(`${API}/api/expenses`, {
      headers: viewerHeaders,
      data: { payee: `E2E-readonly-${ts}`, amount: 500, category: 'admin', expense_date: '2026-03-01', note: 'readonly test', currency: 'CAD' },
    })
    const created = await createRes.json()

    const treasurerCtx = await browser.newContext()
    const treasurerPage = await treasurerCtx.newPage()
    const treasurerToken = await loginAsReal(treasurerPage, 'treasurer')
    await treasurerPage.request.post(`${API}/api/expenses/${created.id}/approve`, {
      headers: { Authorization: `Bearer ${treasurerToken}`, 'Content-Type': 'application/json' },
      data: {},
    })
    await treasurerCtx.close()

    await viewerPage.goto('/app/')
    await viewerPage.locator('h1').waitFor()
    await expect(viewerPage.locator('h3').filter({ hasText: 'My Expenses' })).toBeVisible({ timeout: 10_000 })

    const myExpTable = viewerPage.locator('h3').filter({ hasText: 'My Expenses' }).locator('xpath=following::table[1]')
    const approvedRow = myExpTable.locator('tbody tr.row-link').filter({ hasText: '$5.00' }).first()
    await expect(approvedRow).toBeVisible()
    await approvedRow.click()

    const modal = viewerPage.locator('.modal')
    await modal.waitFor()
    await expect(modal.locator('button:has-text("Save")')).not.toBeVisible()
    await expect(modal.locator('select')).not.toBeVisible()
    await expect(modal.locator('button:has-text("Close")')).toBeVisible()

    await modal.locator('button:has-text("Close")').click()
    await viewerPage.request.delete(`${API}/api/expenses/${created.id}`, { headers: viewerHeaders })
    await viewerCtx.close()
  })

  test('overview: viewer expense form shows simplified fields and submits', async ({ page }) => {
    await page.goto('/app/')
    await page.locator('h1').waitFor()

    await page.click('button:has-text("+ Expense")')
    await page.locator('.modal').waitFor()

    await expect(page.locator('#home-exp-amount')).toBeVisible()
    await expect(page.locator('#home-exp-cat')).toBeVisible()
    await expect(page.locator('#home-exp-desc')).toBeVisible()
    await expect(page.locator('#home-exp-vendor')).not.toBeVisible()
    await expect(page.locator('#home-exp-date')).not.toBeVisible()

    const options = await page.locator('#home-exp-cat option:not([disabled])').allTextContents()
    expect(options.length).toBe(17)

    const ts = Date.now()
    await page.fill('#home-exp-amount', '12.34')
    await page.selectOption('#home-exp-cat', 'kitchen')
    await page.fill('#home-exp-desc', `E2E-viewer-${ts}`)
    await page.click('button:has-text("Submit")')
    await page.waitForSelector('.modal', { state: 'hidden', timeout: 15_000 })

    await expect(page.locator('table tbody tr', { hasText: `$12.34` }).first()).toBeVisible({ timeout: 10_000 })
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
      data: { payee: `E2E-Viewer-${ts}`, amount: 15000, category: 'admin', expense_date: '2026-03-01', note: 'Viewer test expense', currency: 'CAD' },
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
    await expect(approverPage.locator('.exp-card').first()).toBeVisible({ timeout: 15_000 })

    await approverPage.fill('.filter-search', `E2E-Viewer-${ts}`)
    await approverPage.waitForTimeout(500)
    const card = approverPage.locator('.exp-card').first()
    await expect(card).toBeVisible()

    await card.hover()
    await card.locator('button:has-text("Approve")').click()
    await approverPage.waitForTimeout(1000)

    const treasurerCtx = await browser.newContext()
    const treasurerPage = await treasurerCtx.newPage()
    const treasurerToken = await loginAsReal(treasurerPage, 'treasurer')
    await treasurerPage.request.post(`${API}/api/expenses/${created.id}/approve`, {
      headers: { Authorization: `Bearer ${treasurerToken}`, 'Content-Type': 'application/json' },
      data: {},
    })
    await treasurerCtx.close()

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

  test('expenses tab loads real data', async ({ page }) => {
    await page.goto('/app/finance/')
    await page.locator('.card-tab-group').waitFor()
    await expect(page.locator('.exp-card').first()).toBeVisible({ timeout: 15_000 })
    expect(await page.locator('.exp-card').count()).toBeGreaterThan(0)
  })

  test('create expense via UI → verify in API', async ({ page }) => {
    await page.goto('/app/finance/')
    await page.locator('.card-tab-group').waitFor()

    await page.click('button:has-text("+ Expense")')
    await page.locator('.modal').waitFor()

    await page.fill('#exp-amount', '42.50')
    await page.fill('#exp-vendor', 'E2E Test Vendor')
    await page.selectOption('#exp-cat', { index: 1 })

    await page.click('button:has-text("Submit")')
    await page.waitForSelector('.modal', { state: 'hidden', timeout: 15_000 })

    const res = await page.request.get(`${API}/api/expenses?limit=1&sortBy=created_at&sortDesc=true`, { headers: authHeaders })
    const body = await res.json()
    expect(body.items[0].payee).toBe('E2E Test Vendor')
    expect(body.items[0].amount).toBe(4250)
  })

  test('expense detail modal shows real data', async ({ page }) => {
    await page.goto('/app/finance/')
    await page.locator('.card-tab-group').waitFor()
    await expect(page.locator('.exp-card').first()).toBeVisible({ timeout: 15_000 })

    await page.locator('.exp-card').first().hover()
    await page.locator('.exp-card').first().locator('button:has-text("Edit")').click()
    await page.locator('.modal').waitFor()
    await expect(page.locator('.modal')).toBeVisible()
  })

  test('search filters expenses', async ({ page }) => {
    await page.goto('/app/finance/')
    await page.locator('.card-tab-group').waitFor()
    await expect(page.locator('.exp-card').first()).toBeVisible({ timeout: 15_000 })

    const allCards = await page.locator('.exp-card').count()
    await page.fill('.filter-search', 'Metro')
    await page.waitForTimeout(500)

    const filteredCards = await page.locator('.exp-card').count()
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

test.describe('e2e: income', () => {
  let token, authHeaders

  test.beforeEach(async ({ page }) => {
    token = await loginAsReal(page, 'treasurer')
    authHeaders = { Authorization: `Bearer ${token}` }
  })

  test('income tab loads real data', async ({ page }) => {
    await page.goto('/app/finance/#income')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.card-tab', { hasText: 'Income' }).click()
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 })
    expect(await page.locator('table tbody tr').count()).toBeGreaterThan(0)
  })

  test('create income via UI → verify in API', async ({ page }) => {
    await page.goto('/app/finance/#income')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.card-tab', { hasText: 'Income' }).click()

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

  test('donors tab loads real data', async ({ page }) => {
    await page.goto('/app/finance/#donors')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.card-tab', { hasText: 'Donors' }).click()
    const rows = page.locator('section:not(.hidden) table tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 15_000 })
    expect(await rows.count()).toBeGreaterThan(0)
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
    await page.goto('/app/finance/#income')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.card-tab', { hasText: 'Income' }).click()

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

test.describe('e2e: members', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsReal(page, 'admin')
  })

  test('members page loads real data', async ({ page }) => {
    await page.goto('/app/members/')
    const rows = page.locator('table tbody tr').filter({ hasNotText: 'Loading…' })
    await rows.first().waitFor({ timeout: 15_000 })
    expect(await rows.count()).toBeGreaterThan(5)
  })

  test('search filter finds specific member', async ({ page }) => {
    await page.goto('/app/members/')
    const rows = page.locator('table tbody tr').filter({ hasNotText: 'Loading…' })
    await rows.first().waitFor({ timeout: 15_000 })
    const allRows = await rows.count()

    await page.fill('input[type="search"]', 'Charith')
    await page.waitForTimeout(500)

    const filteredRows = await rows.count()
    expect(filteredRows).toBeLessThan(allRows)
    expect(filteredRows).toBeGreaterThan(0)
  })

  test('member detail opens on row click', async ({ page }) => {
    await page.goto('/app/members/')
    const rows = page.locator('table tbody tr').filter({ hasNotText: 'Loading…' })
    await rows.first().waitFor({ timeout: 15_000 })

    await rows.first().click()
    await page.locator('.modal').waitFor()
    await expect(page.locator('.modal')).toBeVisible()
  })
})
