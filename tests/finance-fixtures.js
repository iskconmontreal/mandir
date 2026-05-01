// Shared Playwright test helpers for finance tests
import { API, loginAs } from './fixtures.js'

// ── Date helpers ──
export function isoMonthDate(offsetMonths = 0, day = '01') {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${day}`
}

export const CUR_MONTH = isoMonthDate(0)
export const PREV_MONTH = isoMonthDate(-1)

// ── Data factories ──
let _nextId = 100
export function EXPENSE(overrides = {}) {
  return { id: _nextId++, amount: 5000, payee: 'Test Vendor', category: 'kitchen', expense_date: isoMonthDate(0, '15'), status: 'submitted', approval_count: 0, approvals_required: 1, ...overrides }
}

export function DONATION(overrides = {}) {
  return { id: _nextId++, amount: 2500, method: 'cash', category: 'general', type: 'donation', date_received: isoMonthDate(0, '10'), note: '', ...overrides }
}

export function MEMBER(overrides = {}) {
  return { id: _nextId++, user_id: _nextId++, data: { name: 'Test Member', email: 'test@local' }, ...overrides }
}

// ── Summary builder ──
export function summarizeMonths(items, dateKey) {
  const monthMap = new Map()
  for (const item of items) {
    const month = item[dateKey]?.slice(0, 7)
    if (!month) continue
    const prev = monthMap.get(month) || { month, count: 0, total: 0, categories: new Map() }
    prev.count += 1
    prev.total += item.amount || 0
    const category = item.category || 'other'
    prev.categories.set(category, (prev.categories.get(category) || 0) + (item.amount || 0))
    monthMap.set(month, prev)
  }
  return [...monthMap.values()].sort((a, b) => b.month.localeCompare(a.month)).map(item => ({
    month: item.month, count: item.count, total: item.total,
    categories: [...item.categories.entries()].sort((a, b) => b[1] - a[1]).map(([category, total]) => ({ category, total })),
  }))
}

export function summarizeExpenses(expenses = [], donations = []) {
  const now = new Date()
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const expMonths = summarizeMonths(expenses, 'expense_date')
  const donMonths = summarizeMonths(donations, 'date_received')
  const expByMonth = Object.fromEntries(expMonths.map(m => [m.month, m.total]))
  const donByMonth = Object.fromEntries(donMonths.map(m => [m.month, m.total]))
  return {
    year: now.getFullYear(),
    exp_month: expByMonth[curMonth] || 0, exp_prev_month: expByMonth[prevMonth] || 0,
    don_month: donByMonth[curMonth] || 0, don_prev_month: donByMonth[prevMonth] || 0,
    donors_month: 0, donors_prev_month: 0,
    exp_total: expenses.length, don_total: donations.length,
    exp_months: expMonths, don_months: donMonths,
  }
}

// ── Mock API ──
export function mockFinance(page, { donations = [], expenses = [], members = [], auditLogs = [] } = {}) {
  return page.route(`${API}/**`, async route => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const path = url.pathname
    const idMatch = path.match(/\/api\/expenses\/(\d+)\/(\w+)/)

    if (idMatch) {
      const [, id, action] = idMatch
      const exp = expenses.find(e => e.id == id)
      const transitions = { approve: 'approved', pay: 'paid', reject: 'rejected', close: 'closed' }
      if (exp && transitions[action]) {
        exp.status = transitions[action]
        if (action === 'pay') {
          const body = route.request().postDataJSON() || {}
          if (body.reference) exp.reference = body.reference
        }
        if (action === 'approve') {
          return route.fulfill({ json: { status: exp.status, expense: exp, approval_count: 1, approvals_required: 1 } })
        }
        return route.fulfill({ json: exp })
      }
    }

    if (path === '/api/income' && method === 'POST') {
      const body = route.request().postDataJSON()
      const d = { id: donations.length + 1, ...body, status: 'submitted' }
      donations.push(d)
      return route.fulfill({ json: d })
    }
    if (path === '/api/income' && method === 'GET') {
      return route.fulfill({ json: { items: [...donations], total: donations.length } })
    }
    if (path.startsWith('/api/income/') && method === 'DELETE') {
      const id = +path.split('/').at(-1)
      const i = donations.findIndex(d => d.id === id)
      if (i >= 0) donations.splice(i, 1)
      return route.fulfill({ status: 204 })
    }
    if (path.startsWith('/api/income/') && method === 'PUT') {
      const id = +path.split('/').at(-1)
      const body = route.request().postDataJSON()
      const i = donations.findIndex(d => d.id === id)
      if (i >= 0) donations[i] = { ...donations[i], ...body }
      return route.fulfill({ json: donations[i] ?? {} })
    }

    if (path === '/api/expenses') {
      if (method === 'POST') {
        const body = route.request().postDataJSON()
        const e = { id: expenses.length + 1, ...body, status: 'submitted' }
        expenses.push(e)
        return route.fulfill({ json: e })
      }
      const dateFrom = url.searchParams.get('dateFrom') || ''
      const dateTo = url.searchParams.get('dateTo') || ''
      const items = expenses.filter(e => {
        const dt = e.expense_date?.slice(0, 10) || ''
        if (dateFrom && dt < dateFrom) return false
        if (dateTo && dt > dateTo) return false
        return true
      })
      return route.fulfill({ json: { items, total: items.length } })
    }

    if (path === '/api/members') {
      if (method === 'POST') {
        const body = route.request().postDataJSON()
        const newMember = { id: members.length + 100, data: { name: body.name, email: body.email } }
        members.push(newMember)
        return route.fulfill({ json: newMember })
      }
      return route.fulfill({ json: { items: members, total: members.length } })
    }
    if (path === '/api/finance/summary' && method === 'GET') return route.fulfill({ json: summarizeExpenses(expenses, donations) })
    if (path === '/api/donors/summary' && method === 'GET') return route.fulfill({ json: { items: [], total: 0 } })
    if (path.startsWith('/api/expenses/') && method === 'DELETE') {
      const id = +path.split('/').at(-1)
      const i = expenses.findIndex(e => e.id === id)
      if (i >= 0) expenses.splice(i, 1)
      return route.fulfill({ status: 204 })
    }
    if (/^\/api\/expenses\/\d+$/.test(path) && method === 'GET') {
      const id = +path.split('/').at(-1)
      const exp = expenses.find(e => e.id === id)
      return route.fulfill(exp ? { json: exp } : { status: 404, json: { error: 'Not found' } })
    }
    if (path.startsWith('/api/expenses/') && method === 'GET') {
      return route.fulfill({ json: { items: [], total: 0 } })
    }
    if (path.startsWith('/api/expenses/') && method === 'PUT') {
      const id = +path.split('/')[3]
      const body = route.request().postDataJSON()
      const i = expenses.findIndex(e => e.id === id)
      if (i >= 0) expenses[i] = { ...expenses[i], ...body }
      return route.fulfill({ json: expenses[i] ?? {} })
    }
    if (path === '/api/audit') {
      const eid = url.searchParams.get('entity_id')
      const items = eid ? auditLogs.filter(l => String(l.entity_id) === eid) : auditLogs
      return route.fulfill({ json: { items, total: items.length } })
    }
    if (path.startsWith('/api/documents/') && method === 'DELETE') {
      const attId = +path.split('/').at(-1)
      for (const exp of expenses) {
        if (exp.attachments) exp.attachments = exp.attachments.filter(a => a.id !== attId)
      }
      for (const d of donations) {
        if (d.attachments) d.attachments = d.attachments.filter(a => a.id !== attId)
      }
      return route.fulfill({ json: { ok: true } })
    }
    if (method !== 'GET') return route.fulfill({ status: 404, json: { error: 'Unexpected mutation in mock: ' + path } })
    route.fulfill({ json: { items: [], total: 0 } })
  })
}

// ── Navigation ──
export async function openFinance(page, tab = 'transactions') {
  const type = tab === 'donations' || tab === 'income' ? 'income'
    : tab === 'expenses' ? 'expense'
    : ''
  if (tab === 'donations' || tab === 'income' || tab === 'expenses' || tab === 'net') tab = 'transactions'
  await page.goto(`/app/finance/${type ? `?net_type=${type}` : ''}#${tab}`)
  await page.getByTestId('tab-group').waitFor()
  if (tab === 'transactions') {
    await page.getByTestId(type === 'income' ? 'tx-income' : 'tx-expense').first().waitFor({ timeout: 10000 }).catch(() => {})
  }
}
