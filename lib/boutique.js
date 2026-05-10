// Pure business-logic helpers for the Boutique counter-sale view.
// No DOM, no browser APIs, no auth — safe to import in Vitest unit tests.

const _fmtAmt = c => ((c || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })

export const CAT_COLOR = {
  'Boutique':        'blue',
  'Books':           'teal',
  'Sankirtan Books': 'indigo',
  'Restaurant':      'amber',
  'Temple Donation': 'green',
}

export const CAT_VAR = {
  'Boutique':        'var(--c-cat-blue)',
  'Books':           'var(--c-cat-teal)',
  'Sankirtan Books': 'var(--c-cat-indigo)',
  'Restaurant':      'var(--c-cat-amber)',
  'Temple Donation': 'var(--c-cat-green)',
}

export const tagCls = c => 'cat-' + (CAT_COLOR[c] || 'gray')
export const catVar = c => CAT_VAR[c] || 'var(--c-cat-gray)'

export function localDayKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function localMonthKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function methodSlug(m) {
  return String(m || 'cash').toLowerCase().replace(/\s+/g, '-')
}

export function annotateCarts(carts) {
  return carts.map(raw => ({
    ...raw,
    donation: Math.max(0, (raw.collected_cents || 0) - (raw.due_cents || 0)),
  }))
}

// Builds the color-segmented breakdown bar for a day.
// Temple Donation items and cart-level overpayment donations are merged into
// a single green segment to avoid duplicate green bars.
export function buildBreakdown(day) {
  const total = day.collected || 1
  const segs = []
  let greenAmount = 0

  for (const entry of day.byCategory) {
    if (entry.category === 'Temple Donation') {
      greenAmount += entry.amount
    } else {
      segs.push({
        pct: (entry.amount / total) * 100,
        color: catVar(entry.category),
        title: `${entry.category}: $${_fmtAmt(entry.amount)} (${Math.round((entry.amount / total) * 100)}%)`,
      })
    }
  }
  greenAmount += day.donation

  if (greenAmount > 0) {
    segs.push({
      pct: (greenAmount / total) * 100,
      color: 'var(--c-cat-green)',
      title: `Donations: $${_fmtAmt(greenAmount)} (${Math.round((greenAmount / total) * 100)}%)`,
    })
  }

  return segs.filter(s => s.pct > 0).map(s => ({
    style: `--seg-color:${s.color};--seg-hover-color:${s.color};width:${Math.max(s.pct, 2)}%`,
    title: s.title,
  }))
}

export function buildDaysFromCarts(carts) {
  const days = {}
  for (const cart of carts) {
    const key = localDayKey(cart.occurred_at)
    if (!days[key]) days[key] = {
      key, carts: [], collected: 0, donation: 0, catTotals: {}, byCategory: [], breakdown: [],
    }
    const day = days[key]
    day.carts.push(cart)
    day.collected += cart.collected_cents || 0
    day.donation += cart.donation
    for (const item of (cart.items || [])) {
      const lt = (item.price_cents || 0) * (item.qty || 0)
      day.catTotals[item.category] = (day.catTotals[item.category] || 0) + lt
    }
  }
  const list = Object.values(days).sort((a, b) => b.key.localeCompare(a.key))
  for (const day of list) {
    day.carts.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
    day.byCategory = Object.entries(day.catTotals)
      .map(([category, amount]) => ({ category, amount }))
      .filter(e => e.amount > 0)
      .sort((a, b) => b.amount - a.amount)
    day.breakdown = buildBreakdown(day)
  }
  return list
}

export function monthAggregates(carts, monthKey) {
  let sales = 0, donations = 0, count = 0
  for (const cart of carts) {
    if (localMonthKey(cart.occurred_at) !== monthKey) continue
    sales += cart.collected_cents || 0
    donations += cart.donation
    count += 1
  }
  return { sales, donations, count }
}
