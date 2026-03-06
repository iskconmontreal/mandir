// Shared SVG icon strings for activity feeds and finance statuses.

const REJECT_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>'

export const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>'

export const STATUS_ICONS = Object.freeze({
  submitted: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 5v3.5l2.5 1.5"/></svg>',
  approved: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5" stroke-width="1.5"/><path d="M5 8.2l2 2.3 4-4.5" stroke-width="2"/></svg>',
  rejected: REJECT_ICON,
  paid: '<svg width="14" height="14" viewBox="0 0 16 16" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="7.5" fill="currentColor"/><path d="M5 8.2l2 2.3 4-4.5" stroke="#fff" stroke-width="2" fill="none"/></svg>',
})

export const ACTIVITY_ICONS = Object.freeze({
  create: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 5v6M5 8h6"/></svg>',
  approved: CHECK_ICON,
  rejected: REJECT_ICON,
  reject: REJECT_ICON,
  paid: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path stroke-width="1.5" d="M9 4c-.4-.6-1-.8-1.5-.8C6.2 3.2 5.5 4 5.5 5s.8 1.5 2 1.8 2 .8 2 1.7-.7 1.7-1.8 1.7c-.6 0-1.2-.2-1.7-.8"/><path stroke-width="1.5" d="M7.5 2v1.2m0 8v1.3"/><path stroke-width="2.5" d="M10 12l1.5 1.5L15 10"/></svg>',
  submitted: STATUS_ICONS.submitted,
  update: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z"/></svg>',
  delete: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5v8h6v-8"/></svg>',
})

export const activityIcon = badge => ACTIVITY_ICONS[badge] || ACTIVITY_ICONS.update
export const statusIcon = status => STATUS_ICONS[status] || ''
