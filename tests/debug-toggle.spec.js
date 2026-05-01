import { test, expect } from '@playwright/test'
import { loginAs } from './fixtures.js'
import { mockFinance, openFinance } from './finance-fixtures.js'

const isoMonthDate = (offset, day) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0,8) + day
}

test('transaction month toggle collapses the list without removing it', async ({ page }) => {
  await loginAs(page, 'treasurer')
  const expenses = [
    { id: 1, amount: 1000, payee: 'A', category: 'kitchen', expense_date: isoMonthDate(0, '05'), status: 'submitted' },
  ]
  await mockFinance(page, { expenses })
  await openFinance(page, 'expenses')
  await page.getByTestId('tx-expense').first().waitFor({ timeout: 5000 })

  const section = page.locator('section').first()

  // Click to close
  await section.locator('.exp-group-header').first().click()
  await page.waitForTimeout(500)

  await expect(section.locator('.finance-exp-list')).toHaveCount(1)
  await expect(section.locator('.finance-exp-list').first()).not.toHaveClass(/finance-exp-list-open/)
  await expect(section.getByTestId('tx-expense')).toHaveCount(1)
})
