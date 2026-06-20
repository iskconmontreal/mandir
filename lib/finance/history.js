// Finance audit trail and history utilities
// FEATURE: finance/history

import { fmtCat } from './formatters.js'

const ACTION_BADGES = { approve: 'approved', reject: 'rejected', paid: 'paid', closed: 'closed', submitted: 'submitted', edited: 'update', create: 'create' }
const ACTION_LABELS = { create: 'Created', approve: 'Approved', reject: 'Rejected', paid: 'Paid', closed: 'Closed', submitted: 'Submitted', edited: 'Updated' }

export function eventBadge(h) {
  return ACTION_BADGES[h.action] || h.action
}

export function eventLabel(h) {
  const base = ACTION_LABELS[h.action] || fmtCat(h.action)
  return h.count ? `${base} (${h.count})` : base
}

export function eventDetail(h) {
  const parts = []
  if (h.note) parts.push(h.note)
  if (h.ref) parts.push('Ref ' + h.ref)
  if (h.method) parts.push(fmtCat(h.method))
  return parts.join(' · ')
}

export function actorName(uid, names, myUid) {
  if (!uid) return ''
  if (uid === myUid) return 'you'
  return names[uid] || `User #${uid}`
}

export function changedAt(item) {
  return item?.updated_at || item?.created_at || ''
}

export function buildMetaHistory(item) {
  if (!item) return []
  const rows = []
  if (Array.isArray(item.history) && item.history.length) {
    for (const h of item.history) {
      rows.push({ action: h.action, user_id: h.by || null, created_at: h.at, note: h.note, method: h.method, ref: h.ref, count: h.count })
    }
  } else {
    // No history array — synthesize from timestamps
    if (item.created_at) rows.push({ action: 'create', user_id: item.created_by || null, created_at: item.created_at })
    if (item.updated_at && item.updated_at !== item.created_at) {
      rows.push({ action: 'update', user_id: item.updated_by || null, created_at: item.updated_at })
    }
  }
  return rows.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
}

export function parseMemberNames(items) {
  const names = {}, unames = {}, emails = {}
  for (const c of items) {
    const d = typeof c.data === 'string' ? JSON.parse(c.data) : c.data
    const nm = d.spiritual_name || d.name || d.email || 'Unknown'
    names[c.id] = nm
    if (d.email) emails[c.id] = d.email
    if (c.user_id) unames[c.user_id] = nm
  }
  return { names, unames, emails }
}
