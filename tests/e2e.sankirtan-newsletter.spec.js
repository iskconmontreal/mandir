import { expect, request } from '@playwright/test'
import { test, loginAsReal, API } from './e2e.fixtures.js'

// Requires goloka's /api/sankirtan/newsletters routes (newsletter prompt 1).

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = buf => {
  let c = 0xFFFFFFFF
  for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

// Minimal stored (uncompressed) zip, enough for archive/zip.
function zip(files) {
  const parts = [], central = []
  let offset = 0
  for (const [name, data] of Object.entries(files)) {
    const n = Buffer.from(name), crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x21, 12)
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(n.length, 26)
    const dir = Buffer.alloc(46)
    dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(0x21, 14)
    dir.writeUInt32LE(crc, 16); dir.writeUInt32LE(data.length, 20); dir.writeUInt32LE(data.length, 24)
    dir.writeUInt16LE(n.length, 28); dir.writeUInt32LE(offset, 42)
    parts.push(local, n, data)
    central.push(dir, n)
    offset += 30 + n.length + data.length
  }
  const cd = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10)
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, cd, end])
}

test.describe('e2e: sankirtan newsletter', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsReal(page, 'admin')
  })

  test('create an issue, upload the English zip, publish it', async ({ page }) => {
    const marker = `E2E newsletter ${Date.now()}`
    const html = `<!doctype html><html><body><h1>${marker}</h1><img src="images/a1.png" width="1" height="1"><a href="{{ unsubscribe }}">Unsubscribe</a></body></html>`
    const buffer = zip({ 'email.html': Buffer.from(html), 'email.txt': Buffer.from(marker), 'images/a1.png': PNG })

    await page.goto('/app/sankirtan/?tab=newsletter')
    await page.getByRole('button', { name: '+ New issue' }).click()
    await expect(page.locator('#nl-issue')).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/[?&]issue=\d+/)
    const id = Number(new URL(page.url()).searchParams.get('issue'))

    await page.setInputFiles('#nl-zip-en', { name: 'newsletter.zip', mimeType: 'application/zip', buffer })
    const en = page.locator('.nl-edition[data-lang="en"]')
    await expect(en.locator('iframe')).toHaveAttribute('src', /\/uploads\/sankirtan\/newsletters\/\d+\/en-[a-z0-9]+\/email\.html$/, { timeout: 30_000 })
    await expect(page.frameLocator('.nl-edition[data-lang="en"] iframe').locator('h1')).toHaveText(marker)
    await expect(page.locator('.nl-edition[data-lang="fr"]')).toContainText('Missing')

    await page.fill('#nl-title-en', marker)
    await page.getByRole('button', { name: 'Save title' }).first().click()
    await expect(page.getByRole('button', { name: 'Save title' }).first()).toBeDisabled()

    await page.getByRole('button', { name: 'Publish now' }).click()
    await expect(page.locator('.nl-head .nl-next')).toContainText('On the website now')

    await page.getByRole('button', { name: '← All issues' }).click()
    const row = page.locator('.nl-row', { hasText: marker })
    await expect(row).toContainText('EN ✓')
    await expect(row).toContainText('FR missing')
    await expect(row).toContainText('Published')

    const ctx = await request.newContext()
    const feed = await (await ctx.get(`${API}/api/public/newsletters`)).json()
    await ctx.dispose()
    const item = feed.find(n => n.id === id)
    expect(item).toBeTruthy()
    expect(item.en.title).toBe(marker)
    expect(item.fr).toBeNull()
  })
})
