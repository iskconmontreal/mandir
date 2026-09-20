import { expect } from '@playwright/test'
import { test, loginAsReal, uniqueJpeg } from './e2e.fixtures.js'

// Requires goloka's /api/sankirtan/events routes (events-handoff spec).

test.describe('e2e: sankirtan events', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsReal(page, 'admin')
  })

  test('create an event, upload a photo, see its thumbnail', async ({ page }) => {
    const title = `E2E Event ${Date.now()}`
    await page.goto('/app/sankirtan/?tab=events')

    await page.getByRole('button', { name: '+ New event' }).click()
    await page.locator('.modal').waitFor()

    await page.fill('#ev-starts', '2030-09-26')
    await page.fill('#ev-title-en', title)
    await page.fill('#ev-title-fr', `${title} (fr)`)
    await page.fill('#ev-place-en', 'Jeanne-Mance Park')
    await page.fill('#ev-place-fr', 'Parc Jeanne-Mance')
    await page.getByRole('button', { name: 'Create Event' }).click()

    // Modal stays open in edit mode so photos can be added right away.
    await expect(page.locator('.modal h2')).toHaveText('Edit Event', { timeout: 15_000 })

    await page.setInputFiles('#ev-photo-file', {
      name: 'festival.jpg',
      mimeType: 'image/jpeg',
      buffer: uniqueJpeg('event-photo'),
    })
    await expect(page.locator('.photo-thumb-wrap img')).toHaveCount(1, { timeout: 30_000 })

    await page.locator('.modal-close').click()
    await expect(page.locator('.event-card', { hasText: title })).toBeVisible()
    await expect(page.locator('.event-card', { hasText: title })).toContainText('Published')
  })

  test('rejects an end date before the start date client-side', async ({ page }) => {
    await page.goto('/app/sankirtan/?tab=events')
    await page.getByRole('button', { name: '+ New event' }).click()
    await page.locator('.modal').waitFor()

    await page.fill('#ev-starts', '2030-09-26')
    await page.fill('#ev-ends', '2030-09-20')
    await page.fill('#ev-title-en', 'Bad dates')
    await page.fill('#ev-title-fr', 'Mauvaises dates')
    await page.fill('#ev-place-en', 'Park')
    await page.fill('#ev-place-fr', 'Parc')
    await page.getByRole('button', { name: 'Create Event' }).click()

    await expect(page.locator('.modal .login-error')).toContainText('End date')
  })
})
