// Finance category color utilities
// FEATURE: finance/colors

import { CAT_CLR } from './constants.js'

export const catCls = c => 'cat-' + (CAT_CLR[c] || 'gray')
export const catHex = c => `var(--c-cat-${CAT_CLR[c] || 'gray'})`
export const catBgHex = c => `var(--c-cat-${CAT_CLR[c] || 'gray'}-bg)`
