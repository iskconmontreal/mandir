// Roles & Permissions UI tests
// FEATURE: roles — admin CRUD + permission toggles

import { test, expect } from '@playwright/test'
import { loginAs, API } from './fixtures.js'

const ALL_PERMS = [
  'donations:view', 'donations:create',
  'expenses:view', 'expenses:create', 'expenses:approve',
  'members:view', 'members:create', 'members:manage',
  'roles:update',
]

function mockRoles(page, { roles = [] } = {}) {
  let nextId = roles.reduce((m, r) => Math.max(m, r.id), 0) + 1

  return page.route(`${API}/**`, async route => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const path = url.pathname

    if (path === '/api/roles' && method === 'GET') {
      const out = roles.map(r => ({ id: r.id, name: r.name, description: r.description, permissions: [...r.permissions] }))
      return route.fulfill({ json: { roles: out, all_permissions: ALL_PERMS } })
    }

    if (path === '/api/roles' && method === 'POST') {
      const body = route.request().postDataJSON()
      const r = { id: nextId++, name: body.name, description: body.description || '', permissions: body.permissions || [] }
      roles.push(r)
      return route.fulfill({ status: 201, json: { id: r.id, name: r.name, permissions: r.permissions.join(',') } })
    }

    const permMatch = path.match(/^\/api\/roles\/(\d+)\/permissions$/)
    if (permMatch && method === 'PUT') {
      const role = roles.find(r => r.id === +permMatch[1])
      const body = route.request().postDataJSON()
      if (role) {
        if (body.enabled) role.permissions = [...new Set([...role.permissions, body.permission_key])].sort()
        else role.permissions = role.permissions.filter(p => p !== body.permission_key)
      }
      return route.fulfill({ json: { status: 'success', permissions: role?.permissions.join(',') ?? '' } })
    }

    const resetMatch = path.match(/^\/api\/roles\/(\d+)\/reset$/)
    if (resetMatch && method === 'POST') {
      const role = roles.find(r => r.id === +resetMatch[1])
      if (role) role.permissions = [...role.defaultPerms]
      return route.fulfill({ json: { status: 'success', permissions: role?.permissions.join(',') ?? '' } })
    }

    const deleteMatch = path.match(/^\/api\/roles\/(\d+)$/)
    if (deleteMatch && method === 'DELETE') {
      const id = +deleteMatch[1]
      const i = roles.findIndex(r => r.id === id)
      if (i >= 0) roles.splice(i, 1)
      return route.fulfill({ json: { status: 'success' } })
    }

    route.fulfill({ json: {} })
  })
}

function mkRole(id, name, perms, desc = '') {
  return { id, name, description: desc, permissions: [...perms], defaultPerms: [...perms] }
}

async function openRoles(page) {
  await page.goto('/app/admin/roles/')
  await page.locator('.card').first().waitFor()
}

test.describe('roles & permissions', () => {
  let errors

  test.beforeEach(async ({ page }) => {
    errors = []
    page.on('pageerror', err => errors.push(err.message))
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
      if (msg.type() === 'warning' && msg.text().includes('Cycle')) errors.push(msg.text())
    })
    await loginAs(page, 'admin')
  })

  test.afterEach(() => { expect(errors).toEqual([]) })

  test('renders role cards with grouped permissions', async ({ page }) => {
    const roles = [
      mkRole(1, 'Admin', ['donations:view', 'expenses:view', 'members:view'], 'Full access'),
      mkRole(2, 'Viewer', ['donations:view'], 'Read only'),
    ]
    await mockRoles(page, { roles })
    await openRoles(page)

    const cards = page.locator('.card')
    await expect(cards).toHaveCount(2)
    await expect(cards.nth(0).locator('h3')).toHaveText('Admin')
    await expect(cards.nth(1).locator('h3')).toHaveText('Viewer')
    await expect(page.locator('.perm-scope').first()).toBeVisible()
  })

  test('admin creates new role via modal', async ({ page }) => {
    const roles = [mkRole(1, 'Existing', ['donations:view'])]
    await mockRoles(page, { roles })
    await openRoles(page)

    await page.getByRole('button', { name: '+ Add Role' }).click()
    await page.locator('.modal').waitFor()

    await page.fill('#r-name', 'Pujari')
    await page.fill('#r-desc', 'Temple duties')

    const modal = page.locator('.modal')
    const donationsRow = modal.locator('.perm-row', { has: page.locator('.perm-scope', { hasText: 'Donations' }) })
    await donationsRow.locator('.perm-check', { hasText: 'view' }).locator('input').check()

    await page.getByRole('button', { name: 'Create Role' }).click()
    await expect(page.locator('.modal')).toBeHidden()
    await expect(page.locator('.card')).toHaveCount(2)
  })

  test('admin toggles permission on existing role', async ({ page }) => {
    const roles = [mkRole(1, 'Sevaka', ['donations:view'])]
    await mockRoles(page, { roles })
    await openRoles(page)

    const card = page.locator('.card').first()
    const expRow = card.locator('.perm-row', { has: page.locator('.perm-scope', { hasText: 'Expenses' }) })
    const viewCheck = expRow.locator('.perm-check', { hasText: 'view' }).locator('input')

    await expect(viewCheck).not.toBeChecked()
    await viewCheck.check()
    await expect(viewCheck).toBeChecked()
  })

  test('admin unchecks permission on existing role', async ({ page }) => {
    const roles = [mkRole(1, 'Sevaka', ['donations:view', 'donations:create'])]
    await mockRoles(page, { roles })
    await openRoles(page)

    const card = page.locator('.card').first()
    const donRow = card.locator('.perm-row', { has: page.locator('.perm-scope', { hasText: 'Donations' }) })
    const createCheck = donRow.locator('.perm-check', { hasText: 'create' }).locator('input')

    await expect(createCheck).toBeChecked()
    await createCheck.uncheck()
    await expect(createCheck).not.toBeChecked()
  })

  test('admin resets role permissions to defaults', async ({ page }) => {
    const roles = [mkRole(1, 'Sevaka', ['donations:view', 'expenses:view'])]
    roles[0].permissions = ['donations:view', 'expenses:view', 'members:view']
    await mockRoles(page, { roles })
    await openRoles(page)

    const card = page.locator('.card').first()
    const memRow = card.locator('.perm-row', { has: page.locator('.perm-scope', { hasText: 'Members' }) })
    await expect(memRow.locator('.perm-check', { hasText: 'view' }).locator('input')).toBeChecked()

    await card.getByRole('button', { name: 'Reset' }).click()

    await expect(memRow.locator('.perm-check', { hasText: 'view' }).locator('input')).not.toBeChecked()
  })

  test('admin deletes a role', async ({ page }) => {
    const roles = [
      mkRole(1, 'Keep', ['donations:view']),
      mkRole(2, 'Remove', ['expenses:view']),
    ]
    await mockRoles(page, { roles })
    await openRoles(page)
    await expect(page.locator('.card')).toHaveCount(2)

    page.on('dialog', d => d.accept())
    await page.locator('.card').nth(1).getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('.card')).toHaveCount(1)
    await expect(page.locator('.card h3')).toHaveText('Keep')
  })

  test('delete shows confirm dialog and cancelling preserves role', async ({ page }) => {
    const roles = [mkRole(1, 'Protected', ['donations:view'])]
    await mockRoles(page, { roles })
    await openRoles(page)

    page.on('dialog', d => d.dismiss())
    await page.locator('.card').first().getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('.card')).toHaveCount(1)
    await expect(page.locator('.card h3')).toHaveText('Protected')
  })

  test('modal closes on backdrop click', async ({ page }) => {
    await mockRoles(page, { roles: [mkRole(1, 'R', [])] })
    await openRoles(page)

    await page.getByRole('button', { name: '+ Add Role' }).click()
    await page.locator('.modal').waitFor()

    await page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } })
    await expect(page.locator('.modal')).toBeHidden()
  })

  test('modal closes on X button', async ({ page }) => {
    await mockRoles(page, { roles: [mkRole(1, 'R', [])] })
    await openRoles(page)

    await page.getByRole('button', { name: '+ Add Role' }).click()
    await page.locator('.modal').waitFor()

    await page.locator('.modal-close').click()
    await expect(page.locator('.modal')).toBeHidden()
  })

  test('modify permissions across multiple roles', async ({ page }) => {
    const roles = [
      mkRole(1, 'Role A', ['donations:view']),
      mkRole(2, 'Role B', ['expenses:view']),
    ]
    await mockRoles(page, { roles })
    await openRoles(page)

    const cardA = page.locator('.card').nth(0)
    const cardB = page.locator('.card').nth(1)

    const aExpRow = cardA.locator('.perm-row', { has: page.locator('.perm-scope', { hasText: 'Expenses' }) })
    await aExpRow.locator('.perm-check', { hasText: 'view' }).locator('input').check()

    const bDonRow = cardB.locator('.perm-row', { has: page.locator('.perm-scope', { hasText: 'Donations' }) })
    await bDonRow.locator('.perm-check', { hasText: 'view' }).locator('input').check()

    await expect(aExpRow.locator('.perm-check', { hasText: 'view' }).locator('input')).toBeChecked()
    await expect(bDonRow.locator('.perm-check', { hasText: 'view' }).locator('input')).toBeChecked()

    await aExpRow.locator('.perm-check', { hasText: 'view' }).locator('input').uncheck()
    await expect(aExpRow.locator('.perm-check', { hasText: 'view' }).locator('input')).not.toBeChecked()
    await expect(bDonRow.locator('.perm-check', { hasText: 'view' }).locator('input')).toBeChecked()
  })
})
