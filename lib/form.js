// Finance form controller: shared add/edit expense and donation logic
// FEATURE: finance — reusable form behavior for dashboard and finance pages

import { fmtCat, fmtAmt, rawAmt, toCents, toast } from './app.js'
import { DON_CATS, EXP_CATS, DON_METHODS, AMT_MAX, DON_FIELDS, EXP_FIELDS, fmtStatus, fmtDate, parseDiff, eventBadge, eventLabel, eventDetail, actorName, setErr } from './finance.js'
import { activityIcon } from './icons.js'

const today = () => new Date().toISOString().slice(0, 10)

export const emptyDonForm = () => ({ amount: '', method: 'cash', category: 'general', date_received: today(), note: '', member_id: null, attachment: null })
export const emptyExpForm = () => ({ payee: '', amount: '', category: '', expense_date: today(), description: '', member_id: null })

export function formDefaults(apiBase, myUid) {
  return {
    activeTab: 'expenses',
    showAdd: false,
    editId: null,
    donForm: emptyDonForm(),
    expForm: emptyExpForm(),
    donCats: DON_CATS,
    expCats: EXP_CATS,
    donMethods: DON_METHODS,
    adding: false,
    addErr: null,
    extracting: false,
    delConfirm: false,
    deleting: false,
    actioning: false,
    actionNote: '',
    actionRef: '',
    receiptPreview: '',
    receiptName: '',
    receipts: [],
    lightboxSrc: '',
    filePickerOpen: false,
    memberHits: [],
    memberQuery: '',
    vendorHits: [],
    expFull: false,
    donFull: false,
    detailExp: null,
    expApprovals: [],
    expHistory: [],
    donHistory: [],
    apiBase,
    myUid,
    memberNames: {},
    userNames: {},
    fmt: fmtCat,
    fmtAmt,
    fmtCat,
    fmtDate,
    fmtStatus,
    activityIcon,
    eventBadge,
    eventLabel,
    eventDetail,
  }
}

export function expIsEditable(s) {
  if (!s.detailExp) return true
  if (s.detailExp.status !== 'submitted') return false
  return !s.can('expenses:approve')
}

export function expGetAttachments(s) {
  return s.detailExp?.attachments || []
}

export function buildExpTimeline(s) {
  const entries = []
  for (const a of s.expApprovals) {
    entries.push({
      badge: a.action === 'approve' ? 'approved' : a.action,
      label: a.action === 'approve' ? 'Approved' : a.action === 'reject' ? 'Rejected' : fmtCat(a.action),
      actor: s.memberNames[a.approved_by] || '',
      uid: null,
      detail: a.note || '',
      date: a.created_at,
    })
  }
  for (const h of s.expHistory) {
    const d = parseDiff(h.diff)
    if (d?.approval) continue
    entries.push({
      badge: eventBadge(h),
      label: eventLabel(h),
      actor: actorName(h.user_id, s.userNames, s.myUid),
      uid: h.user_id,
      detail: eventDetail(h),
      date: h.created_at,
    })
  }
  entries.sort((a, b) => new Date(b.date) - new Date(a.date))
  return entries
}

export function bindForm(s, { api, onSave }) {
  let pendingExtracts = 0, _syncedAmt = ''
  const _today = today()

  function resetForm() {
    document.querySelectorAll('.field-err').forEach(el => el.classList.remove('field-err'))
    s.editId = null; s.addErr = null; s.detailExp = null
    s.receiptPreview = ''; s.receiptName = ''; s.receipts = []; s.extracting = false
    s.memberQuery = ''; s.memberHits = []; s.vendorHits = []; s.expFull = false; s.donFull = false
    s.actionNote = ''; s.actionRef = ''
    s.delConfirm = false; s.deleting = false
    s.donForm = emptyDonForm(); s.expForm = emptyExpForm()
    s.expApprovals = []; s.expHistory = []; s.donHistory = []
    _syncedAmt = ''
  }

  function syncExpReceipts() {
    let total = 0
    for (const r of s.receipts) {
      if (!r.data) continue
      const amt = parseFloat(r.data.amount)
      if (amt > 0 && amt < AMT_MAX) total += amt
    }
    const newAmt = total ? total.toFixed(2) : ''
    if (newAmt && (s.expForm.amount === _syncedAmt || !s.expForm.amount)) {
      s.expForm.amount = newAmt; _syncedAmt = newAmt
    }
    const first = s.receipts.find(r => r.data)?.data
    if (!first) return
    if (first.vendor || first.category || first.date) s.expFull = true
    if (!s.expForm.payee && first.vendor) s.expForm.payee = first.vendor
    if (!s.expForm.category && first.category) s.expForm.category = first.category
    if ((!s.expForm.expense_date || s.expForm.expense_date === _today) && first.date) s.expForm.expense_date = first.date
  }

  async function expAction(fn) {
    s.actioning = true
    try {
      const msg = await fn()
      s.showAdd = false
      toast(msg, 'success')
      onSave()
    } catch (e) { s.addErr = e.message }
    finally { s.actioning = false }
  }

  s.openAdd = () => { resetForm(); s.activeTab = 'expenses'; s.showAdd = true }
  s.openDonForm = () => { resetForm(); s.activeTab = 'donations'; s.showAdd = true }
  s.cancelAdd = () => { resetForm(); s.showAdd = false }

  s.editExpense = x => {
    resetForm()
    s.activeTab = 'expenses'
    s.editId = x.id
    s.detailExp = x
    const cat = x.category || 'other'
    s.expForm = { member_id: x.member_id || null, payee: x.payee || '', amount: rawAmt(x.amount), category: cat, expense_date: (x.expense_date || '').slice(0, 10), description: x.description || '' }
    s.memberQuery = x.member_id ? (s.memberNames[x.member_id] || x.payee || '') : ''
    s.expFull = true
    s.showAdd = true
    if (cat && !EXP_CATS.includes(cat)) setTimeout(() => {
      const sel = document.getElementById('exp-cat')
      if (!sel || [...sel.options].some(o => o.value === cat)) return
      const opt = document.createElement('option')
      opt.value = cat; opt.textContent = fmtCat(cat)
      sel.prepend(opt); sel.value = cat
    })
    if (x.id) {
      api.getExpenseApprovals(x.id).then(r => { s.expApprovals = r.items || r || [] }).catch(() => {})
      api.getAuditLogs({ entity_type: 'expense', entity_id: x.id, limit: 20, sortBy: 'created_at', sortDesc: 'true' })
        .then(r => { s.expHistory = r.items || [] }).catch(() => {})
    }
  }

  s.editDonation = d => {
    resetForm()
    s.activeTab = 'donations'
    s.editId = d.id
    s.donForm = { amount: rawAmt(d.amount), method: d.method || 'cash', category: d.category || 'general', date_received: (d.date_received || '').slice(0, 10), note: d.note || '', member_id: d.member_id || null, attachment: null }
    s.memberQuery = d.member_id ? (s.memberNames[d.member_id] || '') : ''
    s.donFull = true
    s.showAdd = true
    api.getAuditLogs({ entity_type: 'donation', entity_id: d.id, limit: 20, sortBy: 'created_at', sortDesc: 'true' })
      .then(r => { s.donHistory = r.items || [] }).catch(() => {})
  }

  s.filterDonors = q => {
    s.memberQuery = q
    const topDonors = (s.donorRows || []).filter(d => d.member_id).map(d => ({ id: d.member_id, name: d.name }))
    const all = Object.entries(s.memberNames || {}).map(([id, name]) => ({ id: +id, name }))
    s.memberHits = (q ? all.filter(m => m.name.toLowerCase().includes(q.toLowerCase())) : (topDonors.length ? topDonors : all)).slice(0, 5)
  }
  s.selectDonor = m => { s.donForm.member_id = m.id; s.memberQuery = m.name; s.memberHits = [] }
  s.clearDonor = () => { s.donForm.member_id = null; s.memberQuery = ''; s.memberHits = [] }

  s.filterVendors = q => {
    s.expForm.payee = q
    if (!q) { s.vendorHits = []; return }
    const seen = new Set()
    const src = s.expenses || s.myExpenses || []
    s.vendorHits = src.map(x => x.payee).filter(v => v && !seen.has(v) && (seen.add(v), v.toLowerCase().includes(q.toLowerCase()))).slice(0, 5)
  }

  s.scanFile = async file => {
    if (!file) return
    s.extracting = true; s.addErr = null; s.receiptName = file.name
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => { s.receiptPreview = reader.result }
      reader.readAsDataURL(file)
    } else s.receiptPreview = ''
    try {
      let res = await api.uploadDoc(file, 'donation')
      let isDup = false
      if (res.duplicate) {
        if (!res.can_claim) { isDup = true; toast('Possible duplicate — this receipt was uploaded before', 'warn') }
        else res = await api.claimAttachment(res.attachment.id)
      }
      const d = res.extracted_data || res.attachment?.extracted_data || {}
      const amt = parseFloat(d.amount)
      if (amt > 0 && amt < AMT_MAX) s.donForm.amount = d.amount
      if (d.method) s.donForm.method = d.method
      if (d.category) s.donForm.category = d.category
      if (d.date) s.donForm.date_received = d.date
      s.donForm.attachment = isDup ? null : (res.attachment || null)
    } catch (e) { toast(e.message) }
    finally { s.extracting = false }
  }

  s.addReceipts = async fileList => {
    if (!fileList?.length) return
    const fingerprints = new Set(s.receipts.map(r => r.name + ':' + r.size))
    const files = [...fileList].filter(f => !fingerprints.has(f.name + ':' + f.size))
    if (!files.length) { toast('Receipt already added'); return }
    s.addErr = null; pendingExtracts++; s.extracting = true
    const startIdx = s.receipts.length
    s.receipts.push(...files.map(f => ({ name: f.name, size: f.size, preview: '', data: null, extracting: true, err: null })))
    try {
      await Promise.all(files.map(async (file, i) => {
        const r = s.receipts[startIdx + i]
        if (file.type.startsWith('image/')) {
          const rd = new FileReader()
          rd.onload = () => { r.preview = rd.result }
          rd.readAsDataURL(file)
        }
        try {
          let res = await api.uploadDoc(file, 'expense')
          if (res.duplicate) {
            if (!res.can_claim) {
              r.duplicate = true
              r.data = res.extracted_data || res.attachment?.extracted_data || {}
              r.extracting = false
              syncExpReceipts()
              return
            }
            res = await api.claimAttachment(res.attachment.id)
          }
          r.data = res.extracted_data || res.attachment?.extracted_data || {}
          r.attachment = res.attachment || null
        } catch (e) { r.err = e.message; toast(e.message) }
        r.extracting = false
        syncExpReceipts()
      }))
    } finally { pendingExtracts--; s.extracting = false }
  }

  s.removeReceipt = r => {
    const i = s.receipts.indexOf(r)
    if (i >= 0) s.receipts.splice(i, 1)
    syncExpReceipts()
  }

  s.saveDonation = async () => {
    if (s.extracting) { s.addErr = 'Please wait for receipt processing.'; return }
    s.addErr = null; s.adding = true
    try {
      const f = s.donForm
      const data = { amount: toCents(f.amount), attachment_ids: !s.editId && f.attachment ? [f.attachment.id] : undefined }
      if (f.method) data.method = f.method
      if (f.category) data.category = f.category
      if (f.date_received) data.date_received = f.date_received
      if (f.note) data.note = f.note
      if (f.member_id) data.member_id = f.member_id
      if (s.editId) await api.updateDonation(s.editId, data)
      else await api.createDonation(data)
      toast(s.editId ? 'Donation updated' : 'Donation saved', 'success')
      document.querySelectorAll('.field-err').forEach(el => el.classList.remove('field-err'))
      resetForm(); s.showAdd = false
      onSave()
    } catch (e) { s.addErr = setErr(e.message, 'don', DON_FIELDS) }
    finally { s.adding = false }
  }

  s.saveExpense = async () => {
    if (pendingExtracts > 0) { s.addErr = 'Please wait for receipt processing.'; return }
    s.addErr = null; s.adding = true
    try {
      const f = s.expForm
      const data = { amount: toCents(f.amount) }
      if (f.payee) data.payee = f.payee
      if (f.description) data.description = f.description
      if (f.category) data.category = f.category
      if (f.expense_date) data.expense_date = f.expense_date
      if (f.member_id) data.member_id = f.member_id
      if (s.editId) {
        await api.updateExpense(s.editId, data)
      } else {
        const attIds = s.receipts.filter(r => r.attachment).map(r => r.attachment.id)
        if (attIds.length) data.attachment_ids = attIds
        await api.createExpense(data)
      }
      toast(s.editId ? 'Expense updated' : 'Expense saved', 'success')
      document.querySelectorAll('.field-err').forEach(el => el.classList.remove('field-err'))
      resetForm(); s.showAdd = false
      onSave()
    } catch (e) { s.addErr = setErr(e.message, 'exp', EXP_FIELDS) }
    finally { s.adding = false }
  }

  s.delDonation = async () => {
    s.deleting = true
    try { await api.deleteDonation(s.editId); resetForm(); s.showAdd = false; onSave() }
    catch (e) { s.addErr = e.message }
    finally { s.deleting = false }
  }

  s.delExpense = async () => {
    s.deleting = true
    try { await api.deleteExpense(s.editId); resetForm(); s.showAdd = false; onSave() }
    catch (e) { s.addErr = e.message }
    finally { s.deleting = false }
  }

  s.approveExp = async () => {
    await expAction(async () => {
      const r = await api.approveExpense(s.editId, s.actionNote)
      const exp = r.expense || r
      return exp.status === 'approved' ? 'Expense approved' : `Approval recorded (${r.approval_count}/${r.approvals_required})`
    })
  }

  s.rejectExp = async () => {
    if (!s.actionNote.trim()) { s.addErr = 'Note is required'; return }
    await expAction(async () => { await api.rejectExpense(s.editId, s.actionNote); return 'Expense rejected' })
  }

  s.payExp = async () => {
    await expAction(async () => { await api.payExpense(s.editId, s.actionRef); return 'Expense marked as paid' })
  }

  return { resetForm }
}
