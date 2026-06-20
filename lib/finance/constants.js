// Finance domain constants — single source of truth for categories, methods, statuses
// FEATURE: finance/constants

export const CATS = ['admin', 'annadana', 'bhoga', 'books', 'boutique', 'building_fund', 'deity', 'equipment', 'festival', 'flowers', 'general', 'insurance', 'kitchen', 'maintenance', 'overpayment', 'rent', 'restaurant', 'salary', 'sankirtan', 'sunday_feast', 'travel', 'utilities', 'vehicle', 'other']
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

export const CAT_CLR = { deity: 'purple', deity_worship: 'purple', flowers: 'purple', bhoga: 'amber', kitchen: 'amber', sunday_feast: 'amber', annadana: 'amber', restaurant: 'amber', events: 'teal', festival: 'teal', travel: 'teal', vehicle: 'teal', boutique: 'teal', admin: 'blue', books: 'blue', salary: 'green', rent: 'brown', building_fund: 'brown', maintenance: 'brown', renovation: 'brown', equipment: 'brown', insurance: 'indigo', utilities: 'indigo', overpayment: 'indigo', sankirtan: 'saffron' }

export const HIST_BINS = 20

