import { expect, request } from '@playwright/test'
import { test, loginAsReal, API } from './e2e.fixtures.js'

test.describe('e2e: payee autocomplete', () => {
  test('selecting payee from autocomplete produces no console errors', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginAsReal(page, 'treasurer')

    const errors = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto('/app/finance/?tab=transactions&net_type=expense#transactions')
    await page.locator('.card-tab-group').waitFor()

    await page.click('button:has-text("+ Expense")')
    await page.locator('.modal').waitFor()

    const vendor = page.locator('#exp-vendor')
    await vendor.fill('a')
    await page.waitForTimeout(500)

    const hit = page.locator('.autocomplete-item').first()
    if (await hit.isVisible().catch(() => false)) {
      await hit.click()
      // Wait for queueMicrotask to settle
      await page.evaluate(() => new Promise(r => queueMicrotask(r)))
      await page.waitForTimeout(200)
    }

    expect(errors.filter(e => /Maximum call stack|reentr/i.test(e))).toHaveLength(0)

    await ctx.close()
  })
})
