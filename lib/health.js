// System health: goloka's self-report, shared by the top-bar pill and the page
// FEATURE: health — admin view of /api/admin/health

import { api } from './api.js'

const TONE = { ok: 'ok', warn: 'warn', error: 'err', disabled: 'dim', skipped: 'dim' }
const LABEL = { ok: 'OK', warn: 'Check', error: 'Problem', disabled: 'Off', skipped: 'Not checked' }
const RANK = { error: 2, warn: 1 }

export const healthTone = st => TONE[st] || 'dim'
export const healthLabel = st => LABEL[st] || st || '—'
export const worstStatus = list => list.reduce((a, b) => ((RANK[b] || 0) > (RANK[a] || 0) ? b : a), 'ok')

// Receipt reading isn't shown in mandir, and goloka on Railway always warns
// that it has no OCR engine, so those warnings would only be noise.
export const shownWarnings = h => (h?.warnings || []).filter(w => !/^(ocr|ollama|pdf rasterizer)/i.test(w))

// Verdict over the sections mandir shows. Off-site backups have their own
// pill, so the top-bar pill leaves them out and the page passes them in.
export function healthVerdict(h, backupStatus) {
  const offsite = { failed: 'error', stale: 'warn', never: 'warn' }[backupStatus] || 'ok'
  return worstStatus([h.street.status, worstStatus(Object.values(h.dbs)), h.backups.status, h.disk.status, h.storage.status, h.mailer.status, offsite])
}

const fmtTime = v => v ? new Date(v).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''

// One line per section for the pill's popover.
export function healthRows(h) {
  const st = h.street
  const streetText = st.last_error_at && (!st.last_ok_at || st.last_error_at > st.last_ok_at)
    ? 'Last import failed ' + fmtTime(st.last_error_at) + ': ' + st.last_error
    : st.proxy && st.proxy !== 'reachable' && st.proxy !== 'direct' ? 'Cloudflare: ' + st.proxy
    : st.last_ok_at ? 'Last import OK ' + fmtTime(st.last_ok_at) : 'Ready'
  const gb = b => (b / 1073741824).toFixed(1) + ' GB'
  return [
    { name: 'Street notes', status: st.status, text: streetText },
    { name: 'Databases', status: worstStatus(Object.values(h.dbs)), text: Object.values(h.dbs).filter(v => v === 'ok').length + ' connected' },
    { name: 'Local backups', status: h.backups.status, text: '' },
    { name: 'Disk', status: h.disk.status, text: h.disk.free_bytes ? gb(h.disk.free_bytes) + ' free' : '' },
    { name: 'Storage folders', status: h.storage.status, text: '' },
    { name: 'Email', status: h.mailer.status, text: h.mailer.mode || '' },
  ]
}

export const healthState = () => ({
  health: null,
  healthErr: '',
  healthAt: null,
  healthOpen: false,

  get healthStatus() {
    if (!this.health) return this.healthErr ? 'unknown' : 'loading'
    return healthVerdict(this.health)
  },

  async refreshHealth() {
    try {
      this.health = await api.getAdminHealth()
      this.healthAt = new Date()
      this.healthErr = ''
    } catch (e) {
      this.healthErr = e.message || 'Failed to load the health report'
    }
  },
})

export function watchHealth(s) {
  s.refreshHealth()
  setInterval(() => { if (!document.hidden) s.refreshHealth() }, 5 * 60_000)
}
