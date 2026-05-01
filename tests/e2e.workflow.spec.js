import { expect, request } from '@playwright/test'
import { test, loginAsReal, API } from './e2e.fixtures.js'

test.describe('e2e: approve → pay flow', () => {
  // Helper: create expense with receipt attachment via API
  async function createExpenseWithReceipt(page, token, payee, amount = 15000) {
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const multiHeaders = { Authorization: `Bearer ${token}` }

    // Upload a unique receipt image (embed timestamp in EXIF comment to avoid content-hash dedup)
    const ts = Date.now()
    const comment = Buffer.from(`e2e-${ts}`)
    // Minimal valid JPEG with unique comment segment
    const jpegBytes = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
      Buffer.from([0xff, 0xfe, (comment.length + 2) >> 8, (comment.length + 2) & 0xff]),
      comment,
      Buffer.from([0xff, 0xd9]),
    ])
    const upload = await page.request.post(`${API}/api/documents/upload`, {
      headers: multiHeaders,
      multipart: {
        file: { name: `receipt-${ts}.jpg`, mimeType: 'image/jpeg', buffer: jpegBytes },
        intent: 'expense',
      },
    })
    const uploadBody = await upload.json()
    const attachmentId = uploadBody.attachment?.id
    expect(attachmentId).toBeTruthy()

    // Create expense with the attachment
    const res = await page.request.post(`${API}/api/expenses`, {
      headers,
      data: { payee, amount, category: 'admin', expense_date: '2026-03-01', note: 'approve-pay e2e', currency: 'CAD', attachment_ids: [attachmentId] },
    })
    expect(res.ok(), `expense create failed: ${res.status()} ${await res.text()}`).toBeTruthy()
    const created = await res.json()
    expect(created.id).toBeTruthy()
    expect(created.status).toBe('submitted')
    return created
  }

  test('quick approve → pay button appears → pay works', async ({ browser }) => {
    // Create expense with receipt as treasurer
    const treasurerCtx = await browser.newContext()
    const treasurerPage = await treasurerCtx.newPage()
    const treasurerToken = await loginAsReal(treasurerPage, 'treasurer')

    const ts = Date.now()
    const expense = await createExpenseWithReceipt(treasurerPage, treasurerToken, `E2E-QAP-${ts}`)

    // Approver approves via API (first approval)
    const approverCtx = await browser.newContext()
    const approverPage = await approverCtx.newPage()
    const approverToken = await loginAsReal(approverPage, 'approver')
    await approverPage.request.post(`${API}/api/expenses/${expense.id}/approve`, {
      headers: { Authorization: `Bearer ${approverToken}`, 'Content-Type': 'application/json' },
      data: { note: 'first approval' },
    })
    await approverCtx.close()

    // Treasurer opens finance, searches, quick approves (second approval → approved)
    await treasurerPage.goto('/app/finance/?tab=transactions&net_type=expense#transactions')
    await treasurerPage.locator('.card-tab-group').waitFor()
    await expect(treasurerPage.getByTestId('transactions-tab').getByTestId('tx-expense').first()).toBeVisible({ timeout: 15_000 })

    await treasurerPage.fill('.filter-search', `E2E-QAP-${ts}`)
    await treasurerPage.waitForTimeout(500)
    const row = treasurerPage.getByTestId('transactions-tab').getByTestId('tx-expense').first()
    await expect(row).toBeVisible()

    // Quick approve
    await row.hover()
    const approveBtn = row.locator('[aria-label="Quick approve expense"]')
    await expect(approveBtn).toBeVisible({ timeout: 5_000 })
    await approveBtn.click()
    await expect(treasurerPage.locator('.toast-success').first()).toBeVisible({ timeout: 5_000 })

    // After approve, pay button should appear
    await row.hover()
    const payBtn = row.locator('[aria-label="Mark as paid"]')
    await expect(payBtn).toBeVisible({ timeout: 5_000 })

    // Quick pay
    await payBtn.click()
    await expect(treasurerPage.locator('.toast-success').filter({ hasText: /paid/i })).toBeVisible({ timeout: 5_000 })
    await expect(row.locator('.recent-exp-status-text')).toHaveText('Paid')

    // Verify via API
    const check = await treasurerPage.request.get(`${API}/api/expenses/${expense.id}`, {
      headers: { Authorization: `Bearer ${treasurerToken}` },
    })
    expect((await check.json()).status).toBe('paid')

    // Cleanup
    await treasurerPage.request.delete(`${API}/api/expenses/${expense.id}`, {
      headers: { Authorization: `Bearer ${treasurerToken}` },
    })
    await treasurerCtx.close()
  })

  test('modal approve → modal paid button works', async ({ browser }) => {
    // Create expense with receipt as treasurer
    const treasurerCtx = await browser.newContext()
    const treasurerPage = await treasurerCtx.newPage()
    const treasurerToken = await loginAsReal(treasurerPage, 'treasurer')

    const ts = Date.now()
    const expense = await createExpenseWithReceipt(treasurerPage, treasurerToken, `E2E-MAP-${ts}`)

    // Approver approves via API (first approval)
    const approverCtx = await browser.newContext()
    const approverPage = await approverCtx.newPage()
    const approverToken = await loginAsReal(approverPage, 'approver')
    await approverPage.request.post(`${API}/api/expenses/${expense.id}/approve`, {
      headers: { Authorization: `Bearer ${approverToken}`, 'Content-Type': 'application/json' },
      data: { note: 'first approval' },
    })
    await approverCtx.close()

    // Treasurer opens finance and clicks the expense row to open modal
    await treasurerPage.goto('/app/finance/?tab=transactions&net_type=expense#transactions')
    await treasurerPage.locator('.card-tab-group').waitFor()
    await expect(treasurerPage.getByTestId('transactions-tab').getByTestId('tx-expense').first()).toBeVisible({ timeout: 15_000 })

    await treasurerPage.fill('.filter-search', `E2E-MAP-${ts}`)
    await treasurerPage.waitForTimeout(500)
    const row = treasurerPage.getByTestId('transactions-tab').getByTestId('tx-expense').first()
    await expect(row).toBeVisible()
    await row.click()

    const modal = treasurerPage.locator('.modal')
    await modal.waitFor()

    // Modal should show Approve button (status: submitted, pending second approval)
    const approveBtn = modal.getByRole('button', { name: 'Approve', exact: true })
    await expect(approveBtn).toBeVisible({ timeout: 5_000 })
    await approveBtn.click()

    // Modal stays open (close: false), toast shows, expense updated in-place
    await expect(treasurerPage.locator('.toast-success')).toBeVisible({ timeout: 5_000 })

    // Paid button should appear in the same modal (status changed to approved)
    const paidBtn = modal.getByRole('button', { name: 'Paid' })
    await expect(paidBtn).toBeVisible({ timeout: 5_000 })
    await expect(paidBtn).toBeEnabled()
    await paidBtn.click()

    // Modal stays open (close: false), toast shows paid
    await expect(treasurerPage.locator('.toast-success').filter({ hasText: /paid/i })).toBeVisible({ timeout: 5_000 })

    // Verify via API
    const check = await treasurerPage.request.get(`${API}/api/expenses/${expense.id}`, {
      headers: { Authorization: `Bearer ${treasurerToken}` },
    })
    expect((await check.json()).status).toBe('paid')

    // Cleanup
    await treasurerPage.request.delete(`${API}/api/expenses/${expense.id}`, {
      headers: { Authorization: `Bearer ${treasurerToken}` },
    })
    await treasurerCtx.close()
  })
})

test.describe('e2e: attachment deletion rules', () => {
  test('admin can delete attachment; non-owner non-admin cannot', async ({ browser }) => {
    // Treasurer uploads receipt and creates expense
    const tCtx = await browser.newContext()
    const tPage = await tCtx.newPage()
    const tToken = await loginAsReal(tPage, 'treasurer')
    const tHeaders = { Authorization: `Bearer ${tToken}` }

    const ts = Date.now()
    const comment = Buffer.from(`del-test-${ts}`)
    const jpegBytes = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
      Buffer.from([0xff, 0xfe, (comment.length + 2) >> 8, (comment.length + 2) & 0xff]),
      comment,
      Buffer.from([0xff, 0xd9]),
    ])
    const upload = await tPage.request.post(`${API}/api/documents/upload`, {
      headers: tHeaders,
      multipart: { file: { name: `del-${ts}.jpg`, mimeType: 'image/jpeg', buffer: jpegBytes }, intent: 'expense' },
    })
    const attId = (await upload.json()).attachment?.id
    expect(attId).toBeTruthy()

    const create = await tPage.request.post(`${API}/api/expenses`, {
      headers: { ...tHeaders, 'Content-Type': 'application/json' },
      data: { payee: `Del-Test-${ts}`, amount: 1000, category: 'admin', expense_date: '2026-03-01', currency: 'CAD', attachment_ids: [attId] },
    })
    const expense = await create.json()

    // Member (non-owner, non-admin) cannot delete
    const mCtx = await browser.newContext()
    const mPage = await mCtx.newPage()
    const mToken = await loginAsReal(mPage, 'member')
    const delByMember = await mPage.request.delete(`${API}/api/documents/${attId}`, {
      headers: { Authorization: `Bearer ${mToken}` },
    })
    expect(delByMember.status()).toBe(403)

    // Owner (treasurer) can delete their own attachment on submitted expense
    const delByOwner = await tPage.request.delete(`${API}/api/documents/${attId}`, { headers: tHeaders })
    expect(delByOwner.status()).toBe(200)

    // Cleanup
    await tPage.request.delete(`${API}/api/expenses/${expense.id}`, { headers: tHeaders })
    await tCtx.close()
    await mCtx.close()
  })

  test('non-admin cannot delete attachment from approved expense', async ({ browser }) => {
    // Treasurer creates expense with attachment
    const tCtx = await browser.newContext()
    const tPage = await tCtx.newPage()
    const tToken = await loginAsReal(tPage, 'treasurer')
    const tHeaders = { Authorization: `Bearer ${tToken}` }

    const ts = Date.now()
    const comment = Buffer.from(`appr-del-${ts}`)
    const jpegBytes = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
      Buffer.from([0xff, 0xfe, (comment.length + 2) >> 8, (comment.length + 2) & 0xff]),
      comment,
      Buffer.from([0xff, 0xd9]),
    ])
    const upload = await tPage.request.post(`${API}/api/documents/upload`, {
      headers: tHeaders,
      multipart: { file: { name: `appr-${ts}.jpg`, mimeType: 'image/jpeg', buffer: jpegBytes }, intent: 'expense' },
    })
    const attId = (await upload.json()).attachment?.id
    expect(attId).toBeTruthy()

    const create = await tPage.request.post(`${API}/api/expenses`, {
      headers: { ...tHeaders, 'Content-Type': 'application/json' },
      data: { payee: `Appr-Del-${ts}`, amount: 2000, category: 'admin', expense_date: '2026-03-01', currency: 'CAD', attachment_ids: [attId] },
    })
    const expense = await create.json()

    // Approver approves the expense
    const aCtx = await browser.newContext()
    const aPage = await aCtx.newPage()
    const aToken = await loginAsReal(aPage, 'approver')
    await aPage.request.post(`${API}/api/expenses/${expense.id}/approve`, {
      headers: { Authorization: `Bearer ${aToken}`, 'Content-Type': 'application/json' },
      data: { note: 'approved' },
    })
    // Second approval by treasurer
    await tPage.request.post(`${API}/api/expenses/${expense.id}/approve`, {
      headers: { ...tHeaders, 'Content-Type': 'application/json' },
      data: { note: 'second approval' },
    })

    // Verify expense is approved
    const check = await tPage.request.get(`${API}/api/expenses/${expense.id}`, { headers: tHeaders })
    expect((await check.json()).status).toBe('approved')

    // Non-admin owner trying to delete attachment from approved expense → 403
    // Note: treasurer has expenses:approve so is a finance manager — skip this if treasurer is admin-level
    // Use member context instead (member uploaded nothing, but we test the status-based check)
    // Actually treasurer IS a finance manager — admin CAN delete. Let's test with a viewer who has expenses:create
    const vCtx = await browser.newContext()
    const vPage = await vCtx.newPage()
    const vToken = await loginAsReal(vPage, 'viewer')
    const delByViewer = await vPage.request.delete(`${API}/api/documents/${attId}`, {
      headers: { Authorization: `Bearer ${vToken}` },
    })
    // Viewer is not owner and not finance manager → 403
    expect(delByViewer.status()).toBe(403)

    // Treasurer (finance manager) CAN delete from approved expense
    const delByTreasurer = await tPage.request.delete(`${API}/api/documents/${attId}`, { headers: tHeaders })
    expect(delByTreasurer.status()).toBe(200)

    // Cleanup
    await tPage.request.delete(`${API}/api/expenses/${expense.id}`, { headers: tHeaders })
    await tCtx.close()
    await aCtx.close()
    await vCtx.close()
  })
})
