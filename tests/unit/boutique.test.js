import { describe, it, expect } from 'vitest'
import {
  tagCls, localDayKey, localMonthKey, methodSlug,
  annotateCarts, buildDaysFromCarts, monthAggregates, buildBreakdown,
} from '../../lib/boutique.js'

// ── Helpers used across tests ──────────────────────────────────────────────

function makeCart(overrides = {}) {
  return {
    id: 1,
    occurred_at: '2026-05-09T14:00:00Z',
    due_cents: 1000,
    collected_cents: 1000,
    payment_method: 'Cash',
    items: [],
    donation: 0,
    ...overrides,
  }
}

function makeDay(overrides = {}) {
  return {
    key: '2026-05-09',
    carts: [],
    collected: 1000,
    donation: 0,
    catTotals: {},
    byCategory: [],
    breakdown: [],
    ...overrides,
  }
}

// ── tagCls ─────────────────────────────────────────────────────────────────

describe('tagCls', () => {
  it('maps Boutique → cat-blue', () => expect(tagCls('Boutique')).toBe('cat-blue'))
  it('maps Books → cat-teal', () => expect(tagCls('Books')).toBe('cat-teal'))
  it('maps Sankirtan Books → cat-indigo', () => expect(tagCls('Sankirtan Books')).toBe('cat-indigo'))
  it('maps Restaurant → cat-amber', () => expect(tagCls('Restaurant')).toBe('cat-amber'))
  it('maps Temple Donation → cat-green', () => expect(tagCls('Temple Donation')).toBe('cat-green'))
  it('returns cat-gray for unknown category', () => expect(tagCls('Whatever')).toBe('cat-gray'))
  it('returns cat-gray for empty string', () => expect(tagCls('')).toBe('cat-gray'))
})

// ── localDayKey ────────────────────────────────────────────────────────────

describe('localDayKey', () => {
  it('returns YYYY-MM-DD string', () => {
    const key = localDayKey('2026-05-09T14:30:00Z')
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('produces a consistent key for the same local date', () => {
    const a = localDayKey('2026-05-09T00:00:00Z')
    const b = localDayKey('2026-05-09T23:59:59Z')
    // both within the same UTC day — may differ in local TZ, but format is consistent
    expect(a).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(b).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ── localMonthKey ──────────────────────────────────────────────────────────

describe('localMonthKey', () => {
  it('returns YYYY-MM string', () => {
    const key = localMonthKey('2026-05-09T14:30:00Z')
    expect(key).toMatch(/^\d{4}-\d{2}$/)
  })

  it('is a prefix of localDayKey for the same timestamp', () => {
    const ts = '2026-05-09T14:30:00Z'
    expect(localDayKey(ts).startsWith(localMonthKey(ts))).toBe(true)
  })
})

// ── methodSlug ─────────────────────────────────────────────────────────────

describe('methodSlug', () => {
  it('lowercases Cash', () => expect(methodSlug('Cash')).toBe('cash'))
  it('replaces spaces with dashes', () => expect(methodSlug('E-Transfer')).toBe('e-transfer'))
  it('handles multi-word methods', () => expect(methodSlug('Credit Card')).toBe('credit-card'))
  it('returns "cash" for null', () => expect(methodSlug(null)).toBe('cash'))
  it('returns "cash" for empty string', () => expect(methodSlug('')).toBe('cash'))
})

// ── annotateCarts ──────────────────────────────────────────────────────────

describe('annotateCarts', () => {
  it('sets donation = 0 when collected equals due', () => {
    const [cart] = annotateCarts([makeCart({ due_cents: 500, collected_cents: 500 })])
    expect(cart.donation).toBe(0)
  })

  it('computes donation as collected minus due on overpayment', () => {
    const [cart] = annotateCarts([makeCart({ due_cents: 500, collected_cents: 700 })])
    expect(cart.donation).toBe(200)
  })

  it('clamps donation to 0 when collected < due', () => {
    const [cart] = annotateCarts([makeCart({ due_cents: 500, collected_cents: 400 })])
    expect(cart.donation).toBe(0)
  })

  it('preserves all original cart fields', () => {
    const raw = makeCart({ id: 99, payment_method: 'Card' })
    const [cart] = annotateCarts([raw])
    expect(cart.id).toBe(99)
    expect(cart.payment_method).toBe('Card')
  })
})

// ── monthAggregates ────────────────────────────────────────────────────────

describe('monthAggregates', () => {
  const carts = annotateCarts([
    makeCart({ occurred_at: '2026-05-01T10:00:00Z', collected_cents: 1000, due_cents: 1000 }),
    makeCart({ occurred_at: '2026-05-15T10:00:00Z', collected_cents: 2000, due_cents: 1800 }),
    makeCart({ occurred_at: '2026-04-20T10:00:00Z', collected_cents: 500,  due_cents: 500 }),
  ])

  it('sums sales for the target month', () => {
    const { sales } = monthAggregates(carts, '2026-05')
    expect(sales).toBe(3000)
  })

  it('sums donations for the target month', () => {
    const { donations } = monthAggregates(carts, '2026-05')
    expect(donations).toBe(200)
  })

  it('counts carts in the target month', () => {
    const { count } = monthAggregates(carts, '2026-05')
    expect(count).toBe(2)
  })

  it('ignores carts from other months', () => {
    const { sales, count } = monthAggregates(carts, '2026-04')
    expect(sales).toBe(500)
    expect(count).toBe(1)
  })

  it('returns zeros when no carts match', () => {
    const result = monthAggregates(carts, '2025-01')
    expect(result).toEqual({ sales: 0, donations: 0, count: 0 })
  })
})

// ── buildDaysFromCarts ─────────────────────────────────────────────────────

describe('buildDaysFromCarts', () => {
  const carts = annotateCarts([
    makeCart({
      id: 1,
      occurred_at: '2026-05-08T10:00:00Z',
      collected_cents: 1000,
      due_cents: 1000,
      items: [{ name: 'Kurta', qty: 1, price_cents: 1000, category: 'Boutique' }],
    }),
    makeCart({
      id: 2,
      occurred_at: '2026-05-09T10:00:00Z',
      collected_cents: 500,
      due_cents: 500,
      items: [{ name: 'Pizza', qty: 1, price_cents: 500, category: 'Restaurant' }],
    }),
    makeCart({
      id: 3,
      occurred_at: '2026-05-09T12:00:00Z',
      collected_cents: 300,
      due_cents: 300,
      items: [{ name: 'Book', qty: 1, price_cents: 300, category: 'Books' }],
    }),
  ])

  const days = buildDaysFromCarts(carts)

  it('groups carts by local date', () => {
    expect(days).toHaveLength(2)
  })

  it('sorts days newest-first', () => {
    expect(days[0].key > days[1].key).toBe(true)
  })

  it('sums collected_cents per day', () => {
    const may9 = days[0]
    expect(may9.collected).toBe(800)
  })

  it('builds byCategory sorted by amount descending', () => {
    const may9 = days[0]
    expect(may9.byCategory[0].category).toBe('Restaurant')
    expect(may9.byCategory[0].amount).toBe(500)
  })

  it('populates breakdown for each day', () => {
    expect(days[0].breakdown.length).toBeGreaterThan(0)
  })
})

// ── buildBreakdown ─────────────────────────────────────────────────────────

describe('buildBreakdown', () => {
  it('single Boutique-only day → one blue segment at ~100%', () => {
    const day = makeDay({
      collected: 1000,
      donation: 0,
      byCategory: [{ category: 'Boutique', amount: 1000 }],
    })
    const segs = buildBreakdown(day)
    expect(segs).toHaveLength(1)
    expect(segs[0].style).toContain('var(--c-cat-blue)')
  })

  it('merges Temple Donation items + overpayment into a single green segment', () => {
    const day = makeDay({
      collected: 1000,
      donation: 150,
      byCategory: [
        { category: 'Boutique',       amount: 500 },
        { category: 'Temple Donation', amount: 350 },
      ],
    })
    const segs = buildBreakdown(day)
    const greenSegs = segs.filter(s => s.style.includes('var(--c-cat-green)'))
    expect(greenSegs).toHaveLength(1)
  })

  it('does NOT produce two green segments when both Temple Donation and donation are present', () => {
    const day = makeDay({
      collected: 1000,
      donation: 100,
      byCategory: [
        { category: 'Temple Donation', amount: 200 },
        { category: 'Restaurant',      amount: 700 },
      ],
    })
    const segs = buildBreakdown(day)
    const greenSegs = segs.filter(s => s.style.includes('var(--c-cat-green)'))
    expect(greenSegs).toHaveLength(1)
  })

  it('enforces minimum segment width of 2%', () => {
    const day = makeDay({
      collected: 10000,
      donation: 0,
      byCategory: [
        { category: 'Boutique',    amount: 9990 },
        { category: 'Restaurant',  amount: 10 },
      ],
    })
    const segs = buildBreakdown(day)
    for (const seg of segs) {
      const match = seg.style.match(/width:([0-9.]+)%/)
      expect(Number(match[1])).toBeGreaterThanOrEqual(2)
    }
  })

  it('each segment style contains --seg-color and width', () => {
    const day = makeDay({
      collected: 1000,
      donation: 0,
      byCategory: [{ category: 'Books', amount: 1000 }],
    })
    const [seg] = buildBreakdown(day)
    expect(seg.style).toContain('--seg-color')
    expect(seg.style).toContain('width:')
    expect(seg.title).toContain('Books')
  })

  it('returns empty array when day has no data', () => {
    const day = makeDay({ collected: 0, donation: 0, byCategory: [] })
    expect(buildBreakdown(day)).toEqual([])
  })
})
