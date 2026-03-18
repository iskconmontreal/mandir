import { expect, request } from '@playwright/test'
import { test, loginAsReal, API } from './e2e.fixtures.js'

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
    await page.goto('/app/finance/?tab=expenses#expenses')
    await page.locator('.card-tab-group').waitFor()
    await expect(page.locator('button:has-text("+ Expense")')).toBeVisible()
    await expect(page.locator('button:has-text("+ Income")')).not.toBeVisible()
    const row = page.locator('expense-list .recent-exp-item').first()
    if (await row.isVisible().catch(() => false)) {
      await row.hover()
      await expect(page.locator('[aria-label="Quick approve expense"]')).toHaveCount(0)
      await expect(page.locator('[aria-label="Mark as paid"]')).toHaveCount(0)
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
    await page.fill('.exp-items-table tbody tr:first-child td:nth-child(2) input', '19.99')
    await page.selectOption('#exp-cat', 'books')
    await page.fill('#exp-desc', `E2E-myexp-${ts}`)
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
    await page.fill('.exp-items-table tbody tr:first-child td:nth-child(2) input', amount)
    await page.selectOption('#exp-cat', 'admin')
    await page.click('button:has-text("Submit")')
    await page.waitForSelector('.modal', { state: 'hidden', timeout: 15_000 })
    await myExpTable.waitFor({ timeout: 10_000 })

    const submittedTable = myExpTable.locator('xpath=following::table[1]')
    const submittedRow = submittedTable.locator('tbody tr.row-link').filter({ hasText: `$${amount}` }).first()
    await expect(submittedRow).toBeVisible({ timeout: 10_000 })
    await submittedRow.click()

    const modal = page.locator('.modal')
    await modal.waitFor()
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
    await expect(modal.locator('#exp-cat')).toBeDisabled()
    await expect(modal.locator('.exp-items-table tbody input[type="number"]').first()).toBeDisabled()
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

    await expect(page.locator('.exp-items-table tbody tr:first-child td:nth-child(2) input')).toBeVisible()
    await expect(page.locator('#exp-cat')).toBeVisible()
    await expect(page.locator('#exp-desc')).toBeVisible()
    await expect(page.locator('#exp-vendor')).not.toBeVisible()

    const options = await page.locator('#exp-cat option:not([disabled])').allTextContents()
    expect(options.length).toBe(17)

    const ts = Date.now()
    await page.fill('.exp-items-table tbody tr:first-child td:nth-child(2) input', '12.34')
    await page.selectOption('#exp-cat', 'kitchen')
    await page.fill('#exp-desc', `E2E-viewer-${ts}`)
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

    await approverPage.goto('/app/finance/?tab=expenses#expenses')
    await approverPage.locator('.card-tab-group').waitFor()
    await expect(approverPage.locator('expense-list .recent-exp-item').first()).toBeVisible({ timeout: 15_000 })

    await approverPage.fill('.filter-search', `E2E-Viewer-${ts}`)
    await approverPage.waitForTimeout(500)
    const row = approverPage.locator('expense-list .recent-exp-item').first()
    await expect(row).toBeVisible()

    await row.hover()
    await row.locator('[aria-label="Quick approve expense"]').click()
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
