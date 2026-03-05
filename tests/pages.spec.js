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
})

test.describe('progress bar', () => {
  test('progress bar reaches done state after load', async ({ page }) => {
    await loginAs(page, 'viewer')
    await page.route(`${API}/**`, route => route.fulfill({ json: { items: [], total: 0 } }))
    await page.goto('/app/')
    await expect(page.locator('.progress')).toHaveClass(/done/)
  })
})
