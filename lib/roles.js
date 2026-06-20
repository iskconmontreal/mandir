// Role parsing and user role utilities
// FEATURE: roles — extracted from lib/app.js for better organization

export function parseRoleNames(value) {
  if (!value) return []
  if (Array.isArray(value)) return uniq(value.flatMap(parseRoleNames))
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return []
    if ((raw.startsWith('{') || raw.startsWith('[')) && raw.length > 1) {
      try { return parseRoleNames(JSON.parse(raw)) } catch {}
    }
    if (raw.includes(',')) return uniq(raw.split(',').flatMap(parseRoleNames))
    return [raw]
  }
  if (typeof value !== 'object') return []
  return uniq([
    ...parseRoleNames(value.name),
    ...parseRoleNames(value.role),
    ...parseRoleNames(value.roles),
    ...parseRoleNames(value.role_name),
    ...parseRoleNames(value.meta?.roles),
    ...parseRoleNames(value.meta?.role),
    ...parseRoleNames(value.user?.roles),
    ...parseRoleNames(value.user?.role),
    ...parseRoleNames(value.data?.roles),
    ...parseRoleNames(value.data?.role),
  ])
}

function uniq(list) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    const value = String(item || '').trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

export function userRoleNames(user = null) {
  const u = user
  return uniq([
    ...parseRoleNames(u?.roles),
    ...parseRoleNames(u?.role),
    ...parseRoleNames(u?.meta?.roles),
    ...parseRoleNames(u?.meta?.role),
    ...parseRoleNames(u?.user?.roles),
    ...parseRoleNames(u?.user?.role),
    ...parseRoleNames(u?.data?.roles),
    ...parseRoleNames(u?.data?.role),
  ])
}

export function hasUserRole(user = null, role = '') {
  const want = String(role || '').trim().toLowerCase()
  return !!want && userRoleNames(user).some(name => name.toLowerCase() === want)
}

