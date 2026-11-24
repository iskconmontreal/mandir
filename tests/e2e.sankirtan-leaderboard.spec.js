import { expect } from '@playwright/test'
import { test, loginAsReal } from './e2e.fixtures.js'

const day = new Date().toISOString().slice(0, 8) + '01T00:00:00Z'
const line = (book_id, title, qty) => ({ book_id, title_snapshot: title, language_snapshot: 'English', qty })

test('books distributed: total, per devotee, and per group', async ({ page }) => {
  await loginAsReal(page, 'admin')
  await page.route('**/api/sankirtan/leaderboard?*', route => route.fulfill({ json: { results: [
    { distributor_name: 'Bhakti Academy', points: 9, books: 9, collected_cents: 0, is_group: true,
      members: [{ distributor_name: 'Joy', points: 5, books: 5 }, { distributor_name: 'Amala', points: 4, books: 4 }] },
    { distributor_name: 'Luv Das', points: 3, books: 3, collected_cents: 0 },
  ] } }))
  await page.route('**/api/sankirtan/sessions-export.json', route => route.fulfill({ json: { sessions: [
    { distributor_name: 'Joy', occurred_at: day, books: [line(1, 'Bhagavad-gita', 5)] },
    { distributor_name: 'Amala', occurred_at: day, books: [line(2, 'Science of Self-Realization', 4)] },
    { distributor_name: 'Luv Das', occurred_at: day, books: [line(1, 'Bhagavad-gita', 3)] },
  ] } }))
  await page.goto('/app/sankirtan/?tab=leaderboard')

  const card = page.locator('.card', { hasText: 'Books distributed' })
  await expect(card).toContainText('12 books · 2 titles')
  await expect(card.locator('tr', { hasText: 'Bhagavad-gita' })).toContainText('8')

  const pick = card.locator('select')
  await pick.selectOption('Luv Das')
  await expect(card).toContainText('3 books · 1 title')

  await page.getByRole('tab', { name: 'Groups' }).click()
  await pick.selectOption('Bhakti Academy')
  await expect(card).toContainText('9 books · 2 titles')

  await pick.selectOption('')
  await expect(card).toContainText('12 books · 2 titles')
})
