// fixtures.js — shared Playwright test helpers: named roles, tokens, loginAs

const mk = (perms, uid) => 'header.' + btoa(JSON.stringify({ permissions: perms, user_id: uid })) + '.sig'

export const API = 'https://api.iskconmontreal.ca'

export const TOKENS = {
  admin:     mk(['users:view', 'users:create', 'members:view', 'members:create', 'members:manage', 'income:view', 'income:create', 'expenses:view', 'expenses:create', 'expenses:approve', 'roles:update', 'settings:manage'], 1),
  president: mk(['members:view', 'income:view', 'expenses:view', 'settings:manage'], 6),
  treasurer: mk(['income:view', 'income:create', 'expenses:view', 'expenses:create', 'expenses:approve', 'members:view'], 2),
  member:    mk(['expenses:view', 'expenses:create', 'members:view'], 3),
  approver:  mk(['audit:view', 'income:view', 'expenses:approve', 'expenses:create', 'expenses:view', 'members:view', 'users:view'], 5),
  viewer:    mk(['income:view', 'expenses:create', 'expenses:view'], 4),
}

export const USERS = {
  admin:     { name: 'Bhakti Devi',   email: 'admin@test.local',     meta: { name: 'Bhakti Devi' }, roles: ['Administrator'] },
  president: { name: 'Temple President', email: 'president@test.local', meta: { name: 'Temple President' }, roles: ['President'] },
  treasurer: { name: 'Bhaktin Maria', email: 'treasurer@test.local', meta: { name: 'Bhaktin Maria' } },
  member:    { name: 'Prabhu Das',    email: 'member@test.local',    meta: { name: 'Prabhu Das' } },
  approver:  { name: 'Approver',      email: 'approver@test.local',  meta: { name: 'Approver' } },
  viewer:    { name: 'Guest',         email: 'guest@test.local',     meta: { name: 'Guest' } },
}

export function loginAs(page, role = 'treasurer') {
  const token = TOKENS[role]
  const user = USERS[role] ?? USERS.treasurer
  return page.addInitScript(([t, u]) => {
    localStorage.setItem('mandir_token', t)
    localStorage.setItem('mandir_user', JSON.stringify(u))
  }, [token, user])
}

export function mockAPI(page, overrides = {}) {
  return page.route(`${API}/**`, async route => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const path = url.pathname

    for (const [pattern, handler] of Object.entries(overrides)) {
      const re = typeof pattern === 'string' ? new RegExp('^' + pattern.replace(/\*/g, '.*') + '$') : pattern
      if (re.test(path + (method !== 'GET' ? ':' + method : ''))) {
        return handler(route, { path, method, url })
      }
    }

    route.fulfill({ json: { items: [], total: 0 } })
  })
}
