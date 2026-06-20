// Finance UI utilities and field definitions
// FEATURE: finance/ui

export const DON_FIELDS = { Type: { id: 'type', label: 'type' }, Amount: { id: 'amount', label: 'amount' }, Method: { id: 'method', label: 'method' }, Category: { id: 'cat', label: 'category' }, DateReceived: { id: 'date', label: 'date' }, Note: { id: 'note', label: 'note' } }
export const EXP_FIELDS = { Payee: { id: 'vendor', label: 'payee' }, Amount: { id: 'amount', label: 'amount' }, Method: { id: 'exp-method', label: 'method' }, Category: { id: 'cat', label: 'category' }, ExpenseDate: { id: 'date', label: 'date' }, Note: { id: 'desc', label: 'note' } }

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
