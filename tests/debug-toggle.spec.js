import { test, expect } from '@playwright/test'
import { loginAs, mockAPI, API } from './fixtures.js'

const isoMonthDate = (offset, day) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0,8) + day
}

test('debug if behavior', async ({ page }) => {
  await loginAs(page, 'treasurer')
  const expenses = [
    { id: 1, amount: 1000, payee: 'A', category: 'kitchen', expense_date: isoMonthDate(0, '05'), status: 'submitted' },
  ]
  await mockAPI(page, {
    [`${API}/expenses*`]: expenses,
    [`${API}/income*`]: [],
  })
  await page.goto('/app/finance/#expenses')
  await page.locator('.card-tab-group').waitFor()
  await page.locator('.finance-exp-item').first().waitFor({ timeout: 5000 })

  const section = page.locator('section').first()

  // Click to close
  await section.locator('.exp-group-header').first().click()
  await page.waitForTimeout(500)

  // Check what elements exist
  const lists = await section.locator('.finance-exp-list').count()
  console.log('finance-exp-list count after close:', lists)

  if (lists > 0) {
    const listHTML = await section.locator('.finance-exp-list').first().innerHTML()
    console.log('List innerHTML:', JSON.stringify(listHTML.trim().slice(0, 300)))
    const isVisible = await section.locator('.finance-exp-list').first().isVisible()
    console.log('List isVisible:', isVisible)
    const hidden = await section.locator('.finance-exp-list').first().getAttribute('hidden')
    console.log('List hidden attr:', hidden)
    const cls = await section.locator('.finance-exp-list').first().getAttribute('class')
    console.log('List class:', cls)
    const bbox = await section.locator('.finance-exp-list').first().boundingBox()
    console.log('List boundingBox:', JSON.stringify(bbox))
  } else {
    console.log('No .finance-exp-list found — :if removed it')
  }
})
