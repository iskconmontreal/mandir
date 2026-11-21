import { expect, request } from '@playwright/test'
import { test, loginAsReal, API } from './e2e.fixtures.js'

// Requires goloka's /api/sankirtan/donations routes (the website's "Sponsor books").

const ref = (p) => p + '-' + Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')

// The website's own call: one row per reference.
async function seed(token, r, body) {
  const ctx = await request.newContext()
  const res = await ctx.put(`${API}/api/sankirtan/donations/${r}`, { data: body, headers: { Authorization: 'Bearer ' + token } })
  expect(res.ok(), await res.text()).toBeTruthy()
  await ctx.dispose()
}

test.describe('e2e: sankirtan donations', () => {
  test('verify an Interac donation, then send it to the temple', async ({ page }) => {
    const token = await loginAsReal(page, 'admin')
    const interac = ref('SI'), card = ref('SP'), name = `E2E Donor ${Date.now()}`
    await seed(token, interac, {
      method: 'interac', amount_cents: 5000, occurred_at: '2026-11-20', what: 'Sponsor books', tax_receipt_requested: true,
      donor: { name, email: 'donor@example.com', phone: '514 555 0100', address: { line1: '1 Test St', city: 'Montréal', province: 'QC', postal_code: 'H1V 2C5' } },
    })
    await seed(token, card, { method: 'card', amount_cents: 10800, occurred_at: '2026-11-20', what: 'Sponsor a box of Bhagavad-gītās' })

    await page.goto('/app/sankirtan/?tab=donations')
    const mine = page.locator('.donation-card', { hasText: name })
    await expect(mine).toBeVisible({ timeout: 15_000 })
    await expect(mine).toContainText('To verify')
    // the card sponsor asked for no receipt: anonymous, already verified by Stripe
    const anon = page.locator('.donation-card', { hasText: card })
    await expect(anon).toContainText('Anonymous')
    await expect(anon).toContainText('Money received')

    // step 1: the bank says 55 $, not 50 $
    await page.locator('.seg', { hasText: 'To verify' }).click()
    await expect(page.locator('.donation-card', { hasText: card })).toHaveCount(0)
    await mine.click()
    await expect(mine.locator(`#don-amt-${interac}`)).toHaveValue('50.00')
    await mine.locator(`#don-amt-${interac}`).fill('55')
    await mine.getByRole('button', { name: 'Money received' }).click()
    await expect(mine).toHaveCount(0, { timeout: 15_000 })

    // step 2: send to the temple office
    await page.locator('.seg', { hasText: 'To send to the temple' }).click()
    await expect(mine).toContainText('$55.00')
    await mine.locator('input[type=checkbox]').check()
    await page.getByRole('button', { name: /Send to the temple \(1\)/ }).click()
    await page.getByRole('button', { name: 'Yes, send' }).click()
    await expect(mine).toHaveCount(0, { timeout: 15_000 })

    await page.locator('.seg', { hasText: 'Sent' }).click()
    await expect(mine).toContainText('Sent to temple')
  })
})
