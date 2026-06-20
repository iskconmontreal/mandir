// Finance statistics and trend helpers
// FEATURE: finance/stats

import { HIST_BINS } from './constants.js'

export function amtHist(items, ceil) {
  if (!items.length || !ceil) return []
  const bins = new Array(HIST_BINS).fill(0)
  const ceilLog = Math.log(ceil + 1)
  for (const r of items) { const a = (r.amount || 0) / 100; if (a > 0) bins[Math.min(Math.floor(Math.log(a + 1) / ceilLog * HIST_BINS), HIST_BINS - 1)]++ }
  const max = Math.max(1, ...bins)
  return bins.map(n => n / max)
}

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
