import { test, expect } from '@playwright/test'
import { loginAs, API } from './fixtures.js'

test.describe('overview page (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'treasurer')
    await page.route(`${API}/**`, route => route.fulfill({ json: { items: [], total: 0 } }))
    await page.goto('/app/')
  })

  test('renders finance pulse card', async ({ page }) => {
    await expect(page.locator('h3').filter({ hasText: 'Finance' })).toBeVisible()
  })

  test('renders members pulse card', async ({ page }) => {
    await expect(page.locator('h3').filter({ hasText: 'Community' })).toBeVisible()
  })

  test('renders quick links for finance and members', async ({ page }) => {
    await expect(page.locator('a[href="finance/"]')).toBeVisible()
    await expect(page.locator('a[href="members/"]')).toBeVisible()
  })

  test('finance shortcuts point to the expected tabs and filters', async ({ page }) => {
    await expect(page.locator('.recent-grid .card').nth(0).locator('.section-head-link')).toHaveAttribute('href', 'finance/?tab=expenses#expenses')
    await expect(page.locator('.recent-grid .card').nth(1).locator('.section-head-link')).toHaveAttribute('href', 'finance/?tab=income&inc_type=donation#income')
  })
})

test.describe('progress bar', () => {
  test('progress bar reaches done state after load', async ({ page }) => {
    await loginAs(page, 'viewer')
    await page.route(`${API}/**`, route => route.fulfill({ json: { items: [], total: 0 } }))
    await page.goto('/app/')
    await expect(page.locator('.progress')).toHaveClass(/done/)
  })
})

test.describe('overview donations', () => {
  test('overview renders recent expenses and donations', async ({ page }) => {
    await loginAs(page, 'treasurer')

    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const recentTime = new Date(now - 3600000).toISOString() // 1 hour ago — always in past
    const expenses = [
      { id: 1, amount: 4200, payee: 'Govindas Supplies', category: 'kitchen', expense_date: today, created_at: recentTime, status: 'submitted', approval_count: 0, approvals_required: 1, created_by: 2 },
    ]
    const incomes = [
      { id: 7, type: 'donation', amount: 8800, method: 'card', category: 'festival', date_received: today, created_at: recentTime, updated_at: recentTime, created_by: 2, source_name: 'Sunday Guest' },
    ]

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()

      if (path === '/api/income' && method === 'GET') return route.fulfill({ json: { items: incomes, total: incomes.length } })
      if (path === '/api/expenses' && method === 'GET') return route.fulfill({ json: { items: expenses, total: expenses.length } })
      if (path === '/api/members' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/expenses' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/donations/summary' && method === 'GET') return route.fulfill({ json: { total: 8800, count: 1, by_category: { festival: 8800 } } })
      if (path === '/api/me/tax-receipts' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/finance/summary' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/audit' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/')

    const expenseRow = page.locator('.recent-exp-item').first()
    await expect(expenseRow).toContainText('Govindas Supplies')
    await expect(expenseRow).toContainText('$42.00')

    const donationRow = page.locator('.recent-inc-item').first()
    await expect(donationRow).toContainText('Sunday Guest')
    await expect(donationRow.locator('.recent-inc-subtitle')).toHaveText(/card\s+.+ago/i)
  })

  test('recent approved expense shows last updater name', async ({ page }) => {
    await loginAs(page, 'treasurer')

    const now = new Date().toISOString()
    const expenses = [
      { id: 1, amount: 4200, payee: 'Govindas Supplies', category: 'kitchen', expense_date: now.slice(0, 10), created_at: now, updated_at: now, status: 'approved', created_by: 2, updated_by: 9 },
    ]
    const members = [
      { id: 101, user_id: 9, data: { name: 'Madhava Prabhu' } },
    ]

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()

      if (path === '/api/income' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/expenses' && method === 'GET') return route.fulfill({ json: { items: expenses, total: expenses.length } })
      if (path === '/api/members' && method === 'GET') return route.fulfill({ json: { items: members, total: members.length } })
      if (path === '/api/me/expenses' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/donations/summary' && method === 'GET') return route.fulfill({ json: { total: 0, count: 0, by_category: {} } })
      if (path === '/api/me/tax-receipts' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/finance/summary' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/')

    const expenseRow = page.locator('.recent-exp-item').first()
    await expect(expenseRow.locator('.recent-exp-title')).toContainText('Govindas Supplies')
    await expect(expenseRow).toContainText('Approved')
    await expect(expenseRow).toContainText('by Madhava Prabhu')
  })

  test('recent overview expense keeps visible title', async ({ page }) => {
    await loginAs(page, 'treasurer')

    const today = new Date().toISOString().slice(0, 10)
    const expenses = [
      { id: 1, amount: 4200, payee: 'Govindas Supplies', category: 'kitchen', expense_date: today, created_at: `${today}T10:00:00Z`, status: 'submitted', approval_count: 0, approvals_required: 1, created_by: 2 },
    ]

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()

      if (path === '/api/income' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/expenses' && method === 'GET') return route.fulfill({ json: { items: expenses, total: expenses.length } })
      if (path === '/api/members' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/expenses' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/donations/summary' && method === 'GET') return route.fulfill({ json: { total: 0, count: 0, by_category: {} } })
      if (path === '/api/me/tax-receipts' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/finance/summary' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/audit' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/')

    await expect(page.locator('.recent-exp-item .recent-exp-title')).toContainText('Govindas Supplies')
  })

  test('can add, inspect, cancel edit, and update a donation from overview', async ({ page }) => {
    await loginAs(page, 'treasurer')

    let nextIncomeId = 1
    let nextAttachmentId = 1
    const today = new Date().toISOString().slice(0, 10)
    const members = [
      { id: 11, user_id: 11, data: { name: 'Radhika Dasi' } },
      { id: 12, user_id: 12, data: { name: 'Madhava Prabhu' } },
    ]
    const incomes = []

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()

      if (path === '/api/members' && method === 'GET') {
        return route.fulfill({ json: { items: members, total: members.length } })
      }

      if (path === '/api/expenses' && method === 'GET') {
        return route.fulfill({ json: { items: [], total: 0 } })
      }

      if (path === '/api/me/expenses' && method === 'GET') {
        return route.fulfill({ json: { items: [], total: 0 } })
      }

      if (path === '/api/me/donations/summary' && method === 'GET') {
        return route.fulfill({ json: { total: 0, count: 0, by_category: {} } })
      }

      if (path === '/api/me/tax-receipts' && method === 'GET') {
        return route.fulfill({ json: { items: [], total: 0 } })
      }

      if (path === '/api/documents/upload' && method === 'POST') {
        const attachment = {
          id: nextAttachmentId++,
          file_path: `uploads/finance/2026/mock-${nextAttachmentId}.png`,
          original_name: 'donation.png',
          mime_type: 'image/png',
          file_size: 128,
          parent_type: '',
        }
        return route.fulfill({ json: { attachment, extracted_data: {} } })
      }

      if (path === '/api/income' && method === 'POST') {
        const body = route.request().postDataJSON()
        const created = {
          id: nextIncomeId++,
          type: body.type || 'donation',
          amount: body.amount,
          method: body.method || 'cash',
          category: body.category || 'general',
          date_received: body.date_received || today,
          note: body.note || '',
          member_id: body.member_id || null,
          source_name: body.source_name || '',
          created_at: `${today}T12:00:00Z`,
          updated_at: `${today}T12:00:00Z`,
          created_by: 2,
          updated_by: 2,
          attachments: (body.attachment_ids || []).map(id => ({ id, file_path: `uploads/finance/2026/mock-${id}.png`, parent_type: 'income' })),
        }
        incomes.unshift(created)
        return route.fulfill({ status: 201, json: created })
      }

      if (path.startsWith('/api/income/') && method === 'PUT') {
        const id = Number(path.split('/').pop())
        const body = route.request().postDataJSON()
        const row = incomes.find(x => x.id === id)
        Object.assign(row, {
          ...body,
          type: body.type || row.type,
          member_id: Object.prototype.hasOwnProperty.call(body, 'member_id') ? body.member_id : row.member_id,
          updated_at: `${today}T13:00:00Z`,
          updated_by: 2,
        })
        return route.fulfill({ json: row })
      }

      if (path.startsWith('/api/income/') && method === 'GET') {
        const id = Number(path.split('/').pop())
        const row = incomes.find(x => x.id === id)
        return route.fulfill({ json: row })
      }

      if (path === '/api/income' && method === 'GET') {
        const items = incomes.slice()
        return route.fulfill({ json: { items, total: items.length } })
      }

      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/')

    await page.getByRole('button', { name: '+ Donation' }).click()
    await expect(page.locator('.modal')).toBeVisible()

    const donor = page.locator('#don-donor')
    await donor.fill('Radh')
    await page.locator('.autocomplete-item', { hasText: 'Radhika Dasi' }).click()

    const amount = page.locator('#don-amount')
    await amount.click()
    await amount.pressSequentially('100.5')
    await expect(amount).toHaveValue('100.5')

    await expect(page.locator('#don-method option')).toHaveCount(9)
    await page.selectOption('#don-method', 'e-transfer')

    await expect(page.locator('#don-cat option')).toHaveCount(9)
    await page.selectOption('#don-cat', 'festival')

    await expect(page.locator('#don-date')).toHaveValue(today)

    const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    await page.locator('#don-receipt-input').setInputFiles({
      name: 'donation.png',
      mimeType: 'image/png',
      buffer: pngBytes,
    })
    await expect(page.locator('.attach-badge')).toContainText('donation.png')

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('.modal')).toBeHidden()

    const donationRow = page.locator('.recent-inc-item').first()
    await expect(donationRow).toContainText('Radhika Dasi')
    await expect(donationRow).toContainText('+$100.50')

    await donationRow.click()
    await expect(page.locator('.modal')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible()
    await expect(page.locator('#don-donor')).toHaveValue('Radhika Dasi')
    await expect(page.locator('#don-amount')).toHaveValue('100.50')
    await expect(page.locator('#don-method')).toHaveValue('e-transfer')
    await expect(page.locator('#don-cat')).toHaveValue('festival')
    await expect(page.locator('#don-date')).toHaveValue(today)

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.modal')).toBeHidden()

    await donationRow.click()
    await page.locator('.autocomplete .btn-link').click()
    await donor.fill('Temple Walk-in')
    await page.locator('.modal-overlay:visible').first().getByRole('button', { name: 'Update' }).click()
    await expect(page.locator('.modal')).toBeHidden()

    await expect(page.locator('.recent-inc-item').first()).toContainText('Temple Walk-in')
  })

  test('recent paid expense quick edit locks restricted fields and stays clean on reopen', async ({ page }) => {
    await loginAs(page, 'treasurer')

    const today = new Date().toISOString().slice(0, 10)
    const expenses = [
      { id: 1, amount: 4200, payee: 'Govindas Supplies', category: 'utilities', expense_date: today, created_at: `${today}T10:00:00Z`, updated_at: `${today}T11:00:00Z`, status: 'paid', created_by: 2 },
    ]

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()

      if (path === '/api/income' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/expenses' && method === 'GET') return route.fulfill({ json: { items: expenses, total: expenses.length } })
      if (path === '/api/expenses/1' && method === 'GET') return route.fulfill({ json: expenses[0] })
      if (path === '/api/expenses/1/approvals' && method === 'GET') return route.fulfill({ json: [] })
      if (path === '/api/members' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/expenses' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/donations/summary' && method === 'GET') return route.fulfill({ json: { total: 0, count: 0, by_category: {} } })
      if (path === '/api/me/tax-receipts' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/finance/summary' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/')

    const expenseRow = page.locator('.recent-exp-item').first()
    await expenseRow.click()

    await expect(page.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(page.locator('#exp-vendor')).toBeDisabled()
    await expect(page.locator('#exp-cat')).toHaveValue('utilities')
    await expect(page.locator('.exp-items-table tbody input[type="number"]').first()).toBeDisabled()
    await expect(page.locator('#exp-date')).toBeDisabled()
    await expect(page.locator('#exp-cat')).toBeEnabled()
    await expect(page.locator('#exp-desc')).toBeEnabled()

    const activeModal = page.locator('.modal-overlay:visible').first()
    await activeModal.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.modal-overlay')).toBeHidden()

    await expenseRow.click()

    const reopenedModal = page.locator('.modal-overlay:visible').first()
    await expect(reopenedModal.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(reopenedModal.locator('#exp-vendor')).toBeDisabled()
    await expect(reopenedModal.locator('#exp-date')).toBeDisabled()
    await expect(reopenedModal.locator('.exp-items-table tbody input[type="number"]').first()).toBeDisabled()
    await expect(reopenedModal.locator('#exp-cat')).toBeEnabled()
    await expect(reopenedModal.locator('#exp-desc')).toBeEnabled()
  })

  test('overview expense add clears receipt loader after save and reopen', async ({ page }) => {
    await loginAs(page, 'treasurer')

    let nextExpenseId = 1
    let nextAttachmentId = 1
    const today = new Date().toISOString().slice(0, 10)
    const expenses = []

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()

      if (path === '/api/income' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/members' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/expenses' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/donations/summary' && method === 'GET') return route.fulfill({ json: { total: 0, count: 0, by_category: {} } })
      if (path === '/api/me/tax-receipts' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/finance/summary' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/documents/upload' && method === 'POST') {
        const id = nextAttachmentId++
        return route.fulfill({ json: {
          extracted_data: { amount: '18.25', vendor: 'Receipt Shop', date: today },
          attachment: { id, file_path: `uploads/finance/2026/mock-${id}.png`, original_name: 'receipt.png', mime_type: 'image/png', file_size: 128, intent: 'expense' },
        } })
      }
      if (path === '/api/expenses' && method === 'POST') {
        const body = route.request().postDataJSON()
        const created = {
          id: nextExpenseId++,
          amount: body.amount,
          payee: body.payee || '',
          category: body.category || 'other',
          expense_date: body.expense_date || today,
          created_at: `${today}T12:00:00Z`,
          updated_at: `${today}T12:00:00Z`,
          status: 'submitted',
          created_by: 2,
          approval_count: 0,
          approvals_required: 1,
        }
        expenses.unshift(created)
        return route.fulfill({ status: 201, json: created })
      }
      if (path === '/api/expenses' && method === 'GET') return route.fulfill({ json: { items: expenses, total: expenses.length } })
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/')

    const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

    await page.getByRole('button', { name: '+ Expense' }).click()
    await page.locator('#exp-receipt-input').setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: pngBytes,
    })
    await expect(page.locator('.receipt-thumb')).toHaveCount(1)
    await expect(page.locator('.receipt-add')).toHaveCount(1)
    await expect(page.locator('#exp-vendor')).toHaveValue('Receipt Shop')
    await expect(page.locator('#exp-amount')).toHaveValue('18.25')
    await page.selectOption('#exp-cat', 'utilities')

    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 5000 })

    await page.getByRole('button', { name: '+ Expense' }).click()
    const reopenedModal = page.locator('.modal-overlay:visible').first()
    await expect(reopenedModal.getByText('Attach documents')).toBeVisible()
    await expect(reopenedModal.locator('.receipt-thumb')).toHaveCount(0)
    await expect(reopenedModal.locator('.receipt-add:not(.hidden)')).toHaveCount(0)
  })

  test('recent paid expense quick edit preserves edited category and reopens with populated form', async ({ page }) => {
    await loginAs(page, 'treasurer')

    const today = new Date().toISOString().slice(0, 10)
    const expenses = [
      { id: 1, amount: 4200, payee: 'Govindas Supplies', category: 'utilities', expense_date: today, created_at: `${today}T10:00:00Z`, updated_at: `${today}T11:00:00Z`, status: 'paid', created_by: 2 },
    ]

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()

      if (path === '/api/income' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/expenses' && method === 'GET') return route.fulfill({ json: { items: expenses, total: expenses.length } })
      if (path === '/api/expenses/1' && method === 'GET') return route.fulfill({ json: expenses[0] })
      if (path === '/api/expenses/1' && method === 'PUT') {
        const body = route.request().postDataJSON()
        expenses[0] = {
          ...expenses[0],
          ...body,
          updated_at: `${today}T12:00:00Z`,
        }
        return route.fulfill({ json: expenses[0] })
      }
      if (path === '/api/expenses/1/approvals' && method === 'GET') return route.fulfill({ json: [] })
      if (path === '/api/members' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/expenses' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/donations/summary' && method === 'GET') return route.fulfill({ json: { total: 0, count: 0, by_category: {} } })
      if (path === '/api/me/tax-receipts' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/finance/summary' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/')

    const expenseRow = page.locator('.recent-exp-item').first()
    await expenseRow.click()

    const firstModal = page.locator('.modal-overlay:visible').first()
    await expect(firstModal.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await firstModal.locator('#exp-cat').selectOption('kitchen')
    await firstModal.getByRole('button', { name: 'Update' }).click()
    await expect(page.locator('.modal-overlay')).toBeHidden()

    await expect(expenseRow).toContainText('Kitchen')

    await expenseRow.click()

    const reopenedModal = page.locator('.modal-overlay:visible').first()
    await expect(reopenedModal.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(reopenedModal.locator('#exp-vendor')).toHaveValue('Govindas Supplies')
    await expect(reopenedModal.locator('#exp-cat')).toHaveValue('kitchen')
    await expect(reopenedModal.locator('#exp-amount')).toHaveValue('42.00')
    await expect(reopenedModal.getByRole('button', { name: 'Update' })).not.toHaveClass(/btn-loading/)
  })

  test('recent expense quick edit has one cancel button and cancel closes modal', async ({ page }) => {
    await loginAs(page, 'treasurer')

    const today = new Date().toISOString().slice(0, 10)
    const expenses = [
      { id: 1, amount: 4200, payee: 'Govindas Supplies', category: 'utilities', expense_date: today, created_at: `${today}T10:00:00Z`, updated_at: `${today}T11:00:00Z`, status: 'submitted', created_by: 2, approval_count: 0, approvals_required: 1 },
    ]

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()

      if (path === '/api/income' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/expenses' && method === 'GET') return route.fulfill({ json: { items: expenses, total: expenses.length } })
      if (path === '/api/expenses/1' && method === 'GET') return route.fulfill({ json: expenses[0] })
      if (path === '/api/expenses/1/approvals' && method === 'GET') return route.fulfill({ json: [] })
      if (path === '/api/members' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/expenses' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/donations/summary' && method === 'GET') return route.fulfill({ json: { total: 0, count: 0, by_category: {} } })
      if (path === '/api/me/tax-receipts' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/finance/summary' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/')

    const expenseRow = page.locator('.recent-exp-item').first()
    await expenseRow.click()
    const activeModal = page.locator('.modal-overlay:visible').first()
    await expect(activeModal.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(activeModal.getByRole('button', { name: 'Cancel' })).toHaveCount(1)

    await activeModal.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.modal-overlay')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(0)

    await expenseRow.click()
    const secondModal = page.locator('.modal-overlay:visible').first()
    await expect(secondModal.getByRole('button', { name: 'Cancel' })).toHaveCount(1)
  })

  test('overview quick edit keeps attachment area isolated per expense', async ({ page }) => {
    await loginAs(page, 'treasurer')

    const today = new Date().toISOString().slice(0, 10)
    const expenses = [
      {
        id: 1,
        amount: 4200,
        payee: 'Receipt Expense',
        category: 'utilities',
        expense_date: today,
        created_at: `${today}T10:00:00Z`,
        updated_at: `${today}T11:00:00Z`,
        status: 'submitted',
        created_by: 2,
        approval_count: 0,
        approvals_required: 1,
        attachments: [
          { id: 41, file_path: 'uploads/finance/2026/receipt.png', original_name: 'receipt.png', mime_type: 'image/png' },
        ],
      },
      {
        id: 2,
        amount: 1800,
        payee: 'Plain Expense',
        category: 'kitchen',
        expense_date: today,
        created_at: `${today}T09:00:00Z`,
        updated_at: `${today}T09:30:00Z`,
        status: 'submitted',
        created_by: 2,
        approval_count: 0,
        approvals_required: 1,
        attachments: [],
      },
    ]

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()

      if (path === '/api/income' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/expenses' && method === 'GET') return route.fulfill({ json: { items: expenses, total: expenses.length } })
      if (path === '/api/expenses/1' && method === 'GET') return route.fulfill({ json: expenses[0] })
      if (path === '/api/expenses/2' && method === 'GET') return route.fulfill({ json: expenses[1] })
      if (path === '/api/expenses/1/approvals' && method === 'GET') return route.fulfill({ json: [] })
      if (path === '/api/expenses/2/approvals' && method === 'GET') return route.fulfill({ json: [] })
      if (path === '/api/members' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/expenses' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/donations/summary' && method === 'GET') return route.fulfill({ json: { total: 0, count: 0, by_category: {} } })
      if (path === '/api/me/tax-receipts' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/finance/summary' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/')

    const receiptRow = page.locator('.recent-exp-item').filter({ hasText: 'Receipt Expense' })
    await receiptRow.click()
    const firstEdit = page.locator('.modal-overlay:visible').first()
    await expect(firstEdit.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(firstEdit.locator('.receipt-thumb')).toHaveCount(1)
    await expect(firstEdit.locator('.expense-media-empty:not(.hidden)')).toHaveCount(0)

    await firstEdit.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.modal-overlay')).toBeHidden()

    const plainRow = page.locator('.recent-exp-item').filter({ hasText: 'Plain Expense' })
    await plainRow.click()
    const secondEdit = page.locator('.modal-overlay:visible').first()
    await expect(secondEdit.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(secondEdit.locator('.receipt-thumb')).toHaveCount(0)
    await expect(secondEdit.getByText('Attach documents')).toBeVisible()

    await secondEdit.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.modal-overlay')).toBeHidden()

    await receiptRow.click()
    const reopenedFirstEdit = page.locator('.modal-overlay:visible').first()
    await expect(reopenedFirstEdit.locator('.receipt-thumb')).toHaveCount(1)
    await expect(reopenedFirstEdit.locator('.expense-media-empty:not(.hidden)')).toHaveCount(0)
  })

  test('view expense then add new expense opens blank form', async ({ page }) => {
    await loginAs(page, 'treasurer')

    const today = new Date().toISOString().slice(0, 10)
    const expenses = [
      { id: 1, amount: 4200, payee: 'Existing Vendor', category: 'kitchen', expense_date: today, created_at: `${today}T10:00:00Z`, updated_at: `${today}T10:00:00Z`, status: 'submitted', approval_count: 0, approvals_required: 1, created_by: 2 },
    ]

    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const path = url.pathname
      const method = route.request().method()
      if (path === '/api/expenses' && method === 'GET') return route.fulfill({ json: { items: expenses, total: 1 } })
      if (path === '/api/expenses/1' && method === 'GET') return route.fulfill({ json: expenses[0] })
      if (path === '/api/income' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/members' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/expenses' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      if (path === '/api/me/donations/summary' && method === 'GET') return route.fulfill({ json: { total: 0, count: 0, by_category: {} } })
      if (path === '/api/me/tax-receipts' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/')

    // Step 1: View existing expense
    const expenseRow = page.locator('.recent-exp-item').first()
    await expenseRow.click()
    await page.waitForTimeout(200)
    const viewModal = page.locator('.modal-overlay:visible').first()
    await expect(viewModal.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()

    // Step 2: Close
    await viewModal.locator('.modal-close').click()
    await expect(page.locator('.modal-overlay')).toBeHidden()

    // Step 3: Click "+ Expense" to add NEW
    await page.click('button:has-text("+ Expense")')
    const addModal = page.locator('.modal-overlay:visible').first()
    await expect(addModal.getByRole('heading', { name: 'Add Expense' })).toBeVisible()

    // Step 4: Assert form is BLANK — not populated with old expense data
    await expect(addModal.locator('#exp-amount')).toHaveValue('')
  })
})

test.describe('profile form payload', () => {
  const memberData = {
    name: 'Bhakta Joe', spiritual_name: '', email: 'joe@temple.local', phone: '514-111-2222',
    address: '123 Street', diksa_guru: '', guiding_devotee: '', rounds: 16, rounds_years: 3,
    four_regs_years: 2, kc_years: 5, temple: 'ISKCON Montreal', lives_in_temple: false, namahatta: false,
    dob: '1990-01-15', gender: 'Male', nationality: 'Canadian', occupation: 'Developer',
    marriage_status: 'Single', spouse: '', children: '', notes: '',
  }

  test('edit profile sends form values in PUT payload', async ({ page }) => {
    await loginAs(page, 'viewer')
    let savedPayload
    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url())
      const method = route.request().method()
      const path = url.pathname
      if (path === '/api/me/member' && method === 'GET') {
        return route.fulfill({ json: { public_id: 'abc', data: JSON.stringify(memberData) } })
      }
      if (path === '/api/me/member' && method === 'PUT') {
        savedPayload = route.request().postDataJSON()
        return route.fulfill({ json: { public_id: 'abc', data: JSON.stringify(savedPayload) } })
      }
      if (path === '/api/me/devices') return route.fulfill({ json: [] })
      route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/profile.html')
    await expect(page.locator('h1')).toHaveText('Profile')
    await page.locator('button:has-text("Edit")').click()

    // Change some fields
    const name = page.locator('#p-name')
    await name.fill('')
    await name.fill('Bhakta Krishna')
    await name.dispatchEvent('change')
    const phone = page.locator('#p-phone')
    await phone.fill('')
    await phone.fill('514-999-8888')
    await phone.dispatchEvent('change')
    const guru = page.locator('#p-guru')
    await guru.fill('Srila Prabhupada')
    await guru.dispatchEvent('change')

    await page.locator('button[type="submit"]:has-text("Save")').click()
    await expect.poll(() => savedPayload).toBeTruthy()

    expect(savedPayload.name).toBe('Bhakta Krishna')
    expect(savedPayload.phone).toBe('514-999-8888')
    expect(savedPayload.diksa_guru).toBe('Srila Prabhupada')
    // Unchanged fields preserved
    expect(savedPayload.email).toBe('joe@temple.local')
    expect(savedPayload.temple).toBe('ISKCON Montreal')
  })
})
