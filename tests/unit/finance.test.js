import { describe, it, expect } from 'vitest'
import {
  normTab, normIncomeType, normIncomeMethod, normIncomeMethods, normExpenseCats, normAmt,
  bucketOf, labelOf, displayLabel, sourceOf,
  incomeTypeMatch, incomeMethodMatch, filterDonorRows,
  dateOnly, expenseMonthKey, incomeMonthKey, monthRange,
  monthOpenState, monthKeysWithData, monthItemMap,
  buildMonthGroups, buildNetMonthGroups, filterNetTransactions, filterNetTransactionsByType, groupMonthsByYear, toNetTransactions,
  sortExpenses, sortIncome,
  HIST_BINS, amtHist,
  trend, trendDiff,
  localMonthKey, changedAt, STATUS_ORDER,
} from '../../lib/finance.js'

describe('displayLabel', () => {
  it('returns "Shop Counter Sale" for source=boutique-counter', () => {
    expect(displayLabel({ type: 'sale', details: { source: 'boutique-counter' } })).toBe('Shop Counter Sale')
  })
  it('returns "Counter Donation" for source=boutique-counter-donation', () => {
    expect(displayLabel({ type: 'donation', category: 'general', details: { source: 'boutique-counter-donation' } })).toBe('Counter Donation')
  })
  it('returns "Counter Overpayment" for source=boutique-counter-overpayment', () => {
    expect(displayLabel({ type: 'donation', details: { source: 'boutique-counter-overpayment' } })).toBe('Counter Overpayment')
  })
  it('parses string details JSON', () => {
    expect(displayLabel({ type: 'sale', details: '{"source":"boutique-counter"}' })).toBe('Shop Counter Sale')
  })
  it('falls back to fmtCat(labelOf(x)) for unrelated sources', () => {
    expect(displayLabel({ type: 'donation', category: 'building_fund' })).toBe('Building Fund')
    expect(displayLabel({ type: 'grant' })).toBe('Grant')
  })
  it('falls back gracefully when details is missing or unparseable', () => {
    expect(displayLabel({ type: 'sale' })).toBe('Sale')
    expect(displayLabel({ type: 'sale', details: 'not-json' })).toBe('Sale')
  })
})

// ── normTab ──
describe('normTab', () => {
  it('maps legacy income tabs → transactions', () => {
    expect(normTab('donations')).toBe('transactions')
    expect(normTab('income')).toBe('transactions')
    expect(normTab('expenses')).toBe('transactions')
  })
  it('maps net → transactions', () => expect(normTab('net')).toBe('transactions'))
  it('passes valid tabs through', () => {
    expect(normTab('transactions')).toBe('transactions')
    expect(normTab('donors')).toBe('donors')
    expect(normTab('reports')).toBe('reports')
  })
  it('defaults invalid to transactions', () => expect(normTab('bogus')).toBe('transactions'))
  it('defaults empty to transactions', () => expect(normTab('')).toBe('transactions'))
})

// ── normIncomeType ──
describe('normIncomeType', () => {
  it('accepts valid types', () => expect(normIncomeType('donation')).toBe('donation'))
  it('lowercases', () => expect(normIncomeType('SALE')).toBe('sale'))
  it('rejects invalid', () => expect(normIncomeType('bogus')).toBe(''))
  it('handles null', () => expect(normIncomeType(null)).toBe(''))
})

// ── normIncomeMethod ──
describe('normIncomeMethod', () => {
  it('accepts valid', () => expect(normIncomeMethod('cash')).toBe('cash'))
  it('lowercases', () => expect(normIncomeMethod('E-TRANSFER')).toBe('e-transfer'))
  it('rejects invalid', () => expect(normIncomeMethod('bitcoin')).toBe(''))
  it('handles null', () => expect(normIncomeMethod(null)).toBe(''))
})

// ── normIncomeMethods ──
describe('normIncomeMethods', () => {
  it('parses comma string', () => expect(normIncomeMethods('cash,cheque')).toEqual(['cash', 'cheque']))
  it('accepts array', () => expect(normIncomeMethods(['cash', 'card'])).toEqual(['cash', 'card']))
  it('filters invalid', () => expect(normIncomeMethods('cash,bitcoin')).toEqual(['cash']))
  it('deduplicates', () => expect(normIncomeMethods('cash,cash')).toEqual(['cash']))
})

// ── normExpenseCats ──
describe('normExpenseCats', () => {
  it('parses comma string', () => expect(normExpenseCats('admin,rent')).toEqual(['admin', 'rent']))
  it('accepts array', () => expect(normExpenseCats(['admin', 'other'])).toEqual(['admin', 'other']))
  it('filters invalid', () => expect(normExpenseCats('admin,fake')).toEqual(['admin']))
})

// ── normAmt ──
describe('normAmt', () => {
  it('parses positive int', () => expect(normAmt('42')).toBe(42))
  it('rejects zero', () => expect(normAmt('0')).toBe(''))
  it('rejects negative', () => expect(normAmt('-5')).toBe(''))
  it('rejects NaN', () => expect(normAmt('abc')).toBe(''))
})

// ── bucketOf / labelOf / sourceOf ──
describe('classifiers', () => {
  it('bucketOf donation → category', () => expect(bucketOf({ type: 'donation', category: 'deity' })).toBe('deity'))
  it('bucketOf non-donation → type', () => expect(bucketOf({ type: 'grant' })).toBe('grant'))
  it('bucketOf default → general', () => expect(bucketOf({})).toBe('general'))
  it('labelOf mirrors bucketOf', () => expect(labelOf({ type: 'sale' })).toBe('sale'))
  it('sourceOf with member', () => expect(sourceOf({ member_id: 1 }, { 1: 'Govinda' })).toBe('Govinda'))
  it('sourceOf anonymous', () => expect(sourceOf({}, {})).toBe('Anonymous'))
  it('sourceOf with source_name', () => expect(sourceOf({ source_name: 'Corp' }, {})).toBe('Corp'))
})

// ── filter predicates ──
describe('incomeTypeMatch', () => {
  it('passes when no filter', () => expect(incomeTypeMatch({ type: 'donation' }, '')).toBe(true))
  it('passes matching', () => expect(incomeTypeMatch({ type: 'sale' }, 'sale')).toBe(true))
  it('rejects non-matching', () => expect(incomeTypeMatch({ type: 'sale' }, 'donation')).toBe(false))
  it('defaults type to donation', () => expect(incomeTypeMatch({}, 'donation')).toBe(true))
})

describe('incomeMethodMatch', () => {
  it('passes when no filters', () => expect(incomeMethodMatch({}, [])).toBe(true))
  it('passes matching', () => expect(incomeMethodMatch({ method: 'cash' }, ['cash'])).toBe(true))
  it('rejects non-matching', () => expect(incomeMethodMatch({ method: 'card' }, ['cash'])).toBe(false))
})

describe('filterDonorRows', () => {
  it('filters donors by name', () => {
    const rows = [{ name: 'Madhava Das' }, { name: 'Gita Devi' }]
    expect(filterDonorRows(rows, 'gita')).toEqual([{ name: 'Gita Devi' }])
  })

  it('returns all donors without search', () => {
    const rows = [{ name: 'A' }, { name: 'B' }]
    expect(filterDonorRows(rows, '')).toEqual(rows)
  })
})

// ── dateOnly ──
describe('dateOnly', () => {
  it('strips time from RFC3339', () => expect(dateOnly('2025-01-15T05:00:00Z')).toBe('2025-01-15'))
  it('keeps date-only strings', () => expect(dateOnly('2025-01-15')).toBe('2025-01-15'))
  it('handles non-string', () => expect(dateOnly(null)).toBe(null))
})

// ── monthRange ──
describe('monthRange', () => {
  it('returns correct range', () => {
    expect(monthRange('2025-02')).toEqual({ dateFrom: '2025-02-01', dateTo: '2025-02-28' })
  })
  it('handles leap year', () => {
    expect(monthRange('2024-02')).toEqual({ dateFrom: '2024-02-01', dateTo: '2024-02-29' })
  })
  it('handles 31-day month', () => {
    expect(monthRange('2025-01')).toEqual({ dateFrom: '2025-01-01', dateTo: '2025-01-31' })
  })
})

// ── expenseMonthKey / incomeMonthKey ──
describe('month key extractors', () => {
  it('expenseMonthKey extracts from expense_date', () => {
    expect(expenseMonthKey({ expense_date: '2025-03-15' })).toBe('2025-03')
  })
  it('expenseMonthKey strips time', () => {
    expect(expenseMonthKey({ expense_date: '2025-03-15T05:00:00Z' })).toBe('2025-03')
  })
  it('incomeMonthKey extracts from date_received', () => {
    expect(incomeMonthKey({ date_received: '2025-04-01' })).toBe('2025-04')
  })
  it('incomeMonthKey falls back to created_at', () => {
    expect(incomeMonthKey({ created_at: '2025-05-10T12:00:00Z' })).toBe('2025-05')
  })
})

// ── monthOpenState ──
describe('monthOpenState', () => {
  it('opens current and prev month by default', () => {
    const result = monthOpenState(['2025-06', '2025-05', '2025-04'], {}, '2025-06', '2025-05')
    expect(result['2025-06']).toBe(true)
    expect(result['2025-05']).toBe(true)
    expect(result['2025-04']).toBeUndefined()
  })
  it('preserves previous state', () => {
    const result = monthOpenState(['2025-06', '2025-05'], { '2025-06': false }, '2025-06', '2025-05')
    expect(result['2025-06']).toBe(false)
    expect(result['2025-05']).toBe(true)
  })
})

// ── monthKeysWithData ──
describe('monthKeysWithData', () => {
  it('merges base keys with data keys', () => {
    const items = [{ expense_date: '2024-11-01' }]
    const result = monthKeysWithData(['2025-01'], items, i => localMonthKey(i.expense_date), '2025-01')
    expect(result).toContain('2025-01')
    expect(result).toContain('2024-11')
  })
  it('excludes future keys', () => {
    const items = [{ expense_date: '2099-01-01' }]
    const result = monthKeysWithData(['2025-01'], items, i => localMonthKey(i.expense_date), '2025-01')
    expect(result).not.toContain('2099-01')
  })
  it('sorts descending with unknown last', () => {
    const result = monthKeysWithData(['2025-01', '2024-12', 'unknown'], [], () => '', '2025-01')
    expect(result[result.length - 1]).toBe('unknown')
    expect(result[0]).toBe('2025-01')
  })
})

// ── monthItemMap ──
describe('monthItemMap', () => {
  it('groups items by key', () => {
    const items = [
      { expense_date: '2025-01-05' },
      { expense_date: '2025-01-20' },
      { expense_date: '2025-02-10' },
    ]
    const keyOf = i => i.expense_date.slice(0, 7)
    const result = monthItemMap(['2025-01', '2025-02'], items, keyOf)
    expect(result['2025-01']).toHaveLength(2)
    expect(result['2025-02']).toHaveLength(1)
  })
  it('creates empty arrays for keys without items', () => {
    const result = monthItemMap(['2025-03'], [], () => 'x')
    expect(result['2025-03']).toEqual([])
  })
})

// ── buildMonthGroups ──
describe('buildMonthGroups', () => {
  it('builds groups with counts and totals', () => {
    const items = { '2025-01': [{ amount: 1000 }, { amount: 2000 }] }
    const result = buildMonthGroups({ keys: ['2025-01'], itemsByKey: items })
    expect(result[0].key).toBe('2025-01')
    expect(result[0].count).toBe(2)
    expect(result[0].total).toBe(3000)
  })
  it('applies filterItem', () => {
    const items = { '2025-01': [{ amount: 1000 }, { amount: 5000 }] }
    const result = buildMonthGroups({ keys: ['2025-01'], itemsByKey: items, filterItem: i => i.amount > 2000 })
    expect(result[0].count).toBe(1)
    expect(result[0].total).toBe(5000)
  })
  it('uses meta when useMeta is true', () => {
    const items = { '2025-01': [{ amount: 1000 }] }
    const meta = { '2025-01': { count: 10, total: 50000 } }
    const result = buildMonthGroups({ keys: ['2025-01'], itemsByKey: items, metaByKey: meta, useMeta: true })
    expect(result[0].count).toBe(10)
    expect(result[0].total).toBe(50000)
  })
})

describe('net transaction selectors', () => {
  const expenses = [
    { id: 1, amount: 1200, payee: 'Hydro', category: 'utilities', expense_date: '2025-01-10', status: 'submitted' },
    { id: 2, amount: 800, payee: 'Flowers', category: 'flowers', expense_date: '2025-02-03', status: 'paid' },
  ]
  const income = [
    { id: 3, amount: 5000, member_id: 7, method: 'cash', type: 'donation', category: 'general', date_received: '2025-01-12' },
  ]

  it('normalizes expenses and income into transaction rows', () => {
    const rows = toNetTransactions({ expenses, income })
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ id: 1, _isExp: true, _date: '2025-01-10' })
    expect(rows[2]).toMatchObject({ id: 3, _isExp: false, _date: '2025-01-12' })
  })

  it('filters by type-specific fields only when that type is selected', () => {
    const rows = toNetTransactions({ expenses, income })
    expect(filterNetTransactions(rows, { filterType: 'expense', expCats: ['utilities'] }, { 7: 'Govinda' }).map(x => x.id)).toEqual([1, 3])
    expect(filterNetTransactionsByType(filterNetTransactions(rows, { filterType: 'expense', expCats: ['utilities'] }, { 7: 'Govinda' }), 'expense').map(x => x.id)).toEqual([1])
  })

  it('groups net transactions by month with signed totals', () => {
    const rows = toNetTransactions({ expenses, income })
    const groups = buildNetMonthGroups(['2025-02', '2025-01'], rows)
    expect(groups[0]).toMatchObject({ key: '2025-02', expTotal: 800, incTotal: 0, net: -800 })
    expect(groups[1]).toMatchObject({ key: '2025-01', expTotal: 1200, incTotal: 5000, net: 3800 })
  })
})

// ── groupMonthsByYear ──
describe('groupMonthsByYear', () => {
  it('groups months into years', () => {
    const months = [
      { key: '2025-06' }, { key: '2025-05' },
      { key: '2024-12' }, { key: '2024-11' },
    ]
    const result = groupMonthsByYear(months)
    expect(result).toHaveLength(2)
    expect(result[0].key).toBe('2025')
    expect(result[0].items).toHaveLength(2)
    expect(result[1].key).toBe('2024')
    expect(result[1].items).toHaveLength(2)
  })
  it('handles unknown keys', () => {
    const result = groupMonthsByYear([{ key: 'unknown' }])
    expect(result[0].key).toBe('unknown')
  })
})

// ── sortExpenses ──
describe('sortExpenses', () => {
  it('sorts by status order first', () => {
    const list = [
      { status: 'paid', expense_date: '2025-01-01' },
      { status: 'submitted', expense_date: '2025-01-01' },
    ]
    const sorted = sortExpenses(list)
    expect(sorted[0].status).toBe('submitted')
    expect(sorted[1].status).toBe('paid')
  })
  it('sorts by date within same status', () => {
    const list = [
      { status: 'submitted', updated_at: '2025-01-01' },
      { status: 'submitted', updated_at: '2025-02-01' },
    ]
    const sorted = sortExpenses(list)
    expect(sorted[0].updated_at).toBe('2025-02-01')
  })
  it('does not mutate original', () => {
    const list = [{ status: 'paid' }, { status: 'submitted' }]
    const sorted = sortExpenses(list)
    expect(sorted).not.toBe(list)
  })
})

// ── sortIncome ──
describe('sortIncome', () => {
  it('sorts by date_received desc', () => {
    const list = [
      { date_received: '2025-01-01' },
      { date_received: '2025-03-01' },
    ]
    const sorted = sortIncome(list)
    expect(sorted[0].date_received).toBe('2025-03-01')
  })
  it('falls back to id', () => {
    const list = [{ id: 1 }, { id: 5 }]
    const sorted = sortIncome(list)
    expect(sorted[0].id).toBe(5)
  })
})

// ── amtHist ──
describe('amtHist', () => {
  it('returns empty for no items', () => expect(amtHist([], 100)).toEqual([]))
  it('returns empty for zero ceiling', () => expect(amtHist([{ amount: 100 }], 0)).toEqual([]))
  it('returns HIST_BINS bins', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ amount: (i + 1) * 100 }))
    const result = amtHist(items, 50)
    expect(result).toHaveLength(HIST_BINS)
  })
  it('normalizes to 0-1 range', () => {
    const items = [{ amount: 100 }, { amount: 500 }, { amount: 1000 }]
    const result = amtHist(items, 10)
    expect(Math.max(...result)).toBe(1)
    expect(result.every(v => v >= 0 && v <= 1)).toBe(true)
  })
})

// ── trend ──
describe('trend', () => {
  it('returns no data for both zero', () => {
    expect(trend(0, 0)).toEqual({ cls: '', dir: '', num: '', label: 'No data yet' })
  })
  it('returns new this month for zero prev', () => {
    expect(trend(100, 0)).toEqual({ cls: '', dir: '', num: '', label: 'New this month' })
  })
  it('returns positive trend', () => {
    const r = trend(200, 100)
    expect(r.cls).toBe('stat-ok')
    expect(r.dir).toBe('up')
    expect(r.num).toBe('+100%')
  })
  it('returns negative trend', () => {
    const r = trend(50, 100)
    expect(r.cls).toBe('stat-err')
    expect(r.dir).toBe('down')
    expect(r.num).toBe('-50%')
  })
  it('inverts when requested', () => {
    const r = trend(200, 100, true)
    expect(r.cls).toBe('stat-err') // increase is bad when inverted (expenses)
  })
})

// ── trendDiff ──
describe('trendDiff', () => {
  it('returns no data for both zero', () => {
    expect(trendDiff(0, 0)).toEqual({ cls: '', dir: '', num: '', label: 'No data yet' })
  })
  it('returns same for equal', () => {
    expect(trendDiff(5, 5)).toEqual({ cls: '', dir: '', num: '', label: 'Same as last month' })
  })
  it('returns positive diff', () => {
    const r = trendDiff(10, 7)
    expect(r.cls).toBe('stat-ok')
    expect(r.num).toBe('+3')
  })
  it('returns negative diff', () => {
    const r = trendDiff(3, 7)
    expect(r.cls).toBe('stat-err')
    expect(r.num).toBe('-4')
  })
})
