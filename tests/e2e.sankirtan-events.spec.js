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

  test('"Create event" on a session opens a prefilled New Event form', async ({ page }) => {
    const place = `E2E Park ${Date.now()}`
    // Session list mocked (creating one needs a catalog book); the event itself hits goloka.
    await page.route('**/api/sankirtan/sessions?*', route => route.fulfill({ json: [{
      id: 990001, distributor_name: 'E2E Devotee', occurred_at: '2030-09-26T00:00:00Z', location: place,
      total_books: 1, total_points: 1, collected_cents: 0, books: [], payments: [], created_at: '2030-09-26T15:00:00Z',
    }] }))
    await page.goto('/app/sankirtan/?tab=sessions')

    await page.locator('.card', { hasText: 'E2E Devotee' }).first().click()
    await page.getByRole('button', { name: 'Create event' }).click()

    await expect(page.locator('.modal h2')).toHaveText('New Event')
    await expect(page).toHaveURL(/tab=events/)
    await expect(page.locator('#ev-starts')).toHaveValue('2030-09-26')
    await expect(page.locator('#ev-place-en')).toHaveValue(place)
    await expect(page.locator('#ev-title-en')).toHaveValue(`Book distribution at ${place}`)

    await page.setInputFiles('#ev-photo-file', { name: 'table.jpg', mimeType: 'image/jpeg', buffer: uniqueJpeg('session-event') })
    await page.getByRole('button', { name: 'Create Event with 1 photo' }).click()
    await expect(page.locator('.modal')).toHaveCount(0, { timeout: 30_000 })
    await expect(page.locator('.event-card', { hasText: place })).toContainText('Photos:1')
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
