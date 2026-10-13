// Backup status — business logic for the topbar indicator (settings:manage only)

import { api, BASE } from './api.js'
import { toast } from './app.js'

const sleep = ms => new Promise(r => setTimeout(r, ms))

export const backupState = () => ({
  backup: null,
  backupErr: '',
  backupNow: Date.now(),
  backupOpen: false,
  backingUp: false,
  watchingBackup: false,
  showBackupError: false,
  showRestoreModal: false,
  restoreInput: '',
  restoring: false,
  restoreFailed: '',

  get backupStale() {
    const m = this.backup ? this.backup.age_minutes : null
    return m == null || m > 1560
  },

  // server status wins; age_minutes fallback covers older goloka builds
  get backupStatus() {
    const b = this.backup
    if (!b) return this.backupErr ? 'error' : 'loading'
    if (!b.remote_configured) return 'disabled'
    if (this.backingUp || b.running) return 'running'
    if (b.status) return b.status
    return this.backupStale ? (b.last_backup ? 'stale' : 'never') : 'ok'
  },

  async refreshBackup() {
    try {
      this.backup = await api.getBackupStatus()
      this.backupNow = Date.now()
      this.backupErr = ''
    } catch (e) {
      this.backupErr = e.message || 'Failed to load backup status'
      return
    }
    if (this.backup.running && !this.backingUp && !this.watchingBackup) {
      this.watchingBackup = true
      try { await this.pollBackup(this.backup) } catch {} finally { this.watchingBackup = false }
    }
  },

  // poll every 3 s until a run finishes (new success or new failure); resolves to the final status
  async pollBackup(prev) {
    const prevOk = prev && prev.last_backup, prevErr = prev && prev.last_error && prev.last_error.at
    const deadline = Date.now() + 5 * 60_000
    let misses = 0
    while (Date.now() < deadline) {
      await sleep(3000)
      try {
        this.backup = await api.getBackupStatus()
        this.backupNow = Date.now()
        misses = 0
        const b = this.backup, errAt = b.last_error && b.last_error.at
        if (!b.running && ((b.last_backup && b.last_backup !== prevOk) || (errAt && errAt !== prevErr))) return b
      } catch (e) {
        if (++misses >= 3) throw e
      }
    }
    throw new Error('Backup did not finish within 5 minutes — check again later')
  },

  async runBackup() {
    if (this.backingUp || this.restoring) return
    const prev = this.backup
    this.backingUp = true
    try {
      await api.runBackup()
      const b = await this.pollBackup(prev)
      if (b.status === 'failed' && b.last_error && (!prev || !prev.last_backup || b.last_backup === prev.last_backup)) {
        this.showBackupError = true
        throw new Error(b.last_error.message || 'Backup failed')
      }
      toast('Backup completed', 'success')
    } catch (e) {
      toast(e.message || 'Backup failed', 'error')
    } finally {
      this.backingUp = false
    }
  },

  openRestoreModal() {
    this.restoreInput = ''
    this.restoreFailed = ''
    this.backupOpen = false
    this.showRestoreModal = true
  },

  closeRestoreModal() {
    if (!this.restoring) this.showRestoreModal = false
  },

  async confirmRestore() {
    if (this.restoreInput !== 'RESTORE' || this.restoring) return
    this.restoring = true
    this.restoreFailed = ''
    try {
      try {
        await api.restoreBackup()
      } catch (e) {
        // the server restarts mid-request; only real API errors abort
        if (!/timed out|Cannot reach server/i.test(e.message || '')) throw e
      }
      await sleep(5000)
      const deadline = Date.now() + 5 * 60_000
      while (Date.now() < deadline) {
        try {
          const r = await fetch(`${BASE}/api/health`)
          if (r.ok) { location.reload(); return }
        } catch {}
        await sleep(3000)
      }
      throw new Error('Server did not come back — check the server logs')
    } catch (e) {
      this.restoreFailed = e.message || 'Restore failed'
      this.restoring = false
    }
  },
})

export function watchBackup(s) {
  s.refreshBackup()
  setInterval(() => { if (!s.backingUp && !s.watchingBackup && !s.restoring) s.refreshBackup() }, 60_000)
}
