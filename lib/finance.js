// Domain constants and formatters for finance features
// FEATURE: finance — shared across dashboard and finance pages

export const fmtCat = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—'

// Unified enums — single source for both expenses and income
export const CATS = ['admin', 'annadana', 'bhoga', 'books', 'building_fund', 'deity', 'equipment', 'festival', 'flowers', 'general', 'insurance', 'kitchen', 'maintenance', 'rent', 'salary', 'sunday_feast', 'travel', 'utilities', 'vehicle', 'other']
export const METHODS = ['cash', 'cheque', 'e-transfer', 'card', 'credit-card', 'debit', 'interac', 'direct-deposit', 'bank-deposit', 'wire', 'in-kind', 'other']
export const INCOME_TYPES = ['donation', 'sale', 'grant', 'interest', 'refund', 'rebate', 'other']

// Legacy aliases — consumed by existing form partials, filter dropdowns
export const DON_CATS = CATS
export const EXP_CATS = CATS
export const DON_METHODS = METHODS
export const EXP_METHODS = METHODS

export const STATUS_LABELS = { submitted: 'Approval', approved: 'Approved', paid: 'Paid', closed: 'Closed', rejected: 'Rejected' }
export const STATUS_ORDER = { submitted: 0, approved: 1, paid: 2, closed: 3, rejected: 4 }
export const AMT_MAX = 100_000

export const EXP_STATUSES = { submitted: 'var(--c-accent)', approved: 'var(--c-ok)', paid: 'var(--c-accent)', closed: 'var(--c-ok)', rejected: 'var(--c-err)' }

export const CAT_CLR = { deity: 'purple', deity_worship: 'purple', flowers: 'purple', bhoga: 'amber', kitchen: 'amber', sunday_feast: 'amber', annadana: 'amber', events: 'teal', festival: 'teal', travel: 'teal', vehicle: 'teal', admin: 'blue', book_distribution: 'blue', books: 'blue', salary: 'green', rent: 'brown', building_fund: 'brown', maintenance: 'brown', renovation: 'brown', equipment: 'brown', insurance: 'indigo', utilities: 'indigo' }
export const catCls = c => 'cat-' + (CAT_CLR[c] || 'gray')
export const catHex = c => `var(--c-cat-${CAT_CLR[c] || 'gray'})`
export const catBgHex = c => `var(--c-cat-${CAT_CLR[c] || 'gray'}-bg)`

export const DON_FIELDS = { Type: { id: 'type', label: 'type' }, Amount: { id: 'amount', label: 'amount' }, Method: { id: 'method', label: 'method' }, Category: { id: 'cat', label: 'category' }, DateReceived: { id: 'date', label: 'date' }, Note: { id: 'note', label: 'note' } }
export const EXP_FIELDS = { Payee: { id: 'vendor', label: 'payee' }, Amount: { id: 'amount', label: 'amount' }, Method: { id: 'exp-method', label: 'method' }, Category: { id: 'cat', label: 'category' }, ExpenseDate: { id: 'date', label: 'date' }, Note: { id: 'desc', label: 'note' } }

export const fmtStatus = s => STATUS_LABELS[s] || fmtCat(s)
export const expenseTitle = x => x?.payee || '—'
export const expenseModalTitle = x => x?.expense_no ? `Edit Expense #${x.expense_no}` : 'Edit Expense'
export const incomeModalTitle = x => x?.id ? `Edit Income #${x.id}` : 'Edit Income'

export const fmtMonthShort = k => { if (!k?.includes('-')) return 'Undated'; const [y, m] = k.split('-'); return new Date(+y, +m - 1).toLocaleString('default', { month: 'long' }) }
export const fmtMonth = k => { if (!k?.includes('-')) return 'Undated'; const [y, m] = k.split('-'); return new Date(+y, +m - 1).toLocaleString('default', { month: 'long', year: 'numeric' }) }

// Parse date string respecting local timezone.
// Date-only "2026-04-01" → local midnight (not UTC which shifts the day back in western TZs).
const parseLocal = d => !d ? null : new Date(typeof d === 'string' && !d.includes('T') ? d + 'T00:00:00' : d)

// Local-timezone month key: "2026-04-01T02:00Z" → local month, not raw-string month.
export const localMonthKey = d => { const dt = parseLocal(d); return dt && !isNaN(dt) ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` : 'unknown' }

export function fmtDate(d) {
  if (!d) return '—'
  const dt = parseLocal(d), now = new Date(), ms = now - dt
  if (ms > 0 && ms < 3600000) return Math.floor(ms / 60000) + 'm ago'
  if (ms > 0 && ms < 86400000) return Math.floor(ms / 3600000) + 'h ago'
  const sameYear = dt.getFullYear() === now.getFullYear()
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) })
}


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

// ── Normalizers ──
export const normTab = tab =>
  tab === 'donations' || tab === 'income' || tab === 'expenses' || tab === 'net' ? 'transactions' :
  (['transactions', 'donors', 'reports', 'shop-sales'].includes(tab) ? tab : 'transactions')
export const normIncomeType = value => INCOME_TYPES.includes(String(value || '').toLowerCase()) ? String(value || '').toLowerCase() : ''
export const normIncomeMethod = value => { const m = String(value || '').toLowerCase(); return METHODS.includes(m) ? m : '' }
export const normIncomeMethods = value => { const list = Array.isArray(value) ? value : String(value || '').split(','); return [...new Set(list.map(normIncomeMethod).filter(Boolean))] }
export const normExpenseCats = value => { const list = Array.isArray(value) ? value : String(value || '').split(','); return [...new Set(list.map(item => String(item || '').toLowerCase()).filter(cat => CATS.includes(cat)))] }
export const normAmt = v => { const n = parseInt(v, 10); return n > 0 ? n : '' }

// ── Data classifiers ──
export const bucketOf = x => (x.type || 'donation') === 'donation' ? (x.category || 'general') : (x.type || 'other')
export const labelOf = x => (x.type || 'donation') === 'donation' ? (x.category || 'general') : (x.type || 'other')
export const sourceOf = (x, names) => x.member_id ? (names[x.member_id] || x.source_name || '—') : (x.source_name || 'Anonymous')

// Display label that respects details.source for boutique-counter rows.
// Color (catCls) keeps reading the raw type/category — only the visible text changes here.
const _safeJSON = s => { try { return JSON.parse(s) } catch { return null } }
export function displayLabel(x) {
  const d = (typeof x?.details === 'string' ? _safeJSON(x.details) : x?.details) || {}
  if (d.source === 'boutique-counter')             return 'Shop Counter Sale'
  if (d.source === 'boutique-counter-donation')    return 'Counter Donation'
  if (d.source === 'boutique-counter-overpayment') return 'Counter Overpayment'
  return fmtCat(labelOf(x))
}

// ── Filter predicates ──
export const incomeTypeMatch = (row, filter) => { const type = row?.type || 'donation'; return !filter || type === filter }
export const incomeMethodMatch = (row, filters) => !filters?.length || filters.includes(normIncomeMethod(row?.method || 'cash'))
export const donorRowMatch = (row, search = '') => {
  const q = String(search || '').trim().toLowerCase()
  return !q || String(row?.name || '').toLowerCase().includes(q)
}
export const filterDonorRows = (rows, search = '') => (rows || []).filter(row => donorRowMatch(row, search))

// ── Date helpers ──
// Strip time from business dates — Go serializes time.Time as RFC3339
// even for date-only fields, causing UTC midnight → wrong local day at month boundaries.
export const dateOnly = d => typeof d === 'string' && d.length > 10 ? d.slice(0, 10) : d
export const expenseMonthKey = x => localMonthKey(dateOnly(x?.expense_date))
export const incomeMonthKey = x => localMonthKey(dateOnly(x?.date_received) || x?.created_at || x?.updated_at)
export const monthRange = key => { const [year, month] = key.split('-').map(Number); const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); return { dateFrom: `${key}-01`, dateTo: `${key}-${String(lastDay).padStart(2, '0')}` } }
export const expenseTxDate = x => dateOnly(x?.expense_date) || x?.created_at || ''
export const incomeTxDate = x => dateOnly(x?.date_received) || x?.created_at || ''
export const toNetTransactions = ({ expenses = [], income = [] } = {}) => [
  ...expenses.map(x => ({ ...x, _isExp: true, _date: expenseTxDate(x), _changedAt: changedAt(x) || x?.expense_date || '' })),
  ...income.map(d => ({ ...d, _isExp: false, _date: incomeTxDate(d), _changedAt: changedAt(d) || d?.date_received || '' })),
]

export function netTransactionMatch(tx, filters = {}, names = {}) {
  const q = String(filters.search || '').trim().toLowerCase()
  const filterType = filters.filterType || ''
  const isExpFilter = filterType === 'expense'
  const isIncFilter = filterType === 'income'
  const amount = tx?.amount || 0
  const date = (tx?._date || '').slice(0, 10)

  if (filters.amtMin && amount < filters.amtMin * 100) return false
  if (filters.amtMax && amount > filters.amtMax * 100) return false
  if (filters.dateFrom && date < filters.dateFrom) return false
  if (filters.dateTo && date > filters.dateTo) return false

  if (tx?._isExp) {
    if (isExpFilter && filters.expStatus && tx.status !== filters.expStatus) return false
    if (isExpFilter && filters.expCats?.length && !filters.expCats.includes(tx.category || 'other')) return false
    return !q || [tx.payee, tx.note, tx.category, tx.expense_no, fmtCat(tx.category)].filter(Boolean).join(' ').toLowerCase().includes(q)
  }

  if (isIncFilter && filters.incType && !incomeTypeMatch(tx, filters.incType)) return false
  if (isIncFilter && filters.incMethods?.length && !incomeMethodMatch(tx, filters.incMethods)) return false
  return !q || [tx.note, tx.method, tx.type, bucketOf(tx), sourceOf(tx, names)].filter(Boolean).join(' ').toLowerCase().includes(q)
}

export const filterNetTransactions = (items, filters = {}, names = {}) =>
  (items || []).filter(tx => netTransactionMatch(tx, filters, names))

export const filterNetTransactionsByType = (items, type = '') => {
  if (!type) return items || []
  const isExp = type === 'expense'
  return (items || []).filter(tx => !!tx?._isExp === isExp)
}

export const sortNetTransactions = items => [...(items || [])].sort((a, b) =>
  (b._date || '').localeCompare(a._date || '')
  || (b._changedAt || '').localeCompare(a._changedAt || '')
  || (b.id || 0) - (a.id || 0)
)

export function buildNetMonthGroups(keys, items) {
  const byKey = monthItemMap(keys, items, tx => localMonthKey(tx._date))
  return (keys || []).map(key => {
    const monthItems = sortNetTransactions(byKey[key] || [])
    let incTotal = 0, expTotal = 0, incCount = 0, expCount = 0
    for (const tx of monthItems) {
      if (tx._isExp) { expTotal += tx.amount || 0; expCount++ }
      else { incTotal += tx.amount || 0; incCount++ }
    }
    return { key, items: monthItems, count: monthItems.length, total: incTotal + expTotal, net: incTotal - expTotal, incCount, expCount, incTotal, expTotal }
  })
}

// ── Month state ──
export const monthOpenState = (keys, prev = {}, currentKey, prevKey) => {
  const next = {}
  for (const key of keys || []) {
    if (key in (prev || {})) next[key] = !!prev[key]
    else if (key === currentKey || key === prevKey) next[key] = true
  }
  return next
}
export const monthKeysWithData = (baseKeys, items, keyOf, currentKey) => {
  const keys = new Set(baseKeys)
  for (const item of items || []) {
    const key = keyOf(item)
    if (key && key !== 'unknown' && key <= currentKey) keys.add(key)
  }
  return [...keys].filter(k => k === 'unknown' || k <= currentKey).sort((a, b) => {
    if (a === 'unknown') return 1
    if (b === 'unknown') return -1
    return b.localeCompare(a)
  })
}
export const monthItemMap = (keys, items, keyOf) => {
  const map = Object.fromEntries((keys || []).map(key => [key, []]))
  for (const item of items || []) {
    const key = keyOf(item)
    if (!map[key]) map[key] = []
    map[key].push(item)
  }
  return map
}

// ── Data grouping ──
export const buildMonthGroups = ({ keys, itemsByKey, metaByKey = {}, filterItem = null, sortItems = list => list, useMeta = false }) => (keys || []).map(key => {
  const raw = itemsByKey?.[key] || []
  const items = sortItems(raw.filter(item => filterItem ? filterItem(item) : true))
  const meta = metaByKey?.[key] || { count: 0, total: 0 }
  const count = useMeta ? (meta.count || 0) : items.length
  const total = useMeta ? (meta.total || 0) : items.reduce((sum, item) => sum + (item.amount || 0), 0)
  return { key, items, count, total }
})
export const groupMonthsByYear = months => {
  const groups = []
  for (const month of months || []) {
    const key = month.key.includes('-') ? month.key.slice(0, 4) : 'unknown'
    const prev = groups[groups.length - 1]
    if (!prev || prev.key !== key) groups.push({ key, items: [month] })
    else prev.items.push(month)
  }
  return groups
}

// ── Sort ──
const expenseSortDate = x => changedAt(x) || x?.expense_date || ''
export const sortExpenses = list => [...list].sort((a, b) => {
  const st = (STATUS_ORDER[a?.status || 'submitted'] ?? 9) - (STATUS_ORDER[b?.status || 'submitted'] ?? 9)
  if (st) return st
  const ad = expenseSortDate(a), bd = expenseSortDate(b)
  if (ad !== bd) return bd > ad ? 1 : -1
  const ae = a?.expense_date || '', be = b?.expense_date || ''
  if (ae !== be) return be > ae ? 1 : -1
  return (b?.id || 0) - (a?.id || 0)
})
const incomeSortDate = x => x?.date_received || x?.created_at || changedAt(x) || ''
const incomeChangedDate = x => changedAt(x) || x?.created_at || ''
export const sortIncome = list => [...list].sort((a, b) => {
  const ad = incomeSortDate(a), bd = incomeSortDate(b)
  if (ad !== bd) return bd > ad ? 1 : -1
  const au = incomeChangedDate(a), bu = incomeChangedDate(b)
  if (au !== bu) return bu > au ? 1 : -1
  const ae = a?.date_received || '', be = b?.date_received || ''
  if (ae !== be) return be > ae ? 1 : -1
  return (b?.id || 0) - (a?.id || 0)
})

// ── Stats ──
export const HIST_BINS = 20
export function amtHist(items, ceil) {
  if (!items.length || !ceil) return []
  const bins = new Array(HIST_BINS).fill(0)
  const ceilLog = Math.log(ceil + 1)
  for (const r of items) { const a = (r.amount || 0) / 100; if (a > 0) bins[Math.min(Math.floor(Math.log(a + 1) / ceilLog * HIST_BINS), HIST_BINS - 1)]++ }
  const max = Math.max(1, ...bins)
  return bins.map(n => n / max)
}

// ── Trend helpers ──
export function trend(cur, prev, invert) {
  if (!cur && !prev) return { cls: '', dir: '', num: '', label: 'No data yet' }
  if (!prev) return { cls: '', dir: '', num: '', label: 'New this month' }
  const pct = Math.round((cur - prev) / prev * 100)
  if (pct === 0) return { cls: '', dir: '', num: '', label: 'Same as last month' }
  const cls = (pct > 0) !== !!invert ? 'stat-ok' : 'stat-err'
  return { cls, dir: pct > 0 ? 'up' : 'down', num: (pct > 0 ? '+' : '') + pct + '%', label: ' from last month' }
}
export function trendDiff(cur, prev) {
  if (!cur && !prev) return { cls: '', dir: '', num: '', label: 'No data yet' }
  const d = cur - prev
  if (d === 0) return { cls: '', dir: '', num: '', label: 'Same as last month' }
  return { cls: d > 0 ? 'stat-ok' : 'stat-err', dir: d > 0 ? 'up' : 'down', num: (d > 0 ? '+' : '') + d, label: ' from last month' }
}

export function setErr(msg, prefix, fields) {
  document.querySelectorAll('.field-err').forEach(el => el.classList.remove('field-err'))
  const matches = [...msg.matchAll(/validation for '(\w+)'/g)]
  if (!matches.length) return msg
  const names = []
  for (const [, f] of matches) {
    const m = fields?.[f]
    names.push(m?.label || f.toLowerCase())
    if (m?.id) document.getElementById(`${prefix}-${m.id}`)?.classList.add('field-err')
  }
  return 'Required: ' + names.join(', ')
}
