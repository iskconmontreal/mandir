// app.js — shared app shell init (DRY: every page needs this)

import sprae from './sprae.js'
import { auth } from './auth.js'

auth.capture()
if (!auth.guard()) throw new Error('redirecting')

const page = location.pathname.split('/').pop() || 'index.html'
const section = page.replace('.html', '') || 'index'

// Categories — single source of truth
export const DON_CATS = ['General', 'Sunday Feast', 'Book Distribution', 'Deity Worship', 'Building Fund', 'Annadana', 'Festival', 'Other']
export const EXP_CATS = ['Utilities', 'Kitchen', 'Deity', 'Maintenance', 'Office', 'Rent', 'Insurance', 'Travel', 'Other']

// Member roles & statuses
export const ROLES = ['Devotee', 'Volunteer', 'Board Member', 'Treasurer', 'President', 'Other']

// Init app with page-specific state merged into shell
export function init(state = {}) {
  state.user = auth.user
  state.section = section
  state.active = (s) => s === section
  state.tab = (p) => p === page
  state.logout = () => auth.logout()
  state.can = (p) => auth.can(p)
  state.userMenu ??= false
  return sprae(document, state)
}

export { auth }
