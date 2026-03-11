// Unified icon API — single icon set, category helpers
// FEATURE: icons — all UI icons consolidated here

import { ICONS } from './icons.heroicons.js'

export { ICONS }

export const icon = (name, fallback = '') => ICONS[name] || fallback

export const actionIcon = name => icon(`action_${name}`, ICONS.action_edit)
const BADGE_ALIAS = { reject: 'rejected' }
const STATUS_BADGES = new Set(['submitted', 'approved', 'paid', 'closed', 'rejected'])
export const activityIcon = badge => STATUS_BADGES.has(badge) ? statusIcon(badge) : icon(`activity_${BADGE_ALIAS[badge] || badge}`, ICONS.activity_update)
export const statusIcon = status => icon(`status_${status}`, '')
export const methodIcon = method => icon(`method_${method}`, ICONS.method_cash)
export const trendIcon = dir => icon(`trend_${dir}`, '')
