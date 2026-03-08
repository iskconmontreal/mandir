import { test, expect } from '@playwright/test'
import { loginAs, API } from './fixtures.js'

function isoMonthDate(offsetMonths = 0, day = '01') {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${day}`
}

function summarizeExpenses(expenses = []) {
  const monthMap = new Map()
  for (const expense of expenses) {
    const month = expense.expense_date?.slice(0, 7)
    if (!month) continue
    const prev = monthMap.get(month) || { month, count: 0, total: 0, categories: new Map() }
    prev.count += 1
    prev.total += expense.amount || 0
    const category = expense.category || 'other'
    prev.categories.set(category, (prev.categories.get(category) || 0) + (expense.amount || 0))
    monthMap.set(month, prev)
  }
  const now = new Date()
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  return {
    exp_month: monthMap.get(curMonth)?.total || 0,
    exp_prev_month: monthMap.get(prevMonth)?.total || 0,
    donors_month: 0,
    donors_prev_month: 0,
    exp_months: [...monthMap.values()].sort((a, b) => b.month.localeCompare(a.month)).map(item => ({
      month: item.month,
      count: item.count,
      total: item.total,
      categories: [...item.categories.entries()].sort((a, b) => b[1] - a[1]).map(([category, total]) => ({ category, total })),
    })),
  }
}

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

    if (path === '/api/income' && method === 'POST') {
      const body = route.request().postDataJSON()
      const d = { id: donations.length + 1, ...body, status: 'submitted' }
      donations.push(d)
      return route.fulfill({ json: d })
    }
    if (path === '/api/income' && method === 'GET') {
      return route.fulfill({ json: { items: [...donations], total: donations.length } })
    }
    if (path.startsWith('/api/income/') && method === 'DELETE') {
      const id = +path.split('/').at(-1)
      const i = donations.findIndex(d => d.id === id)
      if (i >= 0) donations.splice(i, 1)
      return route.fulfill({ status: 204 })
    }
    if (path.startsWith('/api/income/') && method === 'PUT') {
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
      const dateFrom = url.searchParams.get('dateFrom') || ''
      const dateTo = url.searchParams.get('dateTo') || ''
      const items = expenses.filter(e => {
        const dt = e.expense_date?.slice(0, 10) || ''
        if (dateFrom && dt < dateFrom) return false
        if (dateTo && dt > dateTo) return false
        return true
      })
      return route.fulfill({ json: { items, total: items.length } })
    }

    if (path === '/api/members') return route.fulfill({ json: { items: members, total: members.length } })
    if (path === '/api/finance/summary' && method === 'GET') return route.fulfill({ json: summarizeExpenses(expenses) })
    if (path === '/api/donors/summary' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
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
  if (tab === 'donations') tab = 'income'
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

  test('shows three tabs: Expenses, Income, Donors', async ({ page }) => {
    await mockFinance(page)
    await openFinance(page)
    const tabs = page.locator('.card-tab')
    await expect(tabs).toHaveCount(3)
    await expect(tabs.nth(0).locator('.stat-label')).toHaveText('Expenses')
    await expect(tabs.nth(1).locator('.stat-label')).toHaveText('Income')
    await expect(tabs.nth(2).locator('.stat-label')).toHaveText('Donors')
  })


  test('no crash on keydown with undefined key (autofill)', async ({ page }) => {
    await mockFinance(page)
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await page.locator('#exp-amount').waitFor({ timeout: 5000 })
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

  test('add donation: fill fields → save → appears in donations list', async ({ page }) => {
    const donations = []
    await mockFinance(page, { donations })
    await openFinance(page, 'donations')

    await page.click('button:has-text("+ Income")')
    await expect(page.getByRole('heading', { name: 'Add Income' })).toBeVisible()
    await expect(page.locator('#don-type')).toBeVisible()
    await expect(page.locator('#don-type option')).toHaveCount(7)

    await page.locator('#don-amount').waitFor({ timeout: 5000 })
    await page.fill('#don-amount', '50.00')
    await page.selectOption('#don-method', 'cash')
    await page.selectOption('#don-cat', 'general')
    await page.click('button:has-text("Save")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    const donSection = page.locator('section').nth(1)
    await expect(donSection.locator('.recent-inc-item').first()).toContainText('50.00')
    await expect(donSection.locator('.recent-inc-item').first()).toContainText('General')

    expect(donations).toHaveLength(1)
    expect(donations[0].amount).toBe(5000)
    expect(donations[0].method).toBe('cash')
  })

  test('add anonymous donation (no donor) works', async ({ page }) => {
    const donations = []
    await mockFinance(page, { donations })
    await openFinance(page, 'donations')

    await page.click('button:has-text("+ Income")')
    await page.locator('#don-amount').waitFor({ timeout: 5000 })
    await page.fill('#don-amount', '25.00')
    await page.click('button:has-text("Save")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(donations[0].member_id).toBeFalsy()
  })

  test('delete donation: two-step confirm in modal (no browser dialog)', async ({ page }) => {
    const donations = [{ id: 1, amount: 5000, method: 'cash', category: 'general', date_received: '2025-01-15', note: '' }]
    await mockFinance(page, { donations })
    await openFinance(page, 'donations')

    await page.locator('section').nth(1).locator('.recent-inc-item').first().click()
    const modal = page.locator('.modal-overlay:visible').first()
    await expect(page.getByRole('heading', { name: /Edit Income/ })).toBeVisible()

    await page.click('button:has-text("Delete")')
    await expect(modal.getByRole('button', { name: 'Yes' })).toBeVisible()
    await expect(modal.getByRole('button', { name: 'No' })).toBeVisible()
    await expect(modal.getByText('Delete permanently?')).toBeVisible()

    await modal.getByRole('button', { name: 'Yes' }).click()
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })
    expect(donations).toHaveLength(0)
  })

  test('delete cancel (No) keeps record', async ({ page }) => {
    const donations = [{ id: 1, amount: 5000, method: 'cash', category: 'general', date_received: '2025-01-15', note: '' }]
    await mockFinance(page, { donations })
    await openFinance(page, 'donations')

    await page.locator('section').nth(1).locator('.recent-inc-item').first().click()
    const modal = page.locator('.modal-overlay:visible').first()
    await modal.getByRole('button', { name: 'Delete' }).click()
    await modal.getByRole('button', { name: 'No' }).click()
    await expect(modal.getByRole('button', { name: 'Delete' })).toBeVisible()
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

  test('payee field visible for treasurers in expense form', async ({ page }) => {
    await mockFinance(page)
    await openFinance(page)
    await page.click('button:has-text("+ Expense")')
    await expect(page.getByRole('heading', { name: 'Add Expense' })).toBeVisible()
    await expect(page.locator('#exp-vendor')).toBeVisible()
  })

  test('payee hidden by default for non-approvers in expense form', async ({ page }) => {
    await loginAs(page, 'member')
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
    await section.locator('.btn-filter').click()
    await section.locator('label', { hasText: 'Category' }).locator('..').locator('select').selectOption(['kitchen'])
    await section.locator('.filter-dropdown .btn-primary').click()

    await expect(section.locator('tr.row-link')).toHaveCount(1)
    await expect(section.locator('tr.row-link').first()).toContainText('Kitchen')
  })

  test('expense category filter toggles on and off', async ({ page }) => {
    const expenses = [
      { id: 1, amount: 1000, payee: 'A', category: 'kitchen', expense_date: '2025-01-01', status: 'submitted' },
      { id: 2, amount: 2000, payee: 'B', category: 'utilities', expense_date: '2025-01-02', status: 'submitted' },
    ]
    await mockFinance(page, { expenses })
    await openFinance(page)
    await page.locator('tr.row-link').first().waitFor()

    const section = page.locator('section').first()
    await section.locator('.btn-filter').click()
    const category = section.locator('label', { hasText: 'Category' }).locator('..').locator('select')
    await category.selectOption(['kitchen'])
    await section.locator('.filter-dropdown .btn-primary').click()
    await expect(section.locator('tr.row-link')).toHaveCount(1)

    await section.locator('.btn-filter').click()
    await category.evaluate(el => {
      for (const option of el.options) option.selected = false
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await section.locator('.filter-dropdown .btn-primary').click()
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
    await section.locator('label', { hasText: 'Status' }).locator('..').locator('select').selectOption('approved')
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

    await section.locator('label', { hasText: 'Status' }).locator('..').locator('select').selectOption('submitted')
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
    await section.locator('.recent-inc-item').first().waitFor()

    await section.locator('.cat-pill-seg').filter({ hasText: 'Building' }).click({ force: true })
    await expect(section.locator('.recent-inc-item')).toHaveCount(1)
  })

  test('income type filter from URL restores donation-only view and clears back to all income', async ({ page }) => {
    const donations = [
      { id: 1, type: 'donation', amount: 5000, method: 'cash', category: 'general', date_received: '2025-01-01', note: 'gift' },
      { id: 2, type: 'sale', amount: 7000, method: 'card', category: 'other', date_received: '2025-01-02', note: 'hall sale' },
    ]
    await mockFinance(page, { donations })
    await page.goto('/app/finance/?tab=income&inc_type=donation#income')

    const section = page.locator('section').nth(1)
    await section.locator('.recent-inc-item').first().waitFor()
    await expect(section.locator('.recent-inc-item')).toHaveCount(1)
    await expect(section.locator('.recent-inc-item').first()).toContainText('General')
    await expect(page).toHaveURL(/tab=income/)
    await expect(page).toHaveURL(/inc_type=donation/)

    await expect(section.locator('.chip')).toContainText([/Donation/])
    await section.locator('.chip').filter({ hasText: /Donation/ }).click()

    await expect(section.locator('.recent-inc-item')).toHaveCount(2)
    await expect(page).not.toHaveURL(/inc_type=donation/)
  })

  test('income method filter from URL restores matching view and clears back to all income', async ({ page }) => {
    const donations = [
      { id: 1, type: 'donation', amount: 5000, method: 'cash', category: 'general', date_received: '2025-01-01', note: 'gift' },
      { id: 2, type: 'sale', amount: 7000, method: 'wire', category: 'other', date_received: '2025-01-02', note: 'hall sale' },
    ]
    await mockFinance(page, { donations })
    await page.goto('/app/finance/?tab=income&inc_method=wire#income')

    const section = page.locator('section').nth(1)
    await section.locator('.recent-inc-item').first().waitFor()
    await expect(section.locator('.recent-inc-item')).toHaveCount(1)
    await expect(section.locator('.recent-inc-item').first()).toContainText(/wire/i)
    await expect(page).toHaveURL(/inc_method=wire/)

    await expect(section.locator('.chip')).toContainText([/wire/i])
    await section.locator('.chip').filter({ hasText: /wire/i }).click()

    await expect(section.locator('.recent-inc-item')).toHaveCount(2)
    await expect(page).not.toHaveURL(/inc_method=wire/)
  })

  test('income method filter hides empty methods and supports multi-select', async ({ page }) => {
    const donations = [
      { id: 1, type: 'donation', amount: 5000, method: 'cash', category: 'general', date_received: '2025-01-01', note: 'cash gift' },
      { id: 2, type: 'sale', amount: 7000, method: 'wire', category: 'other', date_received: '2025-01-02', note: 'wire sale' },
      { id: 3, type: 'grant', amount: 9000, method: 'bank-deposit', category: 'other', date_received: '2025-01-03', note: 'grant deposit' },
    ]
    await mockFinance(page, { donations })
    await openFinance(page, 'income')

    const section = page.locator('section').nth(1)
    await section.locator('.recent-inc-item').first().waitFor()
    await section.locator('.btn-filter').click()

    const typeSelect = section.locator('.filter-dropdown select').first()
    await expect(typeSelect).toBeVisible()

    const methodSelect = section.locator('.filter-dropdown .filter-multi-select')
    await expect(methodSelect).toBeVisible()
    const methodOptions = await methodSelect.locator('option').allTextContents()
    expect(methodOptions).toEqual(expect.arrayContaining(['Cash · 1', 'Wire · 1', 'Bank-Deposit · 1']))
    expect(methodOptions.some(text => /Cheque/i.test(text))).toBe(false)

    await methodSelect.selectOption(['cash', 'wire'])

    await expect(section.locator('.recent-inc-item')).toHaveCount(2)
    await expect(page).toHaveURL(/inc_method=/)
    await expect(page).toHaveURL(/cash/)
    await expect(page).toHaveURL(/wire/)
    await expect(section.locator('.filter-inline-chip')).toContainText(['Cash ×', 'Wire ×'])
  })

  test('donation search filter reduces results', async ({ page }) => {
    const donations = [
      { id: 1, amount: 5000, method: 'cash', category: 'general', date_received: '2025-01-01', note: 'sunday feast' },
      { id: 2, amount: 3000, method: 'cheque', category: 'building_fund', date_received: '2025-01-02', note: 'building' },
    ]
    await mockFinance(page, { donations })
    await openFinance(page, 'donations')
    await page.locator('section').nth(1).locator('.recent-inc-item').first().waitFor()

    await page.fill('input[placeholder="Search source or note…"]', 'sunday')

    const donSection = page.locator('section').nth(1)
    await expect(donSection.locator('.recent-inc-item')).toHaveCount(1, { timeout: 5000 })
    await expect(donSection.locator('.recent-inc-item').first()).toContainText('General')
    await expect(donSection.locator('.recent-inc-item').first()).toContainText('50.00')
  })

  test('expense filters serialize to URL and restore after reload', async ({ page }) => {
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
    await section.locator('label', { hasText: 'Status' }).locator('..').locator('select').selectOption('approved')
    await section.locator('.filter-dropdown input[type="date"]').first().fill('2025-01-03')
    await section.locator('.filter-dropdown .btn-primary').click()

    await expect(page).toHaveURL(/tab=expenses/)
    await expect(page).toHaveURL(/exp_status=approved/)
    await expect(page).toHaveURL(/exp_from=2025-01-03/)
    await expect(section.locator('tr.row-link')).toHaveCount(1)
    await expect(section.locator('tr.row-link').first()).toContainText('C')

    await page.reload()
    await page.evaluate(() => document.querySelector('.seg[title="Table view"]')?.click())
    await page.locator('tr.row-link').first().waitFor()
    await expect(section.locator('tr.row-link')).toHaveCount(1)
    await expect(section.locator('tr.row-link').first()).toContainText('C')

    await section.locator('.btn-filter').click()
    await expect(section.locator('label', { hasText: 'Status' }).locator('..').locator('select')).toHaveValue('approved')
    await expect(section.locator('.filter-dropdown input[type="date"]').first()).toHaveValue('2025-01-03')
  })

  test('expenses list groups months under sticky year rails without a year selector', async ({ page }) => {
    const curYear = String(new Date().getFullYear())
    const prevYear = String(new Date().getFullYear() - 1)
    const oldestYear = String(new Date().getFullYear() - 2)
    const expenses = [
      { id: 1, amount: 1000, payee: 'Current Year Expense', category: 'kitchen', expense_date: `${curYear}-03-01`, status: 'submitted' },
      { id: 2, amount: 1000, payee: 'Temple Supplies', category: 'kitchen', expense_date: `${prevYear}-03-01`, status: 'submitted' },
    ]
    await mockFinance(page, { expenses })
    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.finance-exp-item').first().waitFor()

    await expect(page.locator('.page-header .year-select')).toHaveCount(0)

    const section = page.locator('section').first()
    await section.locator('.btn-filter').click()
    await expect(section.locator('.filter-dropdown .year-select')).toHaveCount(0)
    await expect(section.locator('.finance-year-sticky')).toHaveText([curYear, prevYear, oldestYear])
  })

  test('income list groups months under sticky year rails and opens the first month with data', async ({ page }) => {
    const curYear = String(new Date().getFullYear())
    const prevYear = String(new Date().getFullYear() - 1)
    const oldestYear = String(new Date().getFullYear() - 2)
    const currentMonthDate = isoMonthDate(0, '05')
    const previousYearDate = isoMonthDate(-13, '06')
    const currentMonthLabel = new Date(`${currentMonthDate}T00:00:00`).toLocaleString('default', { month: 'long' })
    const previousYearMonthLabel = new Date(`${previousYearDate}T00:00:00`).toLocaleString('default', { month: 'long' })
    const donations = [
      { id: 1, amount: 5000, method: 'cash', category: 'general', date_received: currentMonthDate, source_name: 'Current Month Donor', note: '' },
      { id: 2, amount: 2500, method: 'wire', category: 'festival', date_received: previousYearDate, source_name: 'Last Year Donor', note: '' },
    ]

    await mockFinance(page, { donations })
    await openFinance(page, 'income')

    const section = page.locator('section').nth(1)
    await expect(section.locator('.recent-inc-item').filter({ hasText: 'Current Month Donor' })).toBeVisible()
    await expect(section.locator('.finance-year-sticky')).toHaveText([curYear, prevYear, oldestYear])

    const currentHeader = section.locator('.exp-group-header').filter({ hasText: currentMonthLabel }).first()
    await expect(currentHeader.locator('.exp-group-count')).toHaveText('1')
    await expect(currentHeader.locator('.exp-group-breakdown-seg')).toHaveCount(1)
    await expect(currentHeader.locator('.exp-group-breakdown-seg').first()).toHaveAttribute('title', 'General · $50.00')
    await expect(currentHeader.locator('.exp-group-total')).toHaveText('$50.00')

    const prevYearSection = section.locator('.finance-year-section').nth(1)
    await prevYearSection.locator('.exp-group-header').filter({ hasText: previousYearMonthLabel }).first().click()
    await expect(section.locator('.recent-inc-item').filter({ hasText: 'Last Year Donor' })).toBeVisible()
  })

  test('expenses list lazy-loads previous months only when expanded', async ({ page }) => {
    const currentExpenseDate = isoMonthDate(0, '05')
    const previousExpenseDate = isoMonthDate(-1, '06')
    const currentMonthStart = `${currentExpenseDate.slice(0, 7)}-01`
    const previousMonthStart = `${previousExpenseDate.slice(0, 7)}-01`
    const expenseRequests = []
    const summary = {
      exp_month: 5000,
      exp_prev_month: 3000,
      donors_month: 0,
      donors_prev_month: 0,
      exp_months: [
        { month: currentExpenseDate.slice(0, 7), count: 1, total: 5000 },
        { month: previousExpenseDate.slice(0, 7), count: 1, total: 3000 },
      ],
    }

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const method = route.request().method()
      const path = url.pathname

      if (path === '/api/expenses' && method === 'GET') {
        const dateFrom = url.searchParams.get('dateFrom')
        expenseRequests.push({ dateFrom, level: url.searchParams.get('level') })
        const items = dateFrom === currentMonthStart
          ? [{ id: 1, amount: 5000, payee: 'Current Expense', category: 'kitchen', expense_date: currentExpenseDate, status: 'submitted' }]
          : dateFrom === previousMonthStart
            ? [{ id: 2, amount: 3000, payee: 'Previous Expense', category: 'travel', expense_date: previousExpenseDate, status: 'approved' }]
            : []
        return route.fulfill({ json: { items, total: items.length } })
      }

      if (path === '/api/income' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/members' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/finance/summary' && method === 'GET') return route.fulfill({ json: summary })
      if (path === '/api/donors/summary' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (method !== 'GET') return route.fulfill({ status: 404, json: { error: 'Unexpected mutation in mock: ' + path } })
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()
    await expect(page.locator('.finance-exp-item').filter({ hasText: 'Current Expense' })).toBeVisible()
    expect(expenseRequests.filter(req => req.dateFrom === currentMonthStart)).toHaveLength(1)
    expect(expenseRequests.every(req => req.level === 'compact')).toBe(true)
    expect(expenseRequests.map(req => req.dateFrom)).not.toContain(previousMonthStart)

    await page.locator('.exp-group-header').nth(1).click()
    await expect(page.locator('.finance-exp-item').filter({ hasText: 'Previous Expense' })).toBeVisible()
    expect(expenseRequests.map(req => req.dateFrom)).toContain(previousMonthStart)
  })

  test('expense month header shows clickable category breakdown next to total', async ({ page }) => {
    const currentMonthDate = isoMonthDate(0, '05')
    const expenses = [
      { id: 1, amount: 340000, payee: 'Florist', category: 'flowers', expense_date: currentMonthDate, status: 'submitted' },
      { id: 2, amount: 120000, payee: 'Temple Store', category: 'deity', expense_date: currentMonthDate, status: 'approved' },
      { id: 3, amount: 45000, payee: 'Kitchen Goods', category: 'kitchen', expense_date: currentMonthDate, status: 'approved' },
      { id: 5, amount: 35000, payee: 'Bus Fare', category: 'travel', expense_date: currentMonthDate, status: 'approved' },
      { id: 4, amount: 15000, payee: 'More Flowers', category: 'flowers', expense_date: currentMonthDate, status: 'approved' },
    ]
    await mockFinance(page, { expenses })

    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()

    const header = page.locator('.exp-group-header').first()
    await expect(header.locator('.exp-group-count')).toHaveText('5')
    await expect(header.locator('.exp-group-breakdown-seg')).toHaveCount(3)
    await expect(header.locator('.exp-group-breakdown-seg').nth(0)).toHaveAttribute('title', 'Flowers · $3,550.00')
    await expect(header.locator('.exp-group-breakdown-seg').nth(1)).toHaveAttribute('title', 'Deity · $1,200.00')
    await expect(header.locator('.exp-group-breakdown-seg').nth(2)).toHaveAttribute('title', 'Everything else · $800.00')
    await expect(header.locator('.exp-group-total')).toHaveText('$5,550.00')

    await header.locator('.exp-group-breakdown-seg').nth(0).click()
    await expect(page.locator('.filter-inline-chip')).toContainText(['Flowers ×'])

    await header.locator('.exp-group-breakdown-seg').nth(2).click()
    await expect(page.locator('.filter-inline-chip')).toContainText(['Kitchen ×', 'Travel ×'])
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

  test('CSV export downloads from income tab', async ({ page }) => {
    await mockFinance(page, { donations: [{ id: 1, amount: 5000, method: 'cash', category: 'general', date_received: '2025-01-01', note: '' }] })
    await openFinance(page, 'donations')
    await page.locator('section').nth(1).locator('.recent-inc-item').first().waitFor()

    await page.locator('section').nth(1).locator('button:has-text("Export")').click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('section').nth(1).locator('a:has-text("CSV")').click()
    ])
    expect(download.suggestedFilename()).toBe('income.csv')
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
    await page.fill('#exp-vendor', 'Test Vendor')
    await page.fill('#exp-amount', '50.00')
    await page.click('button:has-text("Submit")')
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.toast-success')).toContainText('Expense saved')
  })

  test('save income shows success toast', async ({ page }) => {
    await mockFinance(page, { donations: [] })
    await openFinance(page, 'donations')
    await page.click('button:has-text("+ Income")')
    await page.locator('#don-amount').waitFor({ timeout: 5000 })
    await page.fill('#don-amount', '25.00')
    await page.click('button:has-text("Save")')
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.toast-success')).toContainText('Income saved')
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

    await page.fill('#exp-vendor', 'Test')
    await page.fill('#exp-amount', '10.00')
    await page.click('button:has-text("Submit")')
    await expect(page.locator('.form-warn')).toContainText('Please wait for receipt processing')

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
    await page.fill('#exp-vendor', 'Receipt Bundle')
    await page.fill('#exp-amount', '100.00')
    await page.click('button:has-text("Submit")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(savedBody.attachment_ids).toHaveLength(2)
    expect([...savedBody.attachment_ids].sort((a, b) => a - b)).toEqual([101, 102])
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
      if (path === '/api/income' && method === 'POST') {
        savedBody = route.request().postDataJSON()
        const d = { id: 1, ...savedBody, status: 'submitted' }
        donations.push(d)
        return route.fulfill({ json: d })
      }
      route.fulfill({ json: { items: [...donations], total: donations.length } })
    })

    const minJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9])
    await openFinance(page, 'donations')
    await page.click('button:has-text("+ Income")')
    await expect(page.getByRole('heading', { name: 'Add Income' })).toBeVisible()
    await page.locator('#don-receipt-input').waitFor({ state: 'attached', timeout: 5000 })

    await page.setInputFiles('#don-receipt-input', { name: 'don-receipt.jpg', mimeType: 'image/jpeg', buffer: minJpeg })
    await expect(page.locator('#don-amount')).toHaveValue('100.00', { timeout: 5000 })

    await page.click('button:has-text("Save")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(savedBody.attachment_ids).toHaveLength(1)
    expect(savedBody.attachment_ids[0]).toBe(55)
  })

  test('opening + Expense always starts fresh: no leftover receipts or form data', async ({ page }) => {
    await mockFinance(page, { expenses: [] })
    await openFinance(page)

    await page.click('button:has-text("+ Expense")')
    await page.locator('#exp-amount').waitFor({ timeout: 5000 })
    await page.fill('#exp-vendor', 'Leftover Vendor')
    await page.fill('#exp-amount', '99.00')
    await page.keyboard.press('Escape')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()

    await page.click('button:has-text("+ Expense")')
    await page.locator('#exp-amount').waitFor({ timeout: 5000 })
    await expect(page.locator('#exp-vendor')).toHaveValue('')
    await expect(page.locator('#exp-amount')).toHaveValue('')
    await expect(page.locator('.receipt-thumb')).toHaveCount(0)
    await expect(page.locator('.scan-icon')).toBeVisible()
  })

  test('editing expense keeps attachment area isolated per record', async ({ page }) => {
    const expenses = [
      {
        id: 1,
        amount: 5000,
        payee: 'Receipt Expense',
        category: 'kitchen',
        expense_date: '2025-01-10',
        status: 'submitted',
        attachments: [
          { id: 91, file_path: 'uploads/finance/2026/receipt-1.png', original_name: 'receipt-1.png', mime_type: 'image/png' },
        ],
      },
      {
        id: 2,
        amount: 3000,
        payee: 'Plain Expense',
        category: 'utilities',
        expense_date: '2025-01-11',
        status: 'submitted',
        attachments: [],
      },
    ]

    await mockFinance(page, { expenses })
    await openFinance(page)
    await page.locator('tr.row-link').first().waitFor()

    await page.locator('tr.row-link').filter({ hasText: 'Receipt Expense' }).click()
    const firstEdit = page.locator('.modal-overlay:visible').first()
    await expect(firstEdit.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(firstEdit.getByText('Receipts')).toBeVisible()
    await expect(firstEdit.locator('.receipt-thumb')).toHaveCount(1)

    await page.click('button:has-text("Cancel")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()

    await page.locator('tr.row-link').filter({ hasText: 'Plain Expense' }).click()
    const secondEdit = page.locator('.modal-overlay:visible').first()
    await expect(secondEdit.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(secondEdit.getByText('Receipts')).toHaveCount(0)
    await expect(secondEdit.locator('.receipt-thumb')).toHaveCount(0)
    await expect(page.locator('.lightbox')).not.toBeVisible()

    await page.click('button:has-text("Cancel")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()

    await page.locator('tr.row-link').filter({ hasText: 'Receipt Expense' }).click()
    const reopenedFirstEdit = page.locator('.modal-overlay:visible').first()
    await expect(reopenedFirstEdit.getByText('Receipts')).toBeVisible()
    await expect(reopenedFirstEdit.locator('.receipt-thumb')).toHaveCount(1)
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
    await page.fill('#exp-vendor', 'Test')
    await page.click('button:has-text("Cancel")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()

    await page.click('button:has-text("+ Expense")')
    await page.locator('#exp-amount').waitFor({ timeout: 5000 })
    await expect(page.locator('#exp-vendor')).toHaveValue('')
  })

  test('update submitted expense: edit fields and save', async ({ page }) => {
    await loginAs(page, 'member')
    let updatedBody = null
    const expenses = [{ id: 1, amount: 5000, payee: 'Old Vendor', category: 'kitchen', expense_date: '2025-01-10', status: 'submitted' }]
    await mockFinance(page, { expenses })
    await page.route(`${API}/api/expenses/1`, async route => {
      if (route.request().method() !== 'PUT') return route.fallback()
      updatedBody = route.request().postDataJSON()
      expenses[0] = { ...expenses[0], ...updatedBody }
      return route.fulfill({ json: expenses[0] })
    })
    await openFinance(page)
    await page.locator('tr.row-link').first().waitFor()

    await page.locator('tr.row-link').first().click()
    const amount = page.locator('#exp-amount:visible')
    await amount.waitFor({ timeout: 5000 })
    await amount.evaluate((el, v) => {
      el.value = v
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }, '75.00')
    await expect(amount).toHaveValue('75')
    await page.click('button:has-text("Update")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(updatedBody?.amount).toBe(7500)
    expect(expenses[0].amount).toBe(7500)
  })

  test('edit donation: donor suggestions stay visible in modal', async ({ page }) => {
    const members = [
      { id: 1, user_id: 11, data: { name: 'Hari Das' } },
      { id: 2, user_id: 12, data: { name: 'Gopi Devi' } },
    ]
    const donations = [{ id: 1, member_id: 1, source_name: 'Hari Das', amount: 5000, method: 'cash', category: 'general', date_received: '2025-01-15', note: '' }]
    await mockFinance(page, { donations, members })
    await openFinance(page, 'income')

    await page.locator('section').nth(1).locator('.recent-inc-item').first().click()
    await expect(page.getByRole('heading', { name: /Edit Income/ })).toBeVisible()
    await page.locator('#don-donor').focus()

    const list = page.locator('.autocomplete-list').filter({ has: page.locator('.autocomplete-item') }).first()
    await expect(list).toBeVisible()
    await expect(list).toContainText('Hari Das')
  })

  test('edit income modal shows id and history in one place', async ({ page }) => {
    const members = [{ id: 1, user_id: 11, data: { name: 'Hari Das' } }]
    const donations = [{ id: 1, member_id: 1, source_name: 'Hari Das', amount: 5000, method: 'wire', type: 'sale', date_received: '2025-01-15', note: 'invoice paid', updated_at: '2025-01-16T10:00:00Z', updated_by: 11 }]
    const auditLogs = [{ id: 1, entity_id: 1, entity_type: 'income', user_id: 11, action: 'update', diff: JSON.stringify({ note: 'invoice paid' }), created_at: '2025-01-16T10:00:00Z' }]
    await mockFinance(page, { donations, members, auditLogs })
    await openFinance(page, 'income')

    await page.locator('section').nth(1).locator('.recent-inc-item').first().click()
    await expect(page.getByRole('heading', { name: /Edit Income/ })).toBeVisible()
    await expect(page.locator('.modal')).toContainText('#1')
    await expect(page.locator('.modal')).toContainText('History')
    await expect(page.locator('.modal')).toContainText('Updated')
    await expect(page.locator('#don-note')).toHaveValue('invoice paid')
  })

  test('edit expense: member payee stays populated in modal', async ({ page }) => {
    const members = [
      { id: 1, user_id: 11, data: { name: 'Hari Das' } },
      { id: 2, user_id: 12, data: { name: 'Gopi Devi' } },
    ]
    const expenses = [
      { id: 1, member_id: 1, amount: 5000, payee: 'Hari Das', category: 'kitchen', expense_date: '2025-01-10', status: 'submitted' },
      { id: 2, amount: 3000, payee: 'Hydro Quebec', category: 'utilities', expense_date: '2025-01-09', status: 'submitted' },
    ]
    await mockFinance(page, { expenses, members })
    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.finance-exp-item').first().click()

    const payee = page.locator('#exp-vendor:visible')
    await expect(payee).toHaveValue('Hari Das')
  })

  test('edit expense: custom payee persists on reopen while still editable', async ({ page }) => {
    const members = [{ id: 1, user_id: 11, data: { name: 'Admin' } }]
    const expenses = [
      { id: 1, member_id: 1, amount: 5000, payee: 'Nani Gopal', category: 'kitchen', expense_date: '2025-01-10', status: 'submitted', created_at: '2025-01-10T09:00:00Z', updated_at: '2025-01-10T09:00:00Z' },
    ]
    const updatedPayee = 'Nani Gopal Prabhu'
    await mockFinance(page, { expenses, members })
    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.finance-exp-item').first().click()

    const payee = page.locator('#exp-vendor:visible')
    await expect(payee).toHaveValue('Nani Gopal')

    await payee.fill(updatedPayee)
    await expect(payee).toHaveValue(updatedPayee)
    await page.getByRole('button', { name: 'Update' }).click()
    await expect(page.locator('.toast-success').filter({ hasText: 'Expense updated' })).toBeVisible({ timeout: 5000 })
    expect(expenses[0].payee).toBe(updatedPayee)
    expect(expenses[0].member_id).toBeNull()

    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.finance-exp-item').first().click()
    await expect(page.locator('#exp-vendor:visible')).toHaveValue(updatedPayee)
  })

  test('list view: editing opened older month refreshes that month row', async ({ page }) => {
    const currentMonthDate = isoMonthDate(0, '10')
    const previousMonthDate = isoMonthDate(-1, '12')
    const expenses = [
      { id: 1, amount: 5000, payee: 'Current Expense', category: 'kitchen', expense_date: currentMonthDate, status: 'submitted' },
      { id: 2, amount: 3000, payee: 'Old Vendor', category: 'utilities', expense_date: previousMonthDate, status: 'submitted' },
    ]
    await mockFinance(page, { expenses })
    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()

    const headers = page.locator('.exp-group-header')
    await headers.nth(1).click()

    const previousRow = page.locator('.finance-exp-item').filter({ hasText: 'Old Vendor' })
    await previousRow.click()
    await page.locator('#exp-vendor:visible').fill('Updated Vendor')
    await page.selectOption('#exp-cat:visible', 'travel')
    await page.getByRole('button', { name: 'Update' }).click()
    await expect(page.locator('.toast-success').filter({ hasText: 'Expense updated' })).toBeVisible({ timeout: 5000 })

    const updatedRow = page.locator('.finance-exp-item').filter({ hasText: 'Updated Vendor' })
    await expect(updatedRow).toBeVisible()
    await expect(updatedRow.locator('.badge')).toHaveText('Travel')
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
    await expect(row2.locator('.btn-quick-pay')).toHaveText('Paid')

    await row1.locator('.btn-quick-approve').click({ force: true })
    await expect(page.locator('.toast-success').first()).toBeVisible({ timeout: 5000 })
    expect(expenses[0].status).toBe('approved')

    await row2.locator('.btn-quick-pay').click({ force: true })
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

    await btn.click({ force: true })
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
    await btn.click({ force: true })

    await expect(page.locator('.toast-success')).toContainText('Approval recorded', { timeout: 5000 })
    await expect(page.locator('.btn-quick-approve')).toHaveCount(0)
    await expect(page.locator('.quick-actions .dim')).toContainText('✓')
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
    await page.fill('#exp-vendor', 'Date Test')
    await page.fill('#exp-amount', '10.00')
    await page.fill('#exp-date', '2025-06-15')
    await expect(page.locator('#exp-date')).toHaveValue('2025-06-15')

    await page.click('button:has-text("Submit")')
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5000 })

    expect(expenses).toHaveLength(1)
    expect(expenses[0].expense_date).toBe('2025-06-15')
  })

  test('home quick-add: expense and income appear on finance page', async ({ page }) => {
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
    await page.selectOption('#don-method', 'cash')
    await page.selectOption('#don-cat', 'sunday_feast')
    await page.fill('#don-date', '2025-03-01')
    await page.click('button:has-text("Save")')
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

    await page.locator('.card-tab').filter({ hasText: 'Income' }).click()
    const donSection = page.locator('section').nth(1)
    await donSection.locator('.recent-inc-item').first().waitFor()
    await expect(donSection.locator('.recent-inc-item').first()).toContainText('200.00')
    await expect(donSection.locator('.recent-inc-item').first()).toContainText('Sunday Feast')
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

  test('list view: hover card shows approve and reject quick actions', async ({ page }) => {
    const expenses = [{ id: 1, amount: 5000, payee: 'Costco', category: 'kitchen', expense_date: isoMonthDate(0, '10'), status: 'submitted' }]
    await mockFinance(page, { expenses })
    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.finance-exp-item').first().waitFor()

    await page.locator('.finance-exp-item').first().hover()
    await expect(page.locator('.finance-exp-item').first().locator('[aria-label="Quick approve expense"]')).toBeVisible()
    await expect(page.locator('.finance-exp-item').first().locator('[aria-label="Quick reject expense"]')).toBeVisible()
  })

  test('list view: clicking expense row opens same edit modal as quick action', async ({ page }) => {
    const expenses = [{ id: 1, amount: 5000, payee: 'Costco', category: 'kitchen', expense_date: isoMonthDate(0, '10'), status: 'submitted' }]
    await mockFinance(page, { expenses })
    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.finance-exp-item').first().click()

    await expect(page.locator('.modal-overlay')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(page.locator('#exp-vendor')).toHaveValue('Costco')
    await expect(page.locator('#exp-vendor')).toBeEnabled()
  })

  test('list view: quick actions update expense row inside month section', async ({ page }) => {
    const currentMonthDate = isoMonthDate(0, '10')
    const expenses = [
      { id: 1, amount: 5000, payee: 'Costco', category: 'kitchen', expense_date: currentMonthDate, status: 'submitted', approval_count: 0, approvals_required: 1 },
    ]
    await mockFinance(page, { expenses })
    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()

    const row = page.locator('.finance-exp-item').first()
    await row.hover()
    await row.locator('[aria-label="Quick approve expense"]').click()
    await expect(row.locator('.recent-exp-status-text')).toHaveText('Approved')

    await row.hover()
    await row.locator('[aria-label="Quick pay expense"]').click()
    await expect(row.locator('.recent-exp-status-text')).toHaveText('Paid')
  })

  test('list view: expenses within month are ordered by status then latest update', async ({ page }) => {
    const expDate = isoMonthDate(0, '03')
    const expenses = [
      { id: 1, amount: 5000, payee: 'Submitted New', category: 'kitchen', expense_date: expDate, status: 'submitted', created_at: `${expDate}T09:00:00Z`, updated_at: `${expDate.slice(0, 8)}05T10:00:00Z` },
      { id: 2, amount: 4000, payee: 'Approved New', category: 'travel', expense_date: expDate, status: 'approved', created_at: `${expDate}T09:00:00Z`, updated_at: `${expDate.slice(0, 8)}06T10:00:00Z` },
      { id: 3, amount: 3000, payee: 'Submitted Old', category: 'rent', expense_date: expDate, status: 'submitted', created_at: `${expDate}T09:00:00Z`, updated_at: `${expDate.slice(0, 8)}04T10:00:00Z` },
      { id: 4, amount: 2000, payee: 'Paid New', category: 'utilities', expense_date: expDate, status: 'paid', created_at: `${expDate}T09:00:00Z`, updated_at: `${expDate.slice(0, 8)}07T10:00:00Z` },
    ]
    await mockFinance(page, { expenses })
    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.finance-exp-item').first().waitFor()

    await expect(page.locator('.finance-exp-item .recent-exp-title')).toHaveText([
      'Submitted New',
      'Submitted Old',
      'Approved New',
      'Paid New',
    ])
  })

  test('list view: expense months are collapsible', async ({ page }) => {
    const currentMonthDate = isoMonthDate(0, '03')
    const previousMonthDate = isoMonthDate(-1, '10')
    const expenses = [
      { id: 1, amount: 5000, payee: 'Current Expense', category: 'kitchen', expense_date: currentMonthDate, status: 'submitted' },
      { id: 2, amount: 3000, payee: 'Previous Expense', category: 'travel', expense_date: previousMonthDate, status: 'approved' },
    ]
    await mockFinance(page, { expenses })
    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.finance-exp-item').first().waitFor()

    const headers = page.locator('.exp-group-header')
    const current = page.locator('.finance-exp-item').filter({ hasText: 'Current Expense' })
    const previous = page.locator('.finance-exp-item').filter({ hasText: 'Previous Expense' })
    await expect(headers.first()).toContainText(new Date(currentMonthDate).toLocaleString('default', { month: 'long' }))
    await expect(current).toBeVisible()
    await expect(previous).toBeHidden()

    await headers.nth(1).click()
    await expect(previous).toBeVisible()

    await headers.nth(0).click()
    await expect(current).toBeHidden()

    await headers.nth(0).click()
    await expect(current).toBeVisible()

    await headers.nth(1).click()
    await expect(previous).toBeHidden()

    await headers.nth(1).click()
    await expect(previous).toBeVisible()
  })

  test('list view: expense search highlights matching title text', async ({ page }) => {
    const expenses = [
      { id: 1, amount: 5000, payee: 'Hydro Quebec', category: 'utilities', expense_date: isoMonthDate(0, '10'), status: 'submitted' },
      { id: 2, amount: 2500, payee: 'Temple Flowers', category: 'deities', expense_date: isoMonthDate(0, '12'), status: 'approved' },
    ]
    await mockFinance(page, { expenses })
    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.finance-exp-item').first().waitFor()

    await page.locator('section').first().locator('.filter-search-input').fill('Hydro')

    const hits = page.locator('.finance-exp-item .recent-exp-title .hl-hit')
    await expect(hits).toHaveText(['Hydro'])
    await expect(page.locator('.finance-exp-item')).toHaveCount(1)
    await expect(page.locator('.finance-exp-item').first()).toContainText('Hydro Quebec')
  })

  test('submitted expense edit shows single note label and status actions in history', async ({ page }) => {
    const expenses = [{ id: 1, amount: 5000, payee: 'Parking Corp', category: 'travel', expense_date: '2025-03-03', expense_no: 'E-2026-0109', status: 'submitted', created_at: '2025-03-03T10:00:00Z', updated_at: '2025-03-03T10:00:00Z', created_by: 1 }]
    await mockFinance(page, { expenses })
    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.finance-exp-item').first().click()
    const modal = page.locator('.modal-overlay:visible').first()

    await expect(modal.getByRole('heading', { name: 'Edit Expense #E-2026-0109' })).toBeVisible()
    await expect(page.locator('.finance-exp-item').first().getByText('Parking Corp')).toBeVisible()
    await expect(page.locator('.finance-exp-item').first().getByText('#E-2026-0109')).toBeVisible()
    await expect(modal.locator('label', { hasText: 'Note' })).toHaveCount(1)
    await expect(modal.locator('label', { hasText: 'Decision' })).toHaveCount(0)
    await expect(modal.getByRole('button', { name: 'Approve', exact: true })).toBeVisible()
    await expect(modal.getByRole('button', { name: 'Reject', exact: true })).toBeVisible()
  })

  test('rejected expense keeps amount visible on hover when no quick actions exist', async ({ page }) => {
    const expenses = [{ id: 1, amount: 5000, payee: 'Closed Expense', category: 'travel', expense_date: '2025-03-03', status: 'rejected' }]
    await mockFinance(page, { expenses })
    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()

    const row = page.locator('.finance-exp-item').first()
    await row.hover()

    await expect(row.locator('.recent-row-action')).toHaveCount(0)
    await expect(row.locator('.recent-exp-value')).toHaveCSS('opacity', '1')
  })

  test('reject opens reason composer and history shows reject note and paid reference', async ({ page }) => {
    const expense = { id: 1, amount: 5000, payee: 'Parking Corp', category: 'travel', expense_date: '2025-03-03', expense_no: 'E-2026-0109', status: 'submitted', created_at: '2025-03-03T10:00:00Z', updated_at: '2025-03-03T10:00:00Z', created_by: 1 }
    const members = [{ id: 101, user_id: 9, data: { name: 'Admin' } }]
    const approvals = [
      { action: 'reject', note: 'Missing receipt', approved_by: 9, created_at: '2025-03-04T10:00:00Z' },
      { action: 'pay', reference: 'ETF-001', approved_by: 9, created_at: '2025-03-05T10:00:00Z' },
    ]

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()

      if (path === '/api/expenses' && method === 'GET') return route.fulfill({ json: { items: [expense], total: 1 } })
      if (path === '/api/expenses/1' && method === 'GET') return route.fulfill({ json: expense })
      if (path === '/api/expenses/1/approvals' && method === 'GET') return route.fulfill({ json: approvals })
      if (path === '/api/members' && method === 'GET') return route.fulfill({ json: { items: members, total: members.length } })
      if (path === '/api/income' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/finance/summary' && method === 'GET') return route.fulfill({ json: { exp_month: 5000, exp_prev_month: 0, donors_month: 0, donors_prev_month: 0, exp_months: [{ month: expense.expense_date.slice(0, 7), count: 1, total: expense.amount }] } })
      if (path === '/api/expenses/1/reject' && method === 'POST') {
        expense.status = 'rejected'
        return route.fulfill({ json: { ...expense, updated_by: 9 } })
      }
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/finance/#expenses')
    await page.locator('.card-tab-group').waitFor()
    await page.locator('.finance-exp-item').first().click()

    const modal = page.locator('.modal-overlay:visible').first()
    await expect(modal.getByText('Missing receipt')).toBeVisible()
    await expect(modal.getByText('Ref ETF-001')).toBeVisible()
    await expect(modal.getByText('Paid')).toBeVisible()

    await expect(modal.locator('label', { hasText: 'Reason' })).toHaveCount(0)
    await modal.getByRole('button', { name: 'Reject', exact: true }).click()
    await expect(modal.locator('label', { hasText: 'Reason' })).toHaveCount(1)
    await expect(modal.getByRole('button', { name: 'Send reject' })).toBeVisible()
  })

})
