import { test, expect } from '@playwright/test'
import { loginAs, API } from './fixtures.js'

function mockFinance(page, { donations = [], expenses = [], members = [], auditLogs = [] } = {}) {
  return page.route(`${API}/**`, async route => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const path = url.pathname
    const idMatch = path.match(/\/api\/expenses\/(\d+)\/(\w+)/)

    if (idMatch) {
      const [, id, action] = idMatch
      const exp = expenses.find(e => e.id == id)
      const transitions = { approve: 'approved', pay: 'paid', reject: 'rejected' }
      if (exp && transitions[action]) { exp.status = transitions[action]; return route.fulfill({ json: exp }) }
    }

    if (path === '/api/donations' && method === 'POST') {
      const body = route.request().postDataJSON()
      const d = { id: donations.length + 1, ...body, status: 'submitted' }
      donations.push(d)
      return route.fulfill({ json: d })
    }
    if (path === '/api/donations' && method === 'GET') {
      return route.fulfill({ json: { items: [...donations], total: donations.length } })
    }
    if (path.startsWith('/api/donations/') && method === 'DELETE') {
      const id = +path.split('/').at(-1)
      const i = donations.findIndex(d => d.id === id)
      if (i >= 0) donations.splice(i, 1)
      return route.fulfill({ status: 204 })
    }
    if (path.startsWith('/api/donations/') && method === 'PUT') {
      const id = +path.split('/').at(-1)
      const body = route.request().postDataJSON()
      const i = donations.findIndex(d => d.id === id)
      if (i >= 0) donations[i] = { ...donations[i], ...body }
      return route.fulfill({ json: donations[i] ?? {} })
    }

    if (path === '/api/expenses') {
      if (method === 'POST') {
        const body = route.request().postDataJSON()
        const e = { id: expenses.length + 1, ...body, status: 'submitted' }
        expenses.push(e)
        return route.fulfill({ json: e })
      }
      return route.fulfill({ json: { items: [...expenses], total: expenses.length } })
    }

    if (path === '/api/members') return route.fulfill({ json: { items: members, total: members.length } })
    if (path.startsWith('/api/expenses/') && method === 'DELETE') {
      const id = +path.split('/').at(-1)
      const i = expenses.findIndex(e => e.id === id)
      if (i >= 0) expenses.splice(i, 1)
      return route.fulfill({ status: 204 })
    }
    if (/^\/api\/expenses\/\d+$/.test(path) && method === 'GET') {
      const id = +path.split('/').at(-1)
      const exp = expenses.find(e => e.id === id)
      return route.fulfill(exp ? { json: exp } : { status: 404, json: { error: 'Not found' } })
    }
    if (path.startsWith('/api/expenses/') && method === 'GET') {
      return route.fulfill({ json: { items: [], total: 0 } })
    }
    if (path.startsWith('/api/expenses/') && method === 'PUT') {
      const id = +path.split('/')[3]
      const body = route.request().postDataJSON()
      const i = expenses.findIndex(e => e.id === id)
      if (i >= 0) expenses[i] = { ...expenses[i], ...body }
      return route.fulfill({ json: expenses[i] ?? {} })
    }
    if (path === '/api/audit') {
      const eid = url.searchParams.get('entity_id')
      const items = eid ? auditLogs.filter(l => String(l.entity_id) === eid) : auditLogs
      return route.fulfill({ json: { items, total: items.length } })
    }
    if (method !== 'GET') return route.fulfill({ status: 404, json: { error: 'Unexpected mutation in mock: ' + path } })
    route.fulfill({ json: { items: [], total: 0 } })
  })
}

async function openFinance(page, tab = 'expenses') {
  await page.goto(`/app/finance/#${tab}`)
  await page.locator('.card-tab-group').waitFor()
  if (tab === 'expenses') await page.evaluate(() => document.querySelector('.seg[title="Table view"]')?.click())
}

test.describe('finance section', () => {
  let errors

  test.beforeEach(async ({ page }) => {
    errors = []
    page.on('pageerror', err => errors.push(err.message))
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
      if (msg.type() === 'warning' && msg.text().includes('Cycle')) errors.push(msg.text())
    })
    await loginAs(page, 'treasurer')
  })

  test.afterEach(() => { expect(errors).toEqual([]) })

  test('shows three tabs: Expenses, Donations, Donors', async ({ page }) => {
    await mockFinance(page)
    await openFinance(page)
    const tabs = page.locator('.card-tab')
    await expect(tabs).toHaveCount(3)
    await expect(tabs.nth(0).locator('.stat-label')).toHaveText('Expenses')
    await expect(tabs.nth(1).locator('.stat-label')).toHaveText('Donations')
    await expect(tabs.nth(2).locator('.stat-label')).toHaveText('Donors')
  })


  test('no crash on keydown with undefined key (autofill)', async ({ page }) => {
    await mockFinance(page)
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await page.locator('#exp-amount').waitFor({ timeout: 5000 })
    await page.click('a:has-text("More fields")')
    await page.locator('#exp-vendor').focus()
    await page.evaluate(() => document.dispatchEvent(new Event('keydown')))
    await page.locator('#exp-vendor').fill('Test')
  })

  test('add expense: fill fields → save → appears in table', async ({ page }) => {
    const expenses = []
    await mockFinance(page, { expenses })
    await openFinance(page)

    await page.click('button:has-text("+ Expense")')
    await page.locator('#exp-amount').waitFor({ timeout: 5000 })
    await page.click('a:has-text("More fields")')
    await page.fill('#exp-vendor', 'Hydro Quebec')
    await page.selectOption('#exp-cat', 'kitchen')
    await page.fill('#exp-amount', '142.50')
    await page.fill('#exp-desc', 'Monthly electricity bill')
    await page.click('button:has-text("Submit")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    const row = page.locator('table tbody tr').first()
    await expect(row).toContainText('Hydro Quebec')
    await expect(row).toContainText('142.50')
    await expect(row.locator('.status-submitted')).toBeVisible()
    await expect(row).toContainText('Kitchen')

    expect(expenses).toHaveLength(1)
    expect(expenses[0].payee).toBe('Hydro Quebec')
    expect(expenses[0].amount).toBe(14250)
    expect(expenses[0].category).toBe('kitchen')
  })

  test('add donation: fill fields → save → appears in donations table', async ({ page }) => {
    const donations = []
    await mockFinance(page, { donations })
    await openFinance(page, 'donations')

    await page.click('button:has-text("+ Donation")')
    await expect(page.getByRole('heading', { name: 'Add Donation' })).toBeVisible()

    await page.locator('#don-amount').waitFor({ timeout: 5000 })
    await page.fill('#don-amount', '50.00')
    await page.click('a:has-text("More fields")')
    await page.selectOption('#don-method', 'cash')
    await page.selectOption('#don-cat', 'general')
    await page.click('button:has-text("Save Donation")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    const donSection = page.locator('section').nth(1)
    await expect(donSection.locator('tr.row-link').first()).toContainText('50.00')
    await expect(donSection.locator('tr.row-link').first()).toContainText('General')

    expect(donations).toHaveLength(1)
    expect(donations[0].amount).toBe(5000)
    expect(donations[0].method).toBe('cash')
  })

  test('add anonymous donation (no donor) works', async ({ page }) => {
    const donations = []
    await mockFinance(page, { donations })
    await openFinance(page, 'donations')

    await page.click('button:has-text("+ Donation")')
    await page.locator('#don-amount').waitFor({ timeout: 5000 })
    await page.fill('#don-amount', '25.00')
    await page.click('button:has-text("Save Donation")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(donations[0].member_id).toBeFalsy()
  })

  test('delete donation: two-step confirm in modal (no browser dialog)', async ({ page }) => {
    const donations = [{ id: 1, amount: 5000, method: 'cash', category: 'general', date_received: '2025-01-15', note: '' }]
    await mockFinance(page, { donations })
    await openFinance(page, 'donations')

    await page.locator('section').nth(1).locator('tr.row-link').first().click()
    await expect(page.getByRole('heading', { name: 'Edit Donation' })).toBeVisible()

    await page.click('button:has-text("Delete")')
    await expect(page.locator('button:has-text("Yes")')).toBeVisible()
    await expect(page.locator('button:has-text("No")')).toBeVisible()
    await expect(page.locator('text=Delete permanently?')).toBeVisible()

    await page.click('button:has-text("Yes")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })
    expect(donations).toHaveLength(0)
  })

  test('delete cancel (No) keeps record', async ({ page }) => {
    const donations = [{ id: 1, amount: 5000, method: 'cash', category: 'general', date_received: '2025-01-15', note: '' }]
    await mockFinance(page, { donations })
    await openFinance(page, 'donations')

    await page.locator('section').nth(1).locator('tr.row-link').first().click()
    await page.click('button:has-text("Delete")')
    await page.click('button:has-text("No")')
    await expect(page.locator('button:has-text("Delete")')).toBeVisible()
    expect(donations).toHaveLength(1)
  })

  test('approve button NOT visible without expenses:approve', async ({ page }) => {
    await loginAs(page, 'member')
    const expenses = [{ id: 1, amount: 5000, payee: 'Vendor', category: 'kitchen', expense_date: '2025-01-10', status: 'submitted' }]
    await mockFinance(page, { expenses })
    await openFinance(page)

    await page.locator('table tbody tr').first().click()
    await expect(page.locator('button:has-text("Approve")')).toHaveCount(0)
  })

  test('paid-to field visible for treasurers in expense form', async ({ page }) => {
    await mockFinance(page)
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await expect(page.getByRole('heading', { name: 'Add Expense' })).toBeVisible()
    await page.click('a:has-text("More fields")')
    await expect(page.locator('#exp-vendor')).toBeVisible()
  })

  test('payee hidden by default in expense form', async ({ page }) => {
    await mockFinance(page)
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await expect(page.getByRole('heading', { name: 'Add Expense' })).toBeVisible()
    await expect(page.locator('#exp-vendor')).not.toBeVisible()
  })

  test('expense filter by category reduces results', async ({ page }) => {
    const expenses = [
      { id: 1, amount: 1000, payee: 'A', category: 'kitchen', expense_date: '2025-01-01', status: 'submitted' },
      { id: 2, amount: 2000, payee: 'B', category: 'utilities', expense_date: '2025-01-02', status: 'submitted' },
    ]
    await mockFinance(page, { expenses })
    await openFinance(page)
    await page.locator('tr.row-link').first().waitFor()

    const section = page.locator('section').first()
    await section.locator('.cat-pill-seg').filter({ hasText: 'Kitchen' }).click({ force: true })

    await expect(section.locator('tr.row-link')).toHaveCount(1)
    await expect(section.locator('tr.row-link').first()).toContainText('Kitchen')
  })

  test('expense category pill toggles filter on and off', async ({ page }) => {
    const expenses = [
      { id: 1, amount: 1000, payee: 'A', category: 'kitchen', expense_date: '2025-01-01', status: 'submitted' },
      { id: 2, amount: 2000, payee: 'B', category: 'utilities', expense_date: '2025-01-02', status: 'submitted' },
    ]
    await mockFinance(page, { expenses })
    await openFinance(page)
    await page.locator('tr.row-link').first().waitFor()

    const section = page.locator('section').first()
    const pill = section.locator('.cat-pill-seg').filter({ hasText: 'Kitchen' })
    await pill.click({ force: true })
    await expect(section.locator('tr.row-link')).toHaveCount(1)

    await pill.click({ force: true })
    await expect(section.locator('tr.row-link')).toHaveCount(2)
  })

  test('expense filter by status reduces results', async ({ page }) => {
    const expenses = [
      { id: 1, amount: 1000, payee: 'A', category: 'kitchen', expense_date: '2025-01-01', status: 'submitted' },
      { id: 2, amount: 2000, payee: 'B', category: 'utilities', expense_date: '2025-01-02', status: 'approved' },
      { id: 3, amount: 3000, payee: 'C', category: 'rent', expense_date: '2025-01-03', status: 'approved' },
    ]
    await mockFinance(page, { expenses })
    await openFinance(page)
    await page.locator('tr.row-link').first().waitFor()

    const section = page.locator('section').first()
    await section.locator('.btn-filter').click()
    await section.locator('.filter-dropdown select').first().selectOption('approved')
    await section.locator('.filter-dropdown .btn-primary').click()

    await expect(section.locator('tr.row-link')).toHaveCount(2)
  })

  test('expense filter dropdown stays open while interacting', async ({ page }) => {
    const expenses = [
      { id: 1, amount: 1000, payee: 'A', category: 'kitchen', expense_date: '2025-01-01', status: 'submitted' },
    ]
    await mockFinance(page, { expenses })
    await openFinance(page)
    await page.locator('tr.row-link').first().waitFor()

    const section = page.locator('section').first()
    await section.locator('.btn-filter').click()
    await expect(section.locator('.filter-dropdown')).toBeVisible()

    await section.locator('.filter-dropdown select').first().selectOption('submitted')
    await expect(section.locator('.filter-dropdown')).toBeVisible()

    await section.locator('.filter-dropdown input[type="date"]').first().fill('2025-01-01')
    await expect(section.locator('.filter-dropdown')).toBeVisible()
  })

  test('donation filter by category reduces results', async ({ page }) => {
    const donations = [
      { id: 1, amount: 5000, method: 'cash', category: 'general', date_received: '2025-01-01', note: '' },
      { id: 2, amount: 3000, method: 'cheque', category: 'building_fund', date_received: '2025-01-02', note: '' },
      { id: 3, amount: 2000, method: 'cash', category: 'general', date_received: '2025-01-03', note: '' },
    ]
    await mockFinance(page, { donations })
    await openFinance(page, 'donations')
    const section = page.locator('section').nth(1)
    await section.locator('tr.row-link').first().waitFor()

    await section.locator('.cat-pill-seg').filter({ hasText: 'Building' }).click({ force: true })
    await expect(section.locator('tr.row-link')).toHaveCount(1)
  })

  test('donation search filter reduces results', async ({ page }) => {
    const donations = [
      { id: 1, amount: 5000, method: 'cash', category: 'general', date_received: '2025-01-01', note: 'sunday feast' },
      { id: 2, amount: 3000, method: 'cheque', category: 'building_fund', date_received: '2025-01-02', note: 'building' },
    ]
    await mockFinance(page, { donations })
    await openFinance(page, 'donations')
    await page.locator('section').nth(1).locator('tr.row-link').first().waitFor()

    await page.fill('input[placeholder="Search donor or note…"]', 'sunday')

    const donSection = page.locator('section').nth(1)
    await expect(donSection.locator('tr.row-link')).toHaveCount(1, { timeout: 5000 })
    await expect(donSection.locator('tr.row-link').first()).toContainText('sunday feast')
  })



  test('loadErr shown when API fails', async ({ page }) => {
    await page.route(`${API}/**`, route => route.fulfill({ status: 500, json: { message: 'Failed to load data' } }))
    await page.goto('/app/finance/#expenses')
    await expect(page.locator('.login-error').filter({ hasText: /fail/i }).first()).toBeVisible({ timeout: 10000 })
    errors = []
  })

  test('CSV export downloads a file from expenses tab', async ({ page }) => {
    await mockFinance(page, { expenses: [{ id: 1, amount: 1000, payee: 'Vendor', category: 'kitchen', expense_date: '2025-01-01', status: 'submitted' }] })
    await openFinance(page)
    await page.locator('section').first().locator('tr.row-link').first().waitFor()

    await page.click('button:has-text("Export")')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("CSV")')
    ])
    expect(download.suggestedFilename()).toBe('expenses.csv')
  })

  test('CSV export downloads from donations tab', async ({ page }) => {
    await mockFinance(page, { donations: [{ id: 1, amount: 5000, method: 'cash', category: 'general', date_received: '2025-01-01', note: '' }] })
    await openFinance(page, 'donations')
    await page.locator('section').nth(1).locator('tr.row-link').first().waitFor()

    await page.locator('section').nth(1).locator('button:has-text("Export")').click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('section').nth(1).locator('a:has-text("CSV")').click()
    ])
    expect(download.suggestedFilename()).toBe('donations.csv')
  })

  test('receipt scan: auto-fills form and attachment_ids sent to backend on save', async ({ page }) => {
    const expenses = []
    let savedBody = null

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const method = route.request().method()
      const path = url.pathname

      if (path === '/api/documents/upload' && method === 'POST') {
        return route.fulfill({ json: {
          extracted_data: { amount: '142.50', vendor: 'Hydro Quebec', category: 'utilities', date: '2025-01-15' },
          attachment: { id: 42, file_path: 'uploads/finance/2025/2025-01-15-1.webp', original_name: 'receipt.jpg', mime_type: 'image/webp', file_size: 1024, intent: '' },
        } })
      }
      if (path === '/api/expenses' && method === 'POST') {
        savedBody = route.request().postDataJSON()
        const e = { id: 1, ...savedBody, status: 'submitted' }
        expenses.push(e)
        return route.fulfill({ json: e })
      }
      route.fulfill({ json: { items: [...expenses], total: expenses.length } })
    })

    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await expect(page.getByRole('heading', { name: 'Add Expense' })).toBeVisible()

    const minimalJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
      0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd3,
      0xff, 0xd9,
    ])

    await page.setInputFiles('#receipt-input', {
      name: 'receipt.jpg',
      mimeType: 'image/jpeg',
      buffer: minimalJpeg,
    })

    await expect(page.locator('.receipt-thumb')).toHaveCount(1, { timeout: 5000 })
    await expect(page.locator('#exp-amount')).toHaveValue('142.50', { timeout: 5000 })
    await expect(page.locator('#exp-vendor')).toHaveValue('Hydro Quebec', { timeout: 5000 })

    await page.click('button:has-text("Submit")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(savedBody).not.toBeNull()
    expect(savedBody.attachment_ids).toHaveLength(1)
    expect(savedBody.attachment_ids[0]).toBe(42)
  })

  test('save expense shows success toast', async ({ page }) => {
    await mockFinance(page, { expenses: [] })
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await page.locator('#exp-amount').waitFor({ timeout: 5000 })
    await page.click('a:has-text("More fields")')
    await page.fill('#exp-vendor', 'Test Vendor')
    await page.fill('#exp-amount', '50.00')
    await page.click('button:has-text("Submit")')
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.toast-success')).toContainText('Expense saved')
  })

  test('save donation shows success toast', async ({ page }) => {
    await mockFinance(page, { donations: [] })
    await openFinance(page, 'donations')
    await page.click('button:has-text("+ Donation")')
    await page.locator('#don-amount').waitFor({ timeout: 5000 })
    await page.fill('#don-amount', '25.00')
    await page.click('button:has-text("Save Donation")')
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.toast-success')).toContainText('Donation saved')
  })

  test('save expense blocked while receipt is still extracting', async ({ page }) => {
    let extractResolve
    await page.route(`${API}/**`, async route => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      if (path === '/api/documents/upload' && method === 'POST') {
        await new Promise(r => { extractResolve = r })
        return route.fulfill({ json: { extracted_data: { amount: '10.00' }, attachment: { id: 99, file_path: 'uploads/finance/2026/2026-03-05-1.jpg', original_name: 'r.jpg', mime_type: 'image/jpeg', file_size: 100, intent: '' } } })
      }
      route.fulfill({ json: { items: [], total: 0 } })
    })

    const minJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9])
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await page.setInputFiles('#receipt-input', { name: 'r.jpg', mimeType: 'image/jpeg', buffer: minJpeg })
    await expect(page.locator('.receipt-thumb')).toHaveCount(1, { timeout: 5000 })

    await page.click('a:has-text("More fields")')
    await page.fill('#exp-vendor', 'Test')
    await page.fill('#exp-amount', '10.00')
    await page.click('button:has-text("Submit")')
    await expect(page.locator('.login-error')).toContainText('Please wait for receipt processing')

    extractResolve()
  })

  test('multiple receipts: all attachment_ids sent on save', async ({ page }) => {
    const expenses = []
    let savedBody = null
    let callCount = 0

    await page.route(`${API}/**`, async route => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      if (path === '/api/documents/upload' && method === 'POST') {
        callCount++
        return route.fulfill({ json: {
          extracted_data: { amount: '50.00' },
          attachment: { id: 100 + callCount, file_path: `uploads/finance/2026/2026-03-05-${callCount}.webp`, original_name: `receipt${callCount}.jpg`, mime_type: 'image/webp', file_size: 512, intent: '' },
        } })
      }
      if (path === '/api/expenses' && method === 'POST') {
        savedBody = route.request().postDataJSON()
        const e = { id: 1, ...savedBody, status: 'submitted' }
        expenses.push(e)
        return route.fulfill({ json: e })
      }
      route.fulfill({ json: { items: [...expenses], total: expenses.length } })
    })

    const minJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9])
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')

    await page.setInputFiles('#receipt-input', [
      { name: 'receipt1.jpg', mimeType: 'image/jpeg', buffer: minJpeg },
      { name: 'receipt2.jpg', mimeType: 'image/jpeg', buffer: minJpeg },
    ])

    await expect(page.locator('.receipt-thumb')).toHaveCount(2, { timeout: 5000 })
    await page.fill('#exp-amount', '100.00')
    await page.click('button:has-text("Submit")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(savedBody.attachment_ids).toHaveLength(2)
    expect(savedBody.attachment_ids[0]).toBe(101)
    expect(savedBody.attachment_ids[1]).toBe(102)
  })

  test('receipt extraction failure: save proceeds without that file', async ({ page }) => {
    const expenses = []
    let savedBody = null

    await page.route(`${API}/**`, async route => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      if (path === '/api/documents/upload' && method === 'POST') {
        return route.fulfill({ status: 500, json: { message: 'OCR failed' } })
      }
      if (path === '/api/expenses' && method === 'POST') {
        savedBody = route.request().postDataJSON()
        return route.fulfill({ json: { id: 1, ...savedBody, status: 'submitted' } })
      }
      route.fulfill({ json: { items: [...expenses], total: expenses.length } })
    })

    const minJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9])
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await page.setInputFiles('#receipt-input', { name: 'bad.jpg', mimeType: 'image/jpeg', buffer: minJpeg })
    await expect(page.locator('.receipt-thumb.receipt-error')).toHaveCount(1, { timeout: 5000 })

    await page.click('a:has-text("More fields")')
    await page.fill('#exp-vendor', 'Fallback Vendor')
    await page.fill('#exp-amount', '99.00')
    await page.click('button:has-text("Submit")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(savedBody.attachment_ids).toBeUndefined()
    errors = []
  })

  test('remove receipt after autofill: form keeps values but no attachment_ids sent', async ({ page }) => {
    const expenses = []
    let savedBody = null

    await page.route(`${API}/**`, async route => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      if (path === '/api/documents/upload' && method === 'POST') {
        return route.fulfill({ json: {
          extracted_data: { amount: '75.00', vendor: 'Removed Store' },
          attachment: { id: 77, file_path: 'uploads/finance/2026/2026-03-05-1.webp', original_name: 'r.jpg', mime_type: 'image/webp', file_size: 256, intent: '' },
        } })
      }
      if (path === '/api/expenses' && method === 'POST') {
        savedBody = route.request().postDataJSON()
        return route.fulfill({ json: { id: 1, ...savedBody, status: 'submitted' } })
      }
      route.fulfill({ json: { items: [...expenses], total: expenses.length } })
    })

    const minJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9])
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await page.setInputFiles('#receipt-input', { name: 'r.jpg', mimeType: 'image/jpeg', buffer: minJpeg })

    await page.locator('#exp-vendor').waitFor({ timeout: 5000 })
    await expect(page.locator('#exp-vendor')).toHaveValue('Removed Store', { timeout: 5000 })
    await expect(page.locator('#exp-amount')).toHaveValue('75.00')

    await page.locator('.receipt-remove').click()
    await expect(page.locator('.receipt-thumb')).toHaveCount(0)

    await page.click('button:has-text("Submit")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(savedBody.payee).toBe('Removed Store')
    expect(savedBody.attachment_ids).toBeUndefined()
  })

  test('donation receipt scan: attachment_ids sent to backend on save', async ({ page }) => {
    const donations = []
    let savedBody = null

    await page.route(`${API}/**`, async route => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      if (path === '/api/documents/upload' && method === 'POST') {
        return route.fulfill({ json: {
          extracted_data: { amount: '100.00', method: 'cheque' },
          attachment: { id: 55, file_path: 'uploads/finance/2026/2026-03-05-1.webp', original_name: 'don-receipt.jpg', mime_type: 'image/webp', file_size: 2048, intent: '' },
        } })
      }
      if (path === '/api/donations' && method === 'POST') {
        savedBody = route.request().postDataJSON()
        const d = { id: 1, ...savedBody, status: 'submitted' }
        donations.push(d)
        return route.fulfill({ json: d })
      }
      route.fulfill({ json: { items: [...donations], total: donations.length } })
    })

    const minJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9])
    await openFinance(page, 'donations')
    await page.click('button:has-text("+ Donation")')
    await expect(page.getByRole('heading', { name: 'Add Donation' })).toBeVisible()
    await page.locator('#don-receipt-input').waitFor({ state: 'attached', timeout: 5000 })

    await page.setInputFiles('#don-receipt-input', { name: 'don-receipt.jpg', mimeType: 'image/jpeg', buffer: minJpeg })
    await expect(page.locator('#don-amount')).toHaveValue('100.00', { timeout: 5000 })

    await page.click('button:has-text("Save Donation")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(savedBody.attachment_ids).toHaveLength(1)
    expect(savedBody.attachment_ids[0]).toBe(55)
  })

  test('opening + Expense always starts fresh: no leftover receipts or form data', async ({ page }) => {
    await mockFinance(page, { expenses: [] })
    await openFinance(page)

    await page.click('button:has-text("+ Expense")')
    await page.locator('#exp-amount').waitFor({ timeout: 5000 })
    await page.click('a:has-text("More fields")')
    await page.fill('#exp-vendor', 'Leftover Vendor')
    await page.fill('#exp-amount', '99.00')
    await page.keyboard.press('Escape')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()

    await page.click('button:has-text("+ Expense")')
    await page.locator('#exp-amount').waitFor({ timeout: 5000 })
    await page.click('a:has-text("More fields")')
    await expect(page.locator('#exp-vendor')).toHaveValue('')
    await expect(page.locator('#exp-amount')).toHaveValue('')
    await expect(page.locator('.receipt-thumb')).toHaveCount(0)
    await expect(page.locator('.scan-icon')).toBeVisible()
  })

  test('ESC closes modal when file picker is not open', async ({ page }) => {
    await mockFinance(page)
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await expect(page.getByRole('heading', { name: 'Add Expense' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  test('ESC on lightbox closes lightbox but not modal', async ({ page }) => {
    await page.route(`${API}/**`, async route => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      if (path === '/api/documents/upload' && method === 'POST') {
        return route.fulfill({ json: {
          extracted_data: { amount: '10.00' },
          attachment: { id: 99, file_path: 'uploads/finance/2026/2026-03-05-1.webp', original_name: 'r.jpg', mime_type: 'image/webp', file_size: 100, intent: '' },
        } })
      }
      route.fulfill({ json: { items: [], total: 0 } })
    })

    const minJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9])
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await page.setInputFiles('#receipt-input', { name: 'r.jpg', mimeType: 'image/jpeg', buffer: minJpeg })
    await expect(page.locator('.receipt-thumb')).toHaveCount(1, { timeout: 5000 })

    await page.locator('.receipt-thumb img').click()
    await expect(page.locator('.lightbox')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('.lightbox')).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'Add Expense' })).toBeVisible()
  })

  test('drag and drop receipt auto-fills form', async ({ page }) => {
    await page.route(`${API}/**`, async route => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      if (path === '/api/documents/upload' && method === 'POST') {
        return route.fulfill({ json: {
          extracted_data: { amount: '55.00', vendor: 'Drop Store' },
          attachment: { id: 88, file_path: 'uploads/finance/2026/2026-03-05-1.webp', original_name: 'drop.jpg', mime_type: 'image/webp', file_size: 512, intent: '' },
        } })
      }
      route.fulfill({ json: { items: [], total: 0 } })
    })

    const minJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9])
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')

    const dataTransfer = await page.evaluateHandle((jpeg) => {
      const dt = new DataTransfer()
      const file = new File([new Uint8Array(jpeg)], 'drop.jpg', { type: 'image/jpeg' })
      dt.items.add(file)
      return dt
    }, [...minJpeg])

    await page.locator('.receipt-strip').dispatchEvent('drop', { dataTransfer })
    await expect(page.locator('.receipt-thumb')).toHaveCount(1, { timeout: 5000 })
    await page.locator('#exp-vendor').waitFor({ timeout: 5000 })
    await expect(page.locator('#exp-vendor')).toHaveValue('Drop Store', { timeout: 5000 })
    await expect(page.locator('#exp-amount')).toHaveValue('55.00')
  })



  test('add second receipt via + button after first succeeds', async ({ page }) => {
    let callCount = 0
    await page.route(`${API}/**`, async route => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      if (path === '/api/documents/upload' && method === 'POST') {
        callCount++
        return route.fulfill({ json: {
          extracted_data: { amount: '25.00' },
          attachment: { id: 200 + callCount, file_path: `uploads/finance/2026/2026-03-05-${callCount}.webp`, original_name: `r${callCount}.jpg`, mime_type: 'image/webp', file_size: 256, intent: '' },
        } })
      }
      route.fulfill({ json: { items: [], total: 0 } })
    })

    const minJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9])
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await page.setInputFiles('#receipt-input', { name: 'r1.jpg', mimeType: 'image/jpeg', buffer: minJpeg })
    await expect(page.locator('.receipt-thumb')).toHaveCount(1, { timeout: 5000 })

    await page.locator('.receipt-add').click()
    await page.setInputFiles('#receipt-input', { name: 'r2.jpg', mimeType: 'image/jpeg', buffer: minJpeg })
    await expect(page.locator('.receipt-thumb')).toHaveCount(2, { timeout: 5000 })
    await expect(page.locator('#exp-amount')).toHaveValue('50.00', { timeout: 5000 })
  })

  test('cancel button resets form and closes modal', async ({ page }) => {
    await mockFinance(page)
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await page.locator('#exp-amount').waitFor({ timeout: 5000 })
    await page.click('a:has-text("More fields")')
    await page.fill('#exp-vendor', 'Test')
    await page.click('button:has-text("Cancel")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()

    await page.click('button:has-text("+ Expense")')
    await page.locator('#exp-amount').waitFor({ timeout: 5000 })
    await page.click('a:has-text("More fields")')
    await expect(page.locator('#exp-vendor')).toHaveValue('')
  })

  test('update submitted expense: edit fields and save', async ({ page }) => {
    await loginAs(page, 'member')
    const expenses = [{ id: 1, amount: 5000, payee: 'Old Vendor', category: 'kitchen', expense_date: '2025-01-10', status: 'submitted' }]
    await mockFinance(page, { expenses })
    await openFinance(page)
    await page.locator('tr.row-link').first().waitFor()

    await page.locator('tr.row-link').first().click()
    await page.locator('#exp-amount').waitFor({ timeout: 5000 })
    await page.fill('#exp-amount', '75.00')
    await page.click('button:has-text("Update")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(expenses[0].amount).toBe(7500)
  })


  test('quick actions: approve and pay from table row', async ({ page }) => {
    const expenses = [
      { id: 1, amount: 5000, payee: 'Vendor A', category: 'kitchen', expense_date: '2025-01-10', status: 'submitted' },
      { id: 2, amount: 3000, payee: 'Vendor B', category: 'utilities', expense_date: '2025-01-11', status: 'approved' },
    ]
    await mockFinance(page, { expenses })
    await openFinance(page)
    await page.locator('tr.row-link').first().waitFor()

    const row1 = page.locator('tr.row-link').filter({ hasText: 'Vendor A' })
    const row2 = page.locator('tr.row-link').filter({ hasText: 'Vendor B' })

    await expect(row1.locator('.btn-quick-approve')).toBeVisible()
    await expect(row1.locator('.btn-quick-approve')).toHaveText('Approve')
    await expect(row2.locator('.btn-quick-pay')).toBeVisible()
    await expect(row2.locator('.btn-quick-pay')).toHaveText('Done')

    await row1.locator('.btn-quick-approve').click()
    await expect(page.locator('.toast-success').first()).toBeVisible({ timeout: 5000 })
    expect(expenses[0].status).toBe('approved')

    await row2.locator('.btn-quick-pay').click()
    await expect(page.locator('.toast-success').filter({ hasText: 'paid' })).toBeVisible({ timeout: 5000 })
    expect(expenses[1].status).toBe('paid')
  })

  test('quick approve: button shows loading then clears after response', async ({ page }) => {
    let resolveApproval
    const expenses = [{ id: 1, amount: 5000, payee: 'Slow Vendor', category: 'kitchen', expense_date: '2025-01-10', status: 'submitted' }]

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const method = route.request().method()
      const path = url.pathname
      const idMatch = path.match(/\/api\/expenses\/(\d+)\/approve/)
      if (idMatch && method === 'POST') {
        await new Promise(r => { resolveApproval = r })
        expenses[0].status = 'approved'
        return route.fulfill({ json: expenses[0] })
      }
      if (path === '/api/expenses' && method === 'GET') return route.fulfill({ json: { items: [...expenses], total: expenses.length } })
      route.fulfill({ json: { items: [], total: 0 } })
    })

    await openFinance(page)
    await page.locator('tr.row-link').first().waitFor()
    const btn = page.locator('.btn-quick-approve')
    await expect(btn).toBeVisible()

    await btn.click()
    await expect(btn).toHaveClass(/btn-loading/, { timeout: 3000 })

    resolveApproval()
    await expect(btn).not.toBeVisible({ timeout: 5000 })
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 })
  })

  test('quick approve: uses server response status (partial approval)', async ({ page }) => {
    const expenses = [{ id: 1, amount: 5000, payee: 'Partial Vendor', category: 'kitchen', expense_date: '2025-01-10', status: 'submitted' }]

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const method = route.request().method()
      const path = url.pathname
      const idMatch = path.match(/\/api\/expenses\/(\d+)\/approve/)
      if (idMatch && method === 'POST') {
        return route.fulfill({ json: { ...expenses[0], status: 'submitted' } })
      }
      if (path === '/api/expenses' && method === 'GET') return route.fulfill({ json: { items: [...expenses], total: expenses.length } })
      route.fulfill({ json: { items: [], total: 0 } })
    })

    await openFinance(page)
    await page.locator('tr.row-link').first().waitFor()
    const btn = page.locator('.btn-quick-approve')
    await btn.click()

    await expect(page.locator('.toast-success')).toContainText('Approval recorded', { timeout: 5000 })
    await expect(btn).toBeVisible()
    await expect(btn).not.toHaveClass(/btn-loading/)
  })


  test('extraction: user-edited fields not overridden by later receipt', async ({ page }) => {
    let callCount = 0
    await page.route(`${API}/**`, async route => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      if (path === '/api/documents/upload' && method === 'POST') {
        callCount++
        return route.fulfill({ json: {
          extracted_data: { amount: callCount === 1 ? '10.00' : '20.00', vendor: callCount === 1 ? 'First Store' : 'Second Store' },
          attachment: { id: 200 + callCount, file_path: `uploads/finance/2026/2026-03-05-${callCount}.webp`, original_name: `r${callCount}.jpg`, mime_type: 'image/webp', file_size: 256, intent: '' },
        } })
      }
      route.fulfill({ json: { items: [], total: 0 } })
    })

    const minJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9])
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await page.setInputFiles('#receipt-input', { name: 'r1.jpg', mimeType: 'image/jpeg', buffer: minJpeg })
    await page.locator('#exp-vendor').waitFor({ timeout: 5000 })
    await expect(page.locator('#exp-vendor')).toHaveValue('First Store', { timeout: 5000 })

    await page.fill('#exp-vendor', 'My Override')

    await page.locator('.receipt-add').click()
    await page.setInputFiles('#receipt-input', { name: 'r2.jpg', mimeType: 'image/jpeg', buffer: minJpeg })
    await expect(page.locator('.receipt-thumb')).toHaveCount(2, { timeout: 5000 })

    await expect(page.locator('#exp-vendor')).toHaveValue('My Override')
    await expect(page.locator('#exp-amount')).toHaveValue('30.00', { timeout: 5000 })
  })

  test('expense date picker: selecting date persists value', async ({ page }) => {
    const expenses = []
    await mockFinance(page, { expenses })
    await openFinance(page)

    await page.click('button:has-text("+ Expense")')
    await page.locator('#exp-amount').waitFor({ timeout: 5000 })
    await page.click('a:has-text("More fields")')
    await page.fill('#exp-vendor', 'Date Test')
    await page.fill('#exp-amount', '10.00')
    await page.fill('#exp-date', '2025-06-15')
    await expect(page.locator('#exp-date')).toHaveValue('2025-06-15')

    await page.click('button:has-text("Submit")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(expenses).toHaveLength(1)
    expect(expenses[0].expense_date).toBe('2025-06-15')
  })

  test('home quick-add: expense and donation appear on finance page', async ({ page }) => {
    const expenses = []
    const donations = []
    await mockFinance(page, { expenses, donations })

    await page.goto('/app/')
    await page.locator('button:has-text("+ Expense")').waitFor()

    await page.click('button:has-text("+ Expense")')
    await page.fill('#home-exp-vendor', 'Bell Canada')
    await page.selectOption('#home-exp-cat', 'utilities')
    await page.fill('#home-exp-amount', '89.50')
    await page.fill('#home-exp-date', '2025-03-01')
    await page.fill('#home-exp-desc', 'Internet service')
    await page.click('button:has-text("Submit")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 })

    await page.click('button:has-text("+ Donation")')
    await page.locator('#don-amount').waitFor({ timeout: 5000 })
    await page.fill('#don-amount', '200.00')
    await page.click('a:has-text("More fields")')
    await page.selectOption('#don-method', 'cash')
    await page.selectOption('#don-cat', 'sunday_feast')
    await page.fill('#don-date', '2025-03-01')
    await page.click('button:has-text("Save Donation")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(expenses).toHaveLength(1)
    expect(expenses[0].payee).toBe('Bell Canada')
    expect(expenses[0].amount).toBe(8950)
    expect(donations).toHaveLength(1)
    expect(donations[0].amount).toBe(20000)
    expect(donations[0].method).toBe('cash')

    await openFinance(page)
    const expRow = page.locator('table tbody tr.row-link').first()
    await expect(expRow).toContainText('Bell Canada')
    await expect(expRow).toContainText('89.50')

    await page.locator('.card-tab').filter({ hasText: 'Donations' }).click()
    const donSection = page.locator('section').nth(1)
    await donSection.locator('tr.row-link').first().waitFor()
    await expect(donSection.locator('tr.row-link').first()).toContainText('200.00')
    await expect(donSection.locator('tr.row-link').first()).toContainText('Sunday Feast')
  })


  test('edit expense with unknown category shows category and allows selection', async ({ page }) => {
    const expenses = [
      { id: 1, amount: 5000, payee: 'Old Vendor', category: 'prasadam', expense_date: '2024-03-15', status: 'submitted' },
    ]
    await mockFinance(page, { expenses })
    await openFinance(page)
    await page.locator('tr.row-link').first().waitFor()

    await page.locator('tr.row-link').first().click()
    await expect(page.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()

    const catSelect = page.locator('#exp-cat')
    const selected = await catSelect.inputValue()
    expect(selected).toBeTruthy()
    expect(selected).not.toBe('')

    await expect(async () => {
      const opts = await catSelect.locator('option').allTextContents()
      expect(opts.some(o => o.toLowerCase().includes('prasadam'))).toBe(true)
    }).toPass({ timeout: 5000 })

    await catSelect.selectOption('kitchen')
    expect(await catSelect.inputValue()).toBe('kitchen')
  })

  test('edit expense with empty category falls back to valid default', async ({ page }) => {
    const expenses = [
      { id: 1, amount: 3000, payee: 'Empty Cat Vendor', category: '', expense_date: '2024-03-11', status: 'submitted' },
    ]
    await mockFinance(page, { expenses })
    await openFinance(page)
    await page.locator('tr.row-link').first().waitFor()

    await page.locator('tr.row-link').first().click()
    await expect(page.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()

    const catSelect = page.locator('#exp-cat')
    const selected = await catSelect.inputValue()
    expect(selected).toBeTruthy()
    expect(selected).not.toBe('')
  })

  test('list view: hover card and click Edit opens modal', async ({ page }) => {
    const expenses = [{ id: 1, amount: 5000, payee: 'Costco', category: 'kitchen', expense_date: '2025-01-10', status: 'submitted' }]
    await mockFinance(page, { expenses })
    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.exp-card').first().waitFor()

    await page.locator('.exp-card').first().hover()
    const editBtn = page.locator('.exp-card-actions .btn-outline').first()
    await editBtn.click({ force: true })
    await expect(page.locator('.modal-overlay')).toBeVisible()
    await expect(page.locator('.modal')).toBeVisible()
  })

})
