// Finance month grouping and state helpers
// FEATURE: finance/months

import { localMonthKey } from './dates.js'
import { sortExpenses, sortIncome, sortNetTransactions } from './sorting.js'

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

export const buildNetMonthGroups = (keys, items) => {
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
