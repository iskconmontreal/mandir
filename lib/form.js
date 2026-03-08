// Finance form controller: shared add/edit expense and donation logic
// FEATURE: finance — reusable form behavior for dashboard and finance pages

import { fmtCat, fmtAmt, rawAmt, toCents, toast } from './app.js'
import { DON_CATS, EXP_CATS, DON_METHODS, INCOME_TYPES, AMT_MAX, DON_FIELDS, EXP_FIELDS, fmtStatus, fmtDate, eventBadge, eventLabel, eventDetail, actorName, setErr, buildMetaHistory, expenseEventLabel, expenseTitle, expenseModalTitle, incomeModalTitle } from './finance.js'
import { activityIcon } from './icons.js'

const today = () => new Date().toISOString().slice(0, 10)
const logoUrl = new URL('../assets/iskcon-montreal.svg', import.meta.url).href
const tokensUrl = new URL('../css/tokens.css', import.meta.url).href
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const longDate = d => d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'
const shortDate = d => {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  const now = new Date()
  const sameYear = dt.getFullYear() === now.getFullYear()
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) })
}
const issuedReceiptNo = d => d?.receipt_no || d?.receipt_number || d?.tax_receipt_no || ''
const issuedReceiptDate = d => d?.date_issued || d?.receipt_issued_at || d?.issued_at || ''
const eligibleAmount = d => d?.eligible_amount != null && d?.eligible_amount !== ''
  ? Number(d.eligible_amount)
  : Math.max(Number(d?.amount || 0) - Math.max(Number(d?.advantage_amount || 0), 0), 0)

function donationReceiptHtml(d, names) {
  const src = d.member_id ? (names[d.member_id] || d.source_name || 'Anonymous') : (d.source_name || 'Anonymous')
  const kind = d.type === 'donation' ? (d.category || 'donation') : (d.type || 'income')
  const receiptNo = issuedReceiptNo(d)
  const issuedAt = issuedReceiptDate(d)
  const official = !!receiptNo
  const gross = Number(d?.amount || 0)
  const eligible = eligibleAmount(d)
  const advantage = Math.max(gross - eligible, 0)
  const note = d?.note ? esc(d.note) : ''
  const status = official ? 'Official income tax receipt' : 'Donation receipt preview'
  const guidance = official
    ? 'Official receipt for income tax purposes. Please retain this copy for your records.'
    : 'Official CRA income tax receipt data has not yet been issued for this donation. Save this as a donor record only.'

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${esc(receiptNo || `Donation ${d?.id || ''}`)}</title>
    <link rel="stylesheet" href="${tokensUrl}">
    <style>
      @page { size: letter; margin: 12mm; }
      html, body { background: var(--c-bg); }
      body {
        margin: 0;
        color: var(--c-text);
        font: var(--f-md)/1.5 var(--f-sans);
      }
      .sheet {
        width: min(100%, 8.5in);
        margin: 0 auto;
        padding: calc(var(--s-xl) + var(--s-sm));
        background: var(--c-surface);
      }
      .head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--s-lg);
        padding-bottom: var(--s-lg);
        border-bottom: 1px solid var(--c-border);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: var(--s-md);
      }
      .logo {
        width: 4rem;
        height: 4rem;
        object-fit: contain;
      }
      .brand h1 {
        margin: 0;
        font-size: var(--f-xl);
      }
      .brand p,
      .meta-copy,
      .foot,
      .hint {
        color: var(--c-text-dim);
      }
      .brand p,
      .meta-copy,
      .hint,
      .foot,
      .note p,
      dd,
      dt { margin: 0; }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: var(--s-xs);
        padding: var(--s-xs) var(--s-sm);
        border-radius: 999px;
        background: ${official ? 'var(--c-ok-active)' : 'var(--c-accent-hover)'};
        color: ${official ? 'var(--c-ok)' : 'var(--c-accent)'};
        font-size: var(--f-sm);
        font-weight: var(--f-wt-b);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--s-md);
        margin-top: var(--s-lg);
      }
      .card {
        padding: var(--s-md);
        border: 1px solid var(--c-border);
        border-radius: var(--r-md);
        background: linear-gradient(180deg, var(--c-surface), rgba(0, 0, 0, 0));
      }
      .card h2 {
        margin: 0 0 var(--s-sm);
        font-size: var(--f-md);
      }
      dl {
        display: grid;
        grid-template-columns: minmax(8rem, 11rem) minmax(0, 1fr);
        gap: var(--s-xs) var(--s-md);
      }
      dt {
        color: var(--c-text-dim);
        font-size: var(--f-sm);
      }
      dd strong {
        font-size: var(--f-lg);
      }
      .note {
        margin-top: var(--s-lg);
        padding: var(--s-md);
        border-radius: var(--r-md);
        background: var(--c-bg);
        border: 1px solid var(--c-border);
      }
      .note p {
        white-space: pre-wrap;
      }
      .foot {
        margin-top: var(--s-lg);
        padding-top: var(--s-md);
        border-top: 1px solid var(--c-border);
        font-size: var(--f-sm);
      }
      @media (max-width: 720px) {
        .sheet { padding: var(--s-lg); }
        .head,
        .brand { flex-direction: column; }
        .grid,
        dl { grid-template-columns: 1fr; }
      }
      @media print {
        body { background: var(--c-surface); }
        .sheet { width: auto; padding: 0; }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <header class="head">
        <div class="brand">
          <img class="logo" src="${logoUrl}" alt="ISKCON Montreal">
          <div>
            <h1>ISKCON Montreal</h1>
            <p>${esc(status)}</p>
          </div>
        </div>
        <div>
          <span class="badge">${esc(official ? 'Tax-receiptable' : 'Pending official issuance')}</span>
          <p class="meta-copy" style="margin-top:var(--s-sm)">Print or save as PDF from the system dialog.</p>
        </div>
      </header>

      <section class="grid">
        <article class="card">
          <h2>Donor</h2>
          <dl>
            <dt>Name</dt>
            <dd>${esc(src)}</dd>
            <dt>Gift type</dt>
            <dd>${esc(fmtCat(kind))}</dd>
            <dt>Method</dt>
            <dd>${esc(fmtCat(d?.method || '—'))}</dd>
            <dt>Date received</dt>
            <dd>${esc(longDate(d?.date_received))}</dd>
          </dl>
        </article>

        <article class="card">
          <h2>Receipt</h2>
          <dl>
            <dt>Receipt no.</dt>
            <dd>${esc(receiptNo || 'Pending')}</dd>
            <dt>Date issued</dt>
            <dd>${esc(issuedAt ? longDate(issuedAt) : 'Pending')}</dd>
            <dt>Eligible amount</dt>
            <dd><strong>$${esc(fmtAmt(eligible))}</strong></dd>
            <dt>Advantage amount</dt>
            <dd>${esc(advantage ? '$' + fmtAmt(advantage) : '$0.00')}</dd>
            <dt>Gift amount</dt>
            <dd>${esc('$' + fmtAmt(gross))}</dd>
          </dl>
        </article>
      </section>

      ${note ? `<section class="note"><h2 style="margin:0 0 var(--s-sm);font-size:var(--f-md)">Note</h2><p>${note}</p></section>` : ''}

      <footer class="foot">
        <p>${esc(guidance)}</p>
        <p class="hint" style="margin-top:var(--s-sm)">The frontend currently prints only the receipt data attached to this donation record. Missing official fields must be issued by the backend before this becomes a fully CRA-compliant receipt.</p>
      </footer>
    </main>
  </body>
</html>`
}

function printHtml(html) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.style.opacity = '0'

  const drop = () => setTimeout(() => frame.remove(), 300)

  frame.onload = () => {
    const w = frame.contentWindow
    if (!w) return drop()
    w.addEventListener('afterprint', drop, { once: true })
    setTimeout(() => {
      w.focus()
      w.print()
      setTimeout(drop, 1500)
    }, 250)
  }

  frame.srcdoc = html
  document.body.append(frame)
}

export const emptyDonForm = () => ({ type: 'donation', amount: '', method: 'cash', category: 'general', date_received: today(), note: '', member_id: null, attachment: null })
export const emptyExpForm = () => ({ payee: '', amount: '', category: '', expense_date: today(), note: '', member_id: null })

export function formDefaults(apiBase, myUid) {
  return {
    activeTab: 'expenses',
    showAdd: false,
    editId: null,
    expMode: 'create',
    expReturnMode: 'close',
    donMode: 'create',
    donForm: emptyDonForm(),
    expForm: emptyExpForm(),
    incomeTypes: INCOME_TYPES,
    donCats: DON_CATS,
    expCats: EXP_CATS,
    donMethods: DON_METHODS,
    donSaving: false,
    expSaving: false,
    addErr: null,
    extracting: false,
    delConfirm: false,
    deleting: false,
    actioning: false,
    actionNote: '',
    expRejecting: false,
    receiptPreview: '',
    receiptName: '',
    receipts: [],
    expReceiptSlide: 0,
    lightboxSrc: '',
    filePickerOpen: false,
    memberHits: [],
    memberQuery: '',
    vendorHits: [],
    expFull: false,
    donFull: false,
    detailExp: null,
    detailDon: null,
    expApprovals: [],
    expHistory: [],
    donHistory: [],
    expDirty: false,
    donDirty: false,
    apiBase,
    myUid,
    memberNames: {},
    userNames: {},
    fmt: fmtCat,
    fmtAmt,
    fmtCat,
    fmtDate,
    fmtStatus,
    timelineShortDate: shortDate,
    incomeModalTitle,
    expenseTitle,
    expenseModalTitle,
    expenseReceiptItems(existing = []) {
      const saved = (existing || []).map(x => ({ kind: 'saved', value: x }))
      const queued = (this.receipts || []).map(x => ({ kind: 'queued', value: x }))
      return [...saved, ...queued]
    },
    expenseReceiptDotClass(i) {
      return { 'receipt-dot-active': i === (this.expReceiptSlide || 0) }
    },
    syncExpenseReceiptSlide(e) {
      const el = e?.currentTarget
      if (!el) return
      const width = el.clientWidth || 1
      this.expReceiptSlide = Math.max(0, Math.round(el.scrollLeft / width))
    },
    jumpExpenseReceiptSlide(id, i) {
      this.expReceiptSlide = i
      const el = document.getElementById(id)
      const child = el?.children?.[i]
      if (child) child.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    },
    activityIcon,
    eventBadge,
    eventDetail,
    expenseCurrentStatusBadge(x = this.detailExp) {
      const st = x?.status || 'submitted'
      if (st === 'approved') return 'approved'
      if (st === 'paid') return 'paid'
      if (st === 'rejected') return 'rejected'
      return 'submitted'
    },
    expenseCurrentStatusText(x = this.detailExp) {
      const st = x?.status || 'submitted'
      if (st === 'submitted') return `Pending approval ${x?.approval_count || 0}/${x?.approvals_required || '?'}`
      if (st === 'approved') return 'Pending payment'
      if (st === 'paid') return 'Paid'
      if (st === 'rejected') return 'Rejected'
      return fmtStatus(st)
    },
  }
}

export function expIsEditable(s) {
  return !s.detailExp || s.expMode === 'edit'
}

export function expEditPolicy(s) {
  const status = s.detailExp?.status || ''
  const viewOnly = !!s.detailExp && s.expMode !== 'edit'
  const lockedAll = viewOnly || (s.expMode === 'edit' && status === 'rejected')
  const amountLocked = viewOnly || (s.expMode === 'edit' && (status === 'paid' || status === 'rejected'))
  const payeeLocked = viewOnly || (s.expMode === 'edit' && (status === 'paid' || status === 'rejected'))
  const dateLocked = viewOnly || (s.expMode === 'edit' && (status === 'paid' || status === 'rejected'))
  const message = viewOnly
    ? ''
    : lockedAll
      ? 'Rejected expenses cannot be edited.'
      : status === 'paid' && s.expMode === 'edit'
      ? 'Paid expense amount is locked. Category, note, payee, and date can still be updated.'
      : ''
  return { status, viewOnly, lockedAll, amountLocked, payeeLocked, dateLocked, message }
}

export function expGetAttachments(s) {
  return s.detailExp?.attachments || []
}

export function buildExpTimeline(s) {
  const entries = [...(s.expHistory || [])]
  for (const a of s.expApprovals) {
    const uid = a.approved_by || a.user_id || null
    const badge = a.action === 'approve' ? 'approved' : a.action === 'pay' ? 'paid' : a.action
    const label = a.action === 'approve' ? 'Approved' : a.action === 'reject' ? 'Rejected' : a.action === 'pay' ? 'Paid' : fmtCat(a.action)
    const detail = [a.note, a.reference ? `Ref ${a.reference}` : ''].filter(Boolean).join(' · ')
    entries.push({
      badge,
      label,
      actor: actorName(uid, s.userNames, s.myUid),
      uid,
      detail,
      date: a.created_at,
    })
  }
  entries.sort((a, b) => new Date(a.date) - new Date(b.date))
  return entries
}

function metaEntries(item, names, myUid, labelFn = eventLabel) {
  return buildMetaHistory(item).map(h => ({
    badge: eventBadge(h),
    label: labelFn(h),
    actor: actorName(h.user_id, names, myUid),
    uid: h.user_id,
    detail: eventDetail(h),
    date: h.created_at,
  })).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
}

export function bindForm(s, { api, onSave }) {
  let pendingExtracts = 0, _syncedAmt = '', formSession = 0
  const _today = today()

  function clearFileInputs() {
    document.querySelectorAll('#receipt-input, #don-receipt-input').forEach(el => {
      try { el.value = '' } catch {}
    })
  }

  function clearUploadState() {
    formSession++
    pendingExtracts = 0
    if (Array.isArray(s.receipts)) s.receipts.splice(0, s.receipts.length)
    else s.receipts = []
    s.expReceiptSlide = 0
    s.receiptPreview = ''
    s.receiptName = ''
    s.extracting = false
    s.lightboxSrc = ''
    s.filePickerOpen = false
    clearFileInputs()
  }

  function closeForm() {
    clearUploadState()
    s.showAdd = false
    requestAnimationFrame(() => resetForm())
  }

  function activeModalRoot(...ids) {
    const mods = [...document.querySelectorAll('.modal-overlay')]
    for (const mod of mods) {
      const style = window.getComputedStyle(mod)
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && mod.getClientRects().length > 0
      if (!visible) continue
      for (const id of ids) {
        if (mod.querySelector(`#${id}`)) return mod
      }
    }
    return document
  }

  function syncDonationControls() {
    requestAnimationFrame(() => {
      const root = activeModalRoot('don-donor', 'don-type', 'don-method', 'don-cat', 'don-date')
      const donor = root.querySelector('#don-donor')
      const type = root.querySelector('#don-type')
      const method = root.querySelector('#don-method')
      const cat = root.querySelector('#don-cat')
      const date = root.querySelector('#don-date')
      if (donor) donor.value = s.memberQuery || ''
      if (type) type.value = s.donForm.type || 'donation'
      if (method) method.value = s.donForm.method || 'cash'
      if (cat) cat.value = s.donForm.category || 'general'
      if (date) date.value = s.donForm.date_received || _today
    })
  }

  function syncExpenseControls() {
    requestAnimationFrame(() => {
      if (s.expDirty) return
      const root = activeModalRoot('exp-vendor', 'home-exp-vendor', 'exp-cat', 'home-exp-cat', 'exp-date', 'home-exp-date', 'exp-amount', 'home-exp-amount')
      const payee = root.querySelector('#exp-vendor, #home-exp-vendor')
      const cat = root.querySelector('#exp-cat, #home-exp-cat')
      const date = root.querySelector('#exp-date, #home-exp-date')
      const amount = root.querySelector('#exp-amount, #home-exp-amount')
      const wantPayee = s.expForm.payee || s.memberQuery || ''
      const wantCat = s.expForm.category || 'other'
      const wantDate = s.expForm.expense_date || _today
      const wantAmount = s.expForm.amount || ''

      if (payee) payee.value = wantPayee
      if (cat) cat.value = wantCat
      if (date) date.value = wantDate
      if (amount) amount.value = wantAmount
    })
  }

  function resetForm() {
    clearUploadState()
    document.querySelectorAll('.field-err').forEach(el => el.classList.remove('field-err'))
    document.querySelectorAll('.btn-loading').forEach(el => el.classList.remove('btn-loading'))
    s.editId = null; s.expMode = 'create'; s.expReturnMode = 'close'; s.donMode = 'create'; s.addErr = null; s.detailExp = null; s.detailDon = null
    s.memberQuery = ''; s.memberHits = []; s.vendorHits = []; s.expFull = false; s.donFull = false; s.expDirty = false; s.donDirty = false
    s.actionNote = ''; s.expRejecting = false
    s.donSaving = false; s.expSaving = false; s.delConfirm = false; s.deleting = false; s.actioning = false
    s.donForm = emptyDonForm(); s.expForm = emptyExpForm()
    s.expApprovals = []; s.expHistory = []; s.donHistory = []
    _syncedAmt = ''
  }

  async function hydrateExpenseSession(id, session) {
    if (!id) return
    const prevDetail = s.detailExp || null
    const [detail, approvals] = await Promise.all([
      api.getExpense(id).catch(() => null),
      api.getExpenseApprovals(id).catch(() => ({ items: [] })),
    ])
    if (session !== formSession || s.editId !== id) return
    if (detail) {
      const merged = {
        ...(prevDetail || {}),
        ...detail,
        approval_count: detail.approval_count ?? prevDetail?.approval_count,
        approvals_required: detail.approvals_required ?? prevDetail?.approvals_required,
      }
      s.detailExp = merged
      const cat = merged.category || 'other'
      if (!s.expDirty) {
        s.expForm.member_id = merged.member_id || null
        s.expForm.payee = merged.payee || ''
        s.expForm.amount = rawAmt(merged.amount)
        s.expForm.category = cat
        s.expForm.expense_date = (merged.expense_date || '').slice(0, 10)
        s.expForm.note = merged.note || merged.description || ''
        s.memberQuery = merged.member_id ? (merged.payee || s.memberNames[merged.member_id] || '') : ''
        syncExpenseControls()
      }
      s.expHistory = metaEntries(merged, s.userNames, s.myUid)
        // Removed syncExpenseControls() call to prevent value clobber
    }
    s.expApprovals = approvals.items || approvals || []
  }

  function openExpense(x, mode = 'edit', returnMode = 'close', rejecting = false) {
    s.showAdd = false
    resetForm()
    s.activeTab = 'expenses'
    const session = formSession
    requestAnimationFrame(() => {
      if (session !== formSession) return
      s.editId = x.id
      s.expMode = mode
      s.expReturnMode = returnMode
      s.detailExp = x
      const cat = x.category || 'other'
      s.expForm = {
        member_id: x.member_id || null,
        payee: x.payee || '',
        amount: rawAmt(x.amount),
        category: cat,
        expense_date: (x.expense_date || '').slice(0, 10),
        note: x.note || x.description || '',
      }
      s.memberQuery = x.member_id ? (x.payee || s.memberNames[x.member_id] || '') : ''
      s.expFull = true
      s.expDirty = false
      s.expRejecting = rejecting
      s.showAdd = true
      if (cat && !EXP_CATS.includes(cat)) setTimeout(() => {
        const root = activeModalRoot('exp-cat', 'home-exp-cat')
        const sel = root.querySelector('#exp-cat, #home-exp-cat')
        if (!sel || [...sel.options].some(o => o.value === cat)) return
        const opt = document.createElement('option')
        opt.value = cat; opt.textContent = fmtCat(cat)
        sel.prepend(opt); sel.value = cat
      })
      hydrateExpenseSession(x.id, session).catch(() => {})
    })
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
      closeForm()
      toast(msg, 'success')
      onSave()
    } catch (e) { s.addErr = e.message }
    finally { s.actioning = false }
  }

  s.openAdd = () => { resetForm(); s.activeTab = 'expenses'; s.expMode = 'create'; s.showAdd = true }
  s.openDonForm = () => { resetForm(); s.activeTab = 'income'; s.donMode = 'create'; s.showAdd = true; syncDonationControls() }
  s.cancelAdd = () => closeForm()

  s.beginExpenseEdit = () => {
    if (!s.detailExp || !s.editId) return
    if ((s.detailExp.status || '') !== 'submitted') return
    s.expMode = 'edit'
    s.expDirty = false
    syncExpenseControls()
  }

  s.viewExpense = x => openExpense(x, location.pathname.includes('/app/finance') ? 'edit' : 'view', 'close')
  s.editExpense = (x, returnMode = 'close') => openExpense(x, 'edit', returnMode)
  s.rejectExpense = x => openExpense(x, 'edit', 'close', true)

  const openDonation = d => {
    resetForm()
    s.activeTab = 'income'
    s.donMode = 'edit'
    s.editId = d.id
    s.detailDon = d
    s.donForm = {
      type: d.type || 'donation',
      amount: rawAmt(d.amount),
      method: d.method || 'cash',
      category: d.category || 'general',
      date_received: (d.date_received || '').slice(0, 10),
      note: d.note || '',
      member_id: d.member_id || null,
      attachment: null,
    }
    s.memberQuery = d.member_id ? (s.memberNames[d.member_id] || d.source_name || '') : (d.source_name || '')
    s.donFull = true
    s.showAdd = true
    s.donHistory = metaEntries(d, s.userNames, s.myUid, eventLabel)
    syncDonationControls()
  }

  s.viewDonation = d => openDonation(d)
  s.editDonation = d => openDonation(d)

  s.cancelDonationEdit = () => {
    s.cancelAdd()
  }

  s.cancelExpenseEdit = () => {
    s.cancelAdd()
  }

  s.openExpenseReject = () => {
    s.addErr = null
    s.expRejecting = true
  }

  s.cancelExpenseReject = () => {
    s.expRejecting = false
    s.actionNote = ''
    s.addErr = null
  }

  s.syncDonAmount = e => {
    const pos = e.target.selectionStart
    s.donForm.amount = e.target.value
    requestAnimationFrame(() => {
      try { e.target.setSelectionRange(pos, pos) } catch {}
    })
  }

  s.filterDonors = q => {
    s.memberQuery = q
    const topDonors = (s.donorRows || []).filter(d => d.member_id).map(d => ({ id: d.member_id, name: d.name }))
    const all = Object.entries(s.memberNames || {}).map(([id, name]) => ({ id: +id, name }))
    s.memberHits = (q ? all.filter(m => m.name.toLowerCase().includes(q.toLowerCase())) : (topDonors.length ? topDonors : all)).slice(0, 5)
  }
  s.selectDonor = m => { s.donForm.member_id = m.id; s.memberQuery = m.name; s.memberHits = [] }
  s.clearDonor = () => { s.donForm.member_id = null; s.memberQuery = ''; s.memberHits = [] }

  s.filterExpensePayees = q => {
    s.memberQuery = q
    s.expForm.payee = q
    s.expDirty = true
    const allMembers = Object.entries(s.memberNames || {}).map(([id, name]) => ({ id: +id, name }))
    const memberHits = (q ? allMembers.filter(m => m.name.toLowerCase().includes(q.toLowerCase())) : allMembers).slice(0, 5)
    if (!memberHits.length && s.expForm.member_id && s.memberQuery) memberHits.push({ id: s.expForm.member_id, name: s.memberQuery })
    s.memberHits = memberHits
    const seen = new Set()
    const src = s.expenses || s.myExpenses || []
    s.vendorHits = src
      .map(x => x.payee)
      .filter(v => v && !seen.has(v) && (seen.add(v), !q || v.toLowerCase().includes(q.toLowerCase())))
      .slice(0, 5)
  }
  s.selectExpMember = m => {
    s.expForm.member_id = m.id
    s.expForm.payee = m.name
    s.expDirty = true
    s.memberQuery = m.name
    s.memberHits = []
    s.vendorHits = []
  }
  s.selectExpVendor = v => {
    s.expForm.member_id = null
    s.expForm.payee = v
    s.expDirty = true
    s.memberQuery = ''
    s.memberHits = []
    s.vendorHits = []
  }
  s.clearExpMember = () => {
    s.expForm.member_id = null
    s.expForm.payee = ''
    s.expDirty = true
    s.memberQuery = ''
    s.memberHits = []
    s.vendorHits = []
  }

  s.scanFile = async file => {
    if (!file) return
    const session = formSession
    s.extracting = true; s.addErr = null; s.receiptName = file.name
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => { if (session === formSession) s.receiptPreview = reader.result }
      reader.readAsDataURL(file)
    } else s.receiptPreview = ''
    try {
      let res = await api.uploadDoc(file, 'donation')
      if (session !== formSession) return
      let isDup = false
      if (res.duplicate) {
        if (!res.can_claim) { isDup = true; toast('Possible duplicate — this receipt was uploaded before', 'warn') }
        else res = await api.claimAttachment(res.attachment.id)
        if (session !== formSession) return
      }
      const d = res.extracted_data || res.attachment?.extracted_data || {}
      const amt = parseFloat(d.amount)
      if (amt > 0 && amt < AMT_MAX) s.donForm.amount = d.amount
      if (d.method) s.donForm.method = d.method
      if (d.category) s.donForm.category = d.category
      if (d.date) s.donForm.date_received = d.date
      s.donForm.attachment = isDup ? null : (res.attachment || null)
    } catch (e) {
      if (session === formSession) toast(e.message)
    } finally {
      if (session === formSession) s.extracting = false
    }
  }

  s.addReceipts = async fileList => {
    if (!fileList?.length) return
    const session = formSession
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
          rd.onload = () => {
            if (session === formSession && s.receipts.includes(r)) r.preview = rd.result
          }
          rd.readAsDataURL(file)
        }
        try {
          let res = await api.uploadDoc(file, 'expense')
          if (session !== formSession || !s.receipts.includes(r)) return
          if (res.duplicate) {
            if (!res.can_claim) {
              r.duplicate = true
              r.data = res.extracted_data || res.attachment?.extracted_data || {}
              r.extracting = false
              syncExpReceipts()
              return
            }
            res = await api.claimAttachment(res.attachment.id)
            if (session !== formSession || !s.receipts.includes(r)) return
          }
          r.data = res.extracted_data || res.attachment?.extracted_data || {}
          r.attachment = res.attachment || null
        } catch (e) {
          if (session !== formSession || !s.receipts.includes(r)) return
          r.err = e.message; toast(e.message)
        }
        if (session !== formSession || !s.receipts.includes(r)) return
        r.extracting = false
        syncExpReceipts()
      }))
    } finally {
      if (session === formSession) {
        pendingExtracts = Math.max(0, pendingExtracts - 1)
        s.extracting = pendingExtracts > 0
      }
    }
  }

  s.removeReceipt = r => {
    const i = s.receipts.indexOf(r)
    if (i >= 0) s.receipts.splice(i, 1)
    s.expReceiptSlide = Math.max(0, s.expReceiptSlide || 0)
    syncExpReceipts()
  }

  s.saveDonation = async () => {
    if (s.extracting) { s.addErr = 'Please wait for receipt processing.'; return }
    s.addErr = null; s.donSaving = true
    try {
      const f = s.donForm
      const data = { amount: toCents(f.amount), attachment_ids: !s.editId && f.attachment ? [f.attachment.id] : undefined }
      if (f.type) data.type = f.type
      if (f.method) data.method = f.method
      if ((f.type || 'donation') === 'donation' && f.category) data.category = f.category
      if (f.date_received) data.date_received = f.date_received
      if (f.note) data.note = f.note
      if (f.member_id) data.member_id = f.member_id
      if (!f.member_id && s.memberQuery?.trim()) data.source_name = s.memberQuery.trim()
      if (!f.member_id && (s.memberQuery?.trim() || s.detailDon?.member_id)) data.member_id = null
      if (s.editId) {
        if ((f.type || 'donation') === 'donation') await api.updateDonation(s.editId, data)
        else await api.updateIncome(s.editId, data)
      } else {
        if ((f.type || 'donation') === 'donation') await api.createDonation(data)
        else await api.createIncome(data)
      }
      toast(s.editId ? 'Income updated' : 'Income saved', 'success')
      document.querySelectorAll('.field-err').forEach(el => el.classList.remove('field-err'))
      closeForm()
      onSave()
    } catch (e) { s.addErr = setErr(e.message, 'don', DON_FIELDS) }
    finally { s.donSaving = false }
  }

  s.saveExpense = async () => {
    if (pendingExtracts > 0) { s.addErr = 'Please wait for receipt processing.'; return }
    s.addErr = null; s.expSaving = true
    try {
      const f = s.expForm
      const root = activeModalRoot('exp-vendor', 'home-exp-vendor')
      const payeeInput = root.querySelector('#exp-vendor, #home-exp-vendor')
      const payeeVal = (payeeInput?.value || f.payee || '').trim()
      const memberName = f.member_id ? (s.memberNames[f.member_id] || s.memberQuery || f.payee || '') : ''
      const keepMember = !!f.member_id && (!payeeVal || payeeVal === memberName)
      const data = { amount: toCents(f.amount) }
      if (payeeVal) data.payee = payeeVal
      if (f.note) data.note = f.note
      if (f.category) data.category = f.category
      if (f.expense_date) data.expense_date = f.expense_date
      if (keepMember) data.member_id = f.member_id
      else if (payeeVal || s.detailExp?.member_id) data.member_id = null
      if (s.editId) {
        await api.updateExpense(s.editId, data)
      } else {
        const attIds = s.receipts.filter(r => r.attachment).map(r => r.attachment.id)
        if (attIds.length) data.attachment_ids = attIds
        await api.createExpense(data)
      }
      toast(s.editId ? 'Expense updated' : 'Expense saved', 'success')
      document.querySelectorAll('.field-err').forEach(el => el.classList.remove('field-err'))
      closeForm()
      onSave()
    } catch (e) { s.addErr = setErr(e.message, 'exp', EXP_FIELDS) }
    finally { s.expSaving = false }
  }

  s.delDonation = async () => {
    s.deleting = true
    try { await api.deleteDonation(s.editId); closeForm(); onSave() }
    catch (e) { s.addErr = e.message }
    finally { s.deleting = false }
  }

  s.printDonation = d => {
    if (!d) return
    printHtml(donationReceiptHtml(d, s.memberNames))
  }

  s.delExpense = async () => {
    s.deleting = true
    try { await api.deleteExpense(s.editId); closeForm(); onSave() }
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
    if (!s.actionNote.trim()) { s.addErr = 'Reason is required'; return }
    await expAction(async () => { await api.rejectExpense(s.editId, s.actionNote.trim()); return 'Expense rejected' })
  }

  s.payExp = async () => {
    await expAction(async () => { await api.payExpense(s.editId, ''); return 'Expense marked as paid' })
  }

  return { resetForm }
}
