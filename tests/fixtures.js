// fixtures.js — shared Playwright test helpers: named roles, tokens, loginAs

const mk = perms => 'header.' + btoa(JSON.stringify({ permissions: perms })) + '.sig'

export const API = 'https://api.iskconmontreal.ca'

export const TOKENS = {
  admin:     mk(['users:view', 'users:create', 'members:view', 'members:create', 'members:manage', 'donations:view', 'donations:create', 'expenses:view', 'expenses:create', 'expenses:approve']),
  treasurer: mk(['donations:view', 'donations:create', 'expenses:view', 'expenses:create', 'expenses:approve', 'members:view']),
  member:    mk(['expenses:view', 'expenses:create', 'members:view']),
  viewer:    mk([]),
}

export const USERS = {
  admin:     { name: 'Bhakti Devi',   email: 'admin@test.local',     meta: { name: 'Bhakti Devi' } },
  treasurer: { name: 'Bhaktin Maria', email: 'treasurer@test.local', meta: { name: 'Bhaktin Maria' } },
  member:    { name: 'Prabhu Das',    email: 'member@test.local',    meta: { name: 'Prabhu Das' } },
  viewer:    { name: 'Guest',         email: 'guest@test.local',     meta: { name: 'Guest' } },
}

export function loginAs(page, role = 'treasurer') {
  const token = TOKENS[role]
  const user = USERS[role] ?? USERS.treasurer
  return page.addInitScript(([t, u]) => {
    localStorage.setItem('mandala_token', t)
    localStorage.setItem('mandala_user', JSON.stringify(u))
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
