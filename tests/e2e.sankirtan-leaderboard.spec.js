import { expect } from '@playwright/test'
import { test, loginAsReal } from './e2e.fixtures.js'

const day = new Date().toISOString().slice(0, 8) + '01T00:00:00Z'
const line = (book_id, title, qty) => ({ book_id, title_snapshot: title, language_snapshot: 'English', qty })

test('books distributed: total card plus each row\'s own titles', async ({ page }) => {
  await loginAsReal(page, 'admin')
  await page.route('**/api/sankirtan/leaderboard?*', route => route.fulfill({ json: { results: [
    { distributor_name: 'Bhakti Academy', points: 9, books: 9, collected_cents: 268111, is_group: true,
      members: [{ distributor_name: 'Joy', points: 5, books: 5 }, { distributor_name: 'Amala', points: 4, books: 4 }] },
    { distributor_name: 'Luv Das', points: 3, books: 3, collected_cents: 0 },
    { distributor_name: 'Remy&Fern', points: 2, books: 2, collected_cents: 50000, is_group: true,
      members: [{ distributor_name: 'Remy', points: 1, books: 1 }, { distributor_name: 'Fern', points: 1, books: 1 }] },
  ] } }))
  await page.route('**/api/sankirtan/sessions-export.json', route => route.fulfill({ json: { sessions: [
    { distributor_name: 'Joy', occurred_at: day, books: [line(1, 'Bhagavad-gita', 5)] },
    { distributor_name: 'Amala', occurred_at: day, books: [line(2, 'Science of Self-Realization', 4)] },
    { distributor_name: 'Luv Das', occurred_at: day, books: [line(1, 'Bhagavad-gita', 3)] },
  ] } }))
  await page.goto('/app/sankirtan/?tab=leaderboard')

  const card = page.locator('.card').filter({ has: page.locator('h3', { hasText: 'Books distributed' }) })
  await expect(card).toContainText('12 books · 2 titles')
  await expect(card.locator('tr', { hasText: 'Bhagavad-gita' })).toContainText('8')

  // Devotees view: a row opens to its own titles.
  const table = page.locator('.card').filter({ has: page.locator('th', { hasText: 'Distributor' }) })
  await table.locator('tr', { hasText: 'Luv Das' }).first().click()
  await expect(table).toContainText('×3')

  // Groups view: the group row lists its devotees and their combined titles.
  await page.getByRole('tab', { name: 'Groups' }).click()
  await table.locator('tr', { hasText: 'Bhakti Academy' }).first().click()
  await expect(table).toContainText('2 devotees')
  await expect(table).toContainText('Science of Self-Realization')
  await expect(table).toContainText('×5')
  await expect(table).toContainText('×4')

  // The total card is unaffected.
  await expect(card).toContainText('12 books · 2 titles')

  // Teams live in the Metrics tab; the header keeps its three totals.
  await expect(page.locator('.sk-stat')).toHaveCount(3)
  await page.getByRole('tab', { name: 'Metrics' }).click()
  const teams = page.locator('.card').filter({ has: page.locator('h3', { hasText: 'Teams' }) })
  await expect(teams.locator('tr', { hasText: 'Bhakti Academy' })).toContainText('$2,681.11')
  await expect(teams.locator('tr', { hasText: 'Remy&Fern' })).toContainText('$500.00')
  await expect(teams.locator('tbody tr')).toHaveCount(3)   // lone distributors are listed too
  await expect(teams.locator('tfoot')).toContainText('14')
  await expect(teams.locator('tfoot')).toContainText('$3,181.11')
})
