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
    await expect(page.locator('.finance-pulse-link').first()).toHaveAttribute('href', 'finance/?tab=expenses#expenses')
    await expect(page.locator('.finance-pulse-link').nth(1)).toHaveAttribute('href', 'finance/?tab=income#income')
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
  test('recent row hover shows quick actions and expense approve then pay works', async ({ page }) => {
    await loginAs(page, 'treasurer')

    const today = new Date().toISOString().slice(0, 10)
    const expenses = [
      { id: 1, amount: 4200, payee: 'Govindas Supplies', category: 'kitchen', expense_date: today, created_at: `${today}T10:00:00Z`, status: 'submitted', approval_count: 0, approvals_required: 1, created_by: 2 },
    ]
    const incomes = [
      { id: 7, type: 'donation', amount: 8800, method: 'card', category: 'festival', date_received: today, created_at: `${today}T09:00:00Z`, updated_at: `${today}T09:00:00Z`, created_by: 2, source_name: 'Sunday Guest' },
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
      if (path === '/api/expenses/1/approve' && method === 'POST') {
        expenses[0] = { ...expenses[0], status: 'approved', approval_count: 1 }
        return route.fulfill({ json: { ...expenses[0], approval_count: 1, approvals_required: 1 } })
      }
      if (path === '/api/expenses/1/pay' && method === 'POST') {
        expenses[0] = { ...expenses[0], status: 'paid' }
        return route.fulfill({ json: { ...expenses[0] } })
      }
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/')

    const expenseRow = page.locator('.recent-exp-item').first()
    await expenseRow.hover()
    await expect(expenseRow.locator('.recent-row-action')).toHaveCount(2)
    await expenseRow.locator('[aria-label="Quick approve expense"]').click()
    await expect(expenseRow).toContainText('Approved')
    await expect(expenseRow).toContainText('by you')
    await expenseRow.hover()
    await expect(expenseRow.locator('[aria-label="Quick pay expense"]')).toBeVisible()
    await expenseRow.locator('[aria-label="Quick pay expense"]').click()
    await expect(expenseRow).toContainText('Paid')
    await expect(expenseRow).toContainText('by you')

    const donationRow = page.locator('.recent-inc-item').first()
    await donationRow.hover()
    await expect(donationRow.locator('.recent-row-action')).toHaveCount(2)
    await donationRow.locator('[aria-label="Quick revise donation"]').click()
    await expect(page.getByRole('heading', { name: 'Edit donation' })).toBeVisible()
  })

  test('recent approved expense shows last updater name', async ({ page }) => {
    await loginAs(page, 'treasurer')

    const now = new Date().toISOString()
    const expenses = [
      { id: 1, amount: 4200, payee: 'Govindas Supplies', category: 'kitchen', expense_date: now.slice(0, 10), created_at: now, updated_at: now, status: 'approved', created_by: 2 },
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
      if (path === '/api/audit' && method === 'GET') {
        return route.fulfill({ json: { items: [{ id: 1, entity_id: 1, entity_type: 'expense', user_id: 9, action: 'update', created_at: now }], total: 1 } })
      }
      return route.fulfill({ json: { items: [], total: 0 } })
    })

    await page.goto('/app/')

    const expenseRow = page.locator('.recent-exp-item').first()
    await expect(expenseRow).toContainText('Approved')
    await expect(expenseRow).toContainText('by Madhava Prabhu')
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

    await expect(page.locator('#don-method option')).toHaveCount(5)
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
    await expect(page.locator('.modal')).toContainText('Radhika Dasi')
    await expect(page.locator('.modal')).toContainText('E-Transfer')
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible()

    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('#don-donor')).toHaveValue('Radhika Dasi')
    await expect(page.locator('#don-amount')).toHaveValue('100.50')
    await expect(page.locator('#don-method')).toHaveValue('e-transfer')
    await expect(page.locator('#don-cat')).toHaveValue('festival')
    await expect(page.locator('#don-date')).toHaveValue(today)

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible()

    await page.getByRole('button', { name: 'Edit' }).click()
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
    await expenseRow.hover()
    await expenseRow.locator('[aria-label="Quick revise expense"]').click()

    await expect(page.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(page.getByText('Scan receipts')).toHaveCount(0)
    await expect(page.locator('#home-exp-vendor')).toBeDisabled()
    await expect(page.locator('#home-exp-cat')).toHaveValue('utilities')
    await expect(page.locator('#home-exp-amount')).toBeDisabled()
    await expect(page.locator('#home-exp-date')).toBeDisabled()
    await expect(page.locator('#home-exp-cat')).toBeEnabled()
    await expect(page.locator('#home-exp-desc')).toBeEnabled()

    const activeModal = page.locator('.modal-overlay:visible').first()
    await activeModal.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.modal-overlay')).toBeHidden()

    await expenseRow.hover()
    await expenseRow.locator('[aria-label="Quick revise expense"]').click()

    const reopenedModal = page.locator('.modal-overlay:visible').first()
    await expect(reopenedModal.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(reopenedModal.getByText('Scan receipts')).toHaveCount(0)
    await expect(reopenedModal.locator('#home-exp-vendor')).toBeDisabled()
    await expect(reopenedModal.locator('#home-exp-date')).toBeDisabled()
    await expect(reopenedModal.locator('#home-exp-amount')).toBeDisabled()
    await expect(reopenedModal.locator('#home-exp-cat')).toBeEnabled()
    await expect(reopenedModal.locator('#home-exp-desc')).toBeEnabled()
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
    await page.locator('#receipt-input').setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: pngBytes,
    })
    await expect(page.locator('.receipt-thumb')).toHaveCount(1)
    await expect(page.locator('.receipt-add')).toHaveCount(1)
    await expect(page.locator('#home-exp-vendor')).toHaveValue('Receipt Shop')
    await expect(page.locator('#home-exp-amount')).toHaveValue('18.25')
    await page.selectOption('#home-exp-cat', 'utilities')

    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 5000 })

    await page.getByRole('button', { name: '+ Expense' }).click()
    const reopenedModal = page.locator('.modal-overlay:visible').first()
    await expect(reopenedModal.getByText('Scan receipts')).toBeVisible()
    await expect(reopenedModal.locator('.receipt-thumb')).toHaveCount(0)
    await expect(reopenedModal.locator('.receipt-add')).toHaveCount(0)
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
    await expenseRow.hover()
    await expenseRow.locator('[aria-label="Quick revise expense"]').click()

    const firstModal = page.locator('.modal-overlay:visible').first()
    await expect(firstModal.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await firstModal.locator('#home-exp-cat').selectOption('kitchen')
    await firstModal.getByRole('button', { name: 'Update' }).click()
    await expect(page.locator('.modal-overlay')).toBeHidden()

    await expect(expenseRow).toContainText('Kitchen')

    await expenseRow.hover()
    await expenseRow.locator('[aria-label="Quick revise expense"]').click()

    const reopenedModal = page.locator('.modal-overlay:visible').first()
    await expect(reopenedModal.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(reopenedModal.locator('#home-exp-vendor')).toHaveValue('Govindas Supplies')
    await expect(reopenedModal.locator('#home-exp-cat')).toHaveValue('kitchen')
    await expect(reopenedModal.locator('#home-exp-amount')).toHaveValue('42.00')
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
    await expenseRow.hover()
    await expenseRow.locator('[aria-label="Quick revise expense"]').click()
    const activeModal = page.locator('.modal-overlay:visible').first()
    await expect(activeModal.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(activeModal.getByRole('button', { name: 'Cancel' })).toHaveCount(1)

    await activeModal.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.modal-overlay')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(0)

    await expenseRow.hover()
    await expenseRow.locator('[aria-label="Quick revise expense"]').click()
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
    await receiptRow.hover()
    await receiptRow.locator('[aria-label="Quick revise expense"]').click()
    const firstEdit = page.locator('.modal-overlay:visible').first()
    await expect(firstEdit.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(firstEdit.getByText('Receipts')).toBeVisible()
    await expect(firstEdit.locator('.receipt-thumb')).toHaveCount(1)

    await firstEdit.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.modal-overlay')).toBeHidden()

    const plainRow = page.locator('.recent-exp-item').filter({ hasText: 'Plain Expense' })
    await plainRow.hover()
    await plainRow.locator('[aria-label="Quick revise expense"]').click()
    const secondEdit = page.locator('.modal-overlay:visible').first()
    await expect(secondEdit.getByRole('heading', { name: 'Edit Expense' })).toBeVisible()
    await expect(secondEdit.getByText('Receipts')).toHaveCount(0)
    await expect(secondEdit.locator('.receipt-thumb')).toHaveCount(0)

    await secondEdit.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('.modal-overlay')).toBeHidden()

    await receiptRow.hover()
    await receiptRow.locator('[aria-label="Quick revise expense"]').click()
    const reopenedFirstEdit = page.locator('.modal-overlay:visible').first()
    await expect(reopenedFirstEdit.getByText('Receipts')).toBeVisible()
    await expect(reopenedFirstEdit.locator('.receipt-thumb')).toHaveCount(1)
  })
})
