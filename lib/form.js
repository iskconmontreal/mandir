// Finance form controller: shared add/edit expense and donation logic
// FEATURE: finance — reusable form behavior for dashboard and finance pages

import { fmtCat, fmtAmt, rawAmt, toCents, toast } from './app.js'
import { DON_CATS, EXP_CATS, DON_METHODS, EXP_METHODS, INCOME_TYPES, AMT_MAX, DON_FIELDS, EXP_FIELDS, fmtStatus, fmtDate, eventBadge, eventLabel, eventDetail, actorName, setErr, buildMetaHistory, expenseTitle, expenseModalTitle, incomeModalTitle } from './finance.js'
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
export const emptyExpForm = () => ({ payee: '', amount: '', category: '', expense_date: '', note: '', member_id: null, gst: '', pst: '', items: [{ desc: '', amount: '', gst: '', pst: '' }] })

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
    expMethods: EXP_METHODS,
    donSaving: false,
    expSaving: false,
    addErr: null,
    extracting: false,
    delConfirm: false,
    deleting: false,
    actioning: false,
    actionNote: '',
    payRef: '',
    payMethod: '',
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
    expHistory: [],
    expTimelineExpanded: false,
    donHistory: [],
    expDirty: false,
    donDirty: false,
    pendingDeletes: new Set(),
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
      if (child) child.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    },
    activityIcon,
    eventBadge,
    eventDetail,
    expenseHasActions(x = this.detailExp) {
      const st = x?.status
      if (!st) return false
      if (st === 'closed' || st === 'rejected') return false
      if ((st === 'submitted' || st === 'approved' || st === 'paid') && this.can('expenses:approve')) return true
      if (st === 'submitted') return true // show approval counter even for non-approvers
      return false
    },
    expenseCurrentStatusBadge(x = this.detailExp) {
      const st = x?.status || 'submitted'
      if (st === 'approved') return 'approved'
      if (st === 'paid') return 'paid'
      if (st === 'closed') return 'closed'
      if (st === 'rejected') return 'rejected'
      return 'submitted'
    },
    expenseCurrentStatusText(x = this.detailExp) {
      const st = x?.status || 'submitted'
      if (st === 'submitted') return `Approval ${x?.approval_count || 0}/${x?.approvals_required || '?'}`
      if (st === 'approved') return 'Payment'
      if (st === 'paid') return 'Close'
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
  const admin = s.hasRole?.('administrator') || s.hasRole?.('admin')
  const editing = s.expMode === 'edit'
  const lockedAll = viewOnly || (editing && status === 'rejected' && !admin)
  const paidLocked = editing && status === 'paid'
  const rejectedLocked = editing && status === 'rejected' && !admin
  const amountLocked = viewOnly || paidLocked || rejectedLocked
  const payeeLocked = viewOnly || paidLocked || rejectedLocked
  const dateLocked = viewOnly || paidLocked || rejectedLocked
  const message = viewOnly
    ? ''
    : lockedAll
      ? 'Rejected — submit a new expense instead.'
      : paidLocked
      ? 'Paid expense — only category and note can be updated.'
      : ''
  return { status, viewOnly, lockedAll, amountLocked, payeeLocked, dateLocked, message }
}

export function expGetAttachments(s) {
  const all = s.detailExp?.attachments || []
  return s.pendingDeletes?.size ? all.filter(a => !s.pendingDeletes.has(a.id)) : all
}

export function buildExpTimeline(s) {
  const all = [...(s.expHistory || [])].sort((a, b) => new Date(a.date) - new Date(b.date))
  if (all.length <= 3 || s.expTimelineExpanded) return all
  return [all[0], { collapsed: all.length - 2 }, all[all.length - 1]]
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
  let pendingExtracts = 0, formSession = 0, receiptUid = 0
  const _today = today()
  const dirtyFields = new Set()

  function clearFileInputs() {
    document.querySelectorAll('#exp-receipt-input, #don-receipt-input').forEach(el => {
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
      const root = activeModalRoot('exp-vendor', 'exp-cat', 'exp-date', 'exp-amount')
      const payee = root.querySelector('#exp-vendor')
      const cat = root.querySelector('#exp-cat')
      const date = root.querySelector('#exp-date')
      const amount = root.querySelector('#exp-amount')
      const wantPayee = s.expForm.payee || s.memberQuery || ''
      const wantCat = s.expForm.category || 'other'
      const wantDate = s.expForm.expense_date || ''
      const wantAmount = s.expForm.amount || ''

      if (payee) payee.value = wantPayee
      if (cat) cat.value = wantCat
      if (date) date.value = wantDate
      if (amount) amount.value = wantAmount
    })
  }

  function resetForm() {
    clearUploadState()
    dirtyFields.clear()
    document.querySelectorAll('.field-err').forEach(el => el.classList.remove('field-err'))
    document.querySelectorAll('.btn-loading').forEach(el => el.classList.remove('btn-loading'))
    s.editId = null; s.expMode = 'create'; s.expReturnMode = 'close'; s.donMode = 'create'; s.addErr = null; s.detailExp = null; s.detailDon = null
    s.memberQuery = ''; s.memberHits = []; s.vendorHits = []; s.expFull = false; s.donFull = false; s.expDirty = false; s.donDirty = false; s.pendingDeletes = new Set()
    s.actionNote = ''; s.payRef = ''; s.payMethod = ''; s.expRejecting = false
    s.donSaving = false; s.expSaving = false; s.delConfirm = false; s.deleting = false; s.actioning = false
    s.donForm = emptyDonForm(); s.expForm = emptyExpForm()
    s.expHistory = []; s.expTimelineExpanded = false; s.donHistory = []
      }

  async function hydrateExpenseSession(id, session) {
    if (!id) return
    const prevDetail = s.detailExp || null
    const detail = await api.getExpense(id).catch(() => null)
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
        s.expForm.gst = merged.gst ? rawAmt(merged.gst) : ''
        s.expForm.pst = merged.pst ? rawAmt(merged.pst) : ''
        if (merged.details?.items?.length) {
          s.expForm.items = merged.details.items.map(it => ({ _aid: it._aid || null, desc: it.desc || '', amount: it.amount || '', gst: it.gst || '', pst: it.pst || '' }))
        }
        s.memberQuery = merged.member_id ? (merged.payee || s.memberNames[merged.member_id] || '') : ''
        syncExpenseControls()
      }
      s.expHistory = metaEntries(merged, s.userNames, s.myUid)
    }
  }

  function openExpense(x, mode = 'edit', returnMode = 'close', rejecting = false, autoAttach = false) {
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
        gst: x.gst ? rawAmt(x.gst) : '',
        pst: x.pst ? rawAmt(x.pst) : '',
        items: x.details?.items?.length
          ? x.details.items.map(it => ({ _aid: it._aid || null, desc: it.desc || '', amount: it.amount || '', gst: it.gst || '', pst: it.pst || '' }))
          : [{ desc: x.payee || '', amount: rawAmt(x.amount), gst: x.gst ? rawAmt(x.gst) : '', pst: x.pst ? rawAmt(x.pst) : '' }],
      }
      s.memberQuery = x.member_id ? (x.payee || s.memberNames[x.member_id] || '') : ''
      s.expFull = true
      s.expDirty = false
      s.expRejecting = rejecting
      s.showAdd = true
      if (cat && !EXP_CATS.includes(cat)) setTimeout(() => {
        const root = activeModalRoot('exp-cat')
        const sel = root.querySelector('#exp-cat')
        if (!sel || [...sel.options].some(o => o.value === cat)) return
        const opt = document.createElement('option')
        opt.value = cat; opt.textContent = fmtCat(cat)
        sel.prepend(opt); sel.value = cat
      })
      if (autoAttach) setTimeout(() => {
        const input = document.getElementById('exp-receipt-input')
        if (input) input.click()
      }, 200)
      hydrateExpenseSession(x.id, session).catch(() => {})
    })
  }

  const parseTax = v => { if (v == null) return 0; const n = parseFloat(v); return isNaN(n) ? 0 : n }

  function receiptToItem(r) {
    const d = r.data
    const amt = parseFloat(d.amount) || 0
    const gst = parseTax(d.taxes?.TPS)
    const pst = parseTax(d.taxes?.TVQ)
    return { _rid: r._uid, _aid: r.attachment?.id || null, desc: d.vendor || d.description || '', amount: amt ? amt.toFixed(2) : '', gst: gst ? gst.toFixed(2) : '', pst: pst ? pst.toFixed(2) : '' }
  }

  function syncExpReceipts() {
    const items = s.expForm.items
    let earliest = null

    // Upsert: match receipt→item by _rid, append if new
    for (const r of s.receipts) {
      if (!r.data) continue
      const d = r.data
      if (d.date) {
        const dt = new Date(d.date)
        if (!isNaN(dt) && (!earliest || dt < earliest)) earliest = dt
      }
      const existing = items.find(it => it._rid === r._uid)
      if (existing) continue
      // Replace the initial empty row if it's the only one
      if (items.length === 1 && !items[0]._rid && !items[0].desc && !(parseFloat(items[0].amount) > 0)) {
        items[0] = receiptToItem(r)
      } else {
        items.push(receiptToItem(r))
      }
    }

    // Remove items whose receipt was deleted (but keep user-typed items without _rid)
    const activeRids = new Set(s.receipts.map(r => r._uid))
    s.expForm.items = items.filter(it => !it._rid || activeRids.has(it._rid))
    if (!s.expForm.items.length) s.expForm.items = [{ desc: '', amount: '', gst: '', pst: '' }]

    s.syncItemTotals()

    const first = s.receipts.find(r => r.data)?.data
    if (!first) return
    if (first.vendor || first.category || first.date) s.expFull = true

    if (!dirtyFields.has('date') && !s.expForm.expense_date && earliest) {
      s.expForm.expense_date = earliest.toISOString().slice(0, 10)
    }
    if (!dirtyFields.has('category') && !s.expForm.category && first.category) s.expForm.category = first.category
    syncExpenseControls()
  }

  s.syncItemTotals = () => {
    const items = s.expForm.items || []
    if (!items.length) return
    s.expForm.amount = items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0).toFixed(2)
        s.expForm.gst = items.reduce((sum, i) => sum + (parseFloat(i.gst) || 0), 0).toFixed(2)
    s.expForm.pst = items.reduce((sum, i) => sum + (parseFloat(i.pst) || 0), 0).toFixed(2)
    syncExpenseControls()
  }

  s.expItemTotal = field => (s.expForm.items || []).reduce((sum, i) => sum + (parseFloat(i[field]) || 0), 0).toFixed(2)

  s.addExpItem = () => {
    s.expForm.items = [...s.expForm.items, { desc: '', amount: '', gst: '', pst: '' }]
  }

  s.removeExpItem = i => {
    if (s.expForm.items.length <= 1) return
    s.expForm.items = s.expForm.items.filter((_, idx) => idx !== i)
    s.syncItemTotals()
  }

  s.pruneExpItem = i => {
    const items = s.expForm.items
    if (items.length <= 1) return
    const it = items[i]
    if (it && !it.desc && !(parseFloat(it.amount) > 0) && !(parseFloat(it.gst) > 0) && !(parseFloat(it.pst) > 0)) {
      s.removeExpItem(i)
    }
  }

  async function expAction(fn, { close = true } = {}) {
    s.actioning = true
    try {
      const msg = await fn()
      if (close) closeForm()
      toast(msg, 'success')
      onSave()
      if (!close && s.editId) hydrateExpenseSession(s.editId, formSession).catch(() => {})
    } catch (e) { s.addErr = e.message }
    finally { s.actioning = false }
  }

  s.markDirty = field => { dirtyFields.add(field); s.expDirty = true }

  // Delegated handler — survives sprae re-renders
  document.addEventListener('change', e => {
    if (e.target.id === 'exp-receipt-input') {
      s.filePickerOpen = false
      s.addReceipts(e.target.files)
      e.target.value = ''
    }
  })
  document.addEventListener('cancel', e => {
    if (e.target.id === 'exp-receipt-input') s.filePickerOpen = false
  }, true)

  s.openAdd = () => { resetForm(); s.activeTab = 'expenses'; s.expMode = 'create'; s.showAdd = true }
  s.openDonForm = () => { resetForm(); s.activeTab = 'income'; s.donMode = 'create'; s.showAdd = true; syncDonationControls() }
  s.cancelAdd = () => closeForm()

  s.beginExpenseEdit = () => {
    if (!s.detailExp || !s.editId) return
    const admin = s.hasRole?.('administrator') || s.hasRole?.('admin')
    if (!admin && (s.detailExp.status || '') !== 'submitted') return
    s.expMode = 'edit'
    s.expDirty = false
    syncExpenseControls()
  }

  s.viewExpense = x => {
    const editable = (x.status || 'submitted') === 'submitted' || s.can?.('expenses:approve')
    openExpense(x, editable ? 'edit' : 'view', 'close')
  }
  s.editExpense = (x, returnMode = 'close') => openExpense(x, 'edit', returnMode)
  s.attachExpense = x => openExpense(x, 'edit', 'close', false, true)
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
    const hasChanges = s.expDirty || s.pendingDeletes?.size || s.receipts?.length
    if (hasChanges && !confirm('Discard unsaved changes?')) return
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
    dirtyFields.add('payee')
    s.expDirty = true
    const allMembers = Object.entries(s.memberNames || {}).map(([id, name]) => ({ id: +id, name }))
    const memberHits = (q ? allMembers.filter(m => m.name.toLowerCase().includes(q.toLowerCase())) : allMembers).slice(0, 5)
    if (!memberHits.length && s.expForm.member_id && s.memberQuery) memberHits.push({ id: s.expForm.member_id, name: s.memberQuery })
    s.memberHits = memberHits
    s.vendorHits = []
  }
  function setExpPayee(memberId, payee, query) {
    s.expForm.member_id = memberId
    s.expForm.payee = payee
    s.expDirty = true
    s.memberQuery = query
    s.memberHits = []
    s.vendorHits = []
  }
  s.selectExpMember = m => setExpPayee(m.id, m.name, m.name)
  s.selectExpVendor = v => setExpPayee(null, v, '')
  s.clearExpMember = () => setExpPayee(null, '', '')

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
      const mismatches = []
      if (amt > 0 && amt < AMT_MAX) {
        if (!s.donForm.amount) s.donForm.amount = d.amount
        else if (parseFloat(s.donForm.amount) !== amt) mismatches.push(`amount: $${d.amount}`)
      }
      if (d.method) {
        if (!s.donForm.method || s.donForm.method === 'cash') s.donForm.method = d.method
        else if (s.donForm.method !== d.method) mismatches.push(`method: ${d.method}`)
      }
      if (d.category) {
        if (!s.donForm.category || s.donForm.category === 'general') s.donForm.category = d.category
        else if (s.donForm.category !== d.category) mismatches.push(`category: ${d.category}`)
      }
      if (d.date) {
        if (!s.donForm.date_received || s.donForm.date_received === _today) s.donForm.date_received = d.date
        else if (s.donForm.date_received !== d.date) mismatches.push(`date: ${d.date}`)
      }
      if (mismatches.length) toast('Receipt differs: ' + mismatches.join(', '), 'warn')
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
    const newReceipts = files.map(f => ({ _uid: ++receiptUid, name: f.name, size: f.size, preview: '', data: null, extracting: true, err: null }))
    s.receipts = [...s.receipts, ...newReceipts]
    const hasReceipt = r => s.receipts.some(x => x._uid === r._uid)
    try {
      await Promise.all(files.map(async (file, i) => {
        const r = s.receipts[startIdx + i]
        if (file.type.startsWith('image/')) {
          const rd = new FileReader()
          rd.onload = () => {
            if (session === formSession && hasReceipt(r)) r.preview = rd.result
          }
          rd.readAsDataURL(file)
        }
        try {
          let res = await api.uploadDoc(file, 'expense')
          if (session !== formSession || !hasReceipt(r)) return
          if (res.duplicate) {
            if (!res.can_claim) {
              r.duplicate = true
              r.data = res.extracted_data || res.attachment?.extracted_data || {}
              r.extracting = false
              syncExpReceipts()
              return
            }
            res = await api.claimAttachment(res.attachment.id)
            if (session !== formSession || !hasReceipt(r)) return
          }
          r.data = res.extracted_data || res.attachment?.extracted_data || {}
          r.attachment = res.attachment || null
        } catch (e) {
          if (session !== formSession || !hasReceipt(r)) return
          r.err = e.message; toast(e.message)
        }
        if (session !== formSession || !hasReceipt(r)) return
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
    const i = r._uid != null ? s.receipts.findIndex(x => x._uid === r._uid) : s.receipts.indexOf(r)
    if (i >= 0) s.receipts.splice(i, 1)
    s.expReceiptSlide = Math.max(0, Math.min(s.expReceiptSlide || 0, s.receipts.length - 1))
    syncExpReceipts()
  }

  s.deleteSavedAttachment = async att => {
    // In expense edit mode, queue deletion for Update
    if (s.detailExp && s.expMode === 'edit') {
      if (s.detailExp.status === 'paid' && !confirm('This will break the paid expense record. Delete receipt?')) return
      s.pendingDeletes = new Set([...s.pendingDeletes, att.id])
      // Remove linked item row
      const items = s.expForm.items
      const idx = items.findIndex(it => it._aid === att.id)
      if (idx >= 0) {
        if (items.length > 1) items.splice(idx, 1)
        else items[0] = { desc: '', amount: '', gst: '', pst: '' }
        s.expForm.items = [...items]
        s.syncItemTotals()
      }
      s.expDirty = true
      return
    }
    // Donations or non-edit: delete immediately
    if (!confirm(`Delete "${att.original_name || 'attachment'}"?`)) return
    try {
      await api.deleteAttachment(att.id)
      if (s.detailExp?.attachments) {
        s.detailExp = { ...s.detailExp, attachments: s.detailExp.attachments.filter(a => a.id !== att.id) }
      }
      if (s.detailDon?.attachments) {
        s.detailDon = { ...s.detailDon, attachments: s.detailDon.attachments.filter(a => a.id !== att.id) }
      }
      toast('Attachment deleted', 'success')
    } catch (e) {
      toast('Failed to delete attachment', 'err')
    }
  }

  s.saveDonation = async () => {
    if (s.extracting) { s.addErr = 'Please wait for receipt processing.'; return }
    s.addErr = null; s.donSaving = true
    try {
      const f = s.donForm
      const data = { amount: toCents(f.amount), attachment_ids: f.attachment ? [f.attachment.id] : undefined }
      if (f.type) data.type = f.type
      if (f.method) data.method = f.method
      if ((f.type || 'donation') === 'donation' && f.category) data.category = f.category
      if (f.date_received) data.date_received = f.date_received
      if (f.note) data.note = f.note
      if (f.member_id) data.member_id = f.member_id
      if (!f.member_id && s.memberQuery?.trim()) data.source_name = s.memberQuery.trim()
      if (!f.member_id && (s.memberQuery?.trim() || s.detailDon?.member_id)) data.member_id = null
      let saved
      if (s.editId) {
        if ((f.type || 'donation') === 'donation') saved = await api.updateDonation(s.editId, data)
        else saved = await api.updateIncome(s.editId, data)
      } else {
        if ((f.type || 'donation') === 'donation') saved = await api.createDonation(data)
        else saved = await api.createIncome(data)
      }
      toast(s.editId ? 'Income updated' : 'Income saved', 'success')
      document.querySelectorAll('.field-err').forEach(el => el.classList.remove('field-err'))
      closeForm()
      onSave({ type: 'income', id: saved?.id || s.editId })
    } catch (e) { s.addErr = setErr(e.message, 'don', DON_FIELDS) }
    finally { s.donSaving = false }
  }

  s.saveExpense = async () => {
    if (pendingExtracts > 0) { s.addErr = 'Please wait for receipt processing.'; return }
    s.addErr = null; s.expSaving = true
    try {
      const f = s.expForm
      const root = activeModalRoot('exp-vendor')
      const payeeInput = root.querySelector('#exp-vendor')
      const payeeVal = (payeeInput?.value || f.payee || '').trim()
      const memberName = f.member_id ? (s.memberNames[f.member_id] || s.memberQuery || f.payee || '') : ''
      const keepMember = !!f.member_id && (!payeeVal || payeeVal === memberName)
      const data = { amount: toCents(f.amount) }
      data.gst = toCents(f.gst || '0')
      data.pst = toCents(f.pst || '0')
      const items = (f.items || []).filter(it => it.desc || parseFloat(it.amount) > 0)
        .map(({ _rid, ...rest }) => rest)
      if (items.length) data.details = { items }
      if (payeeVal) data.payee = payeeVal
      if (f.note) data.note = f.note
      if (f.category) data.category = f.category
      data.expense_date = f.expense_date || today()
      if (keepMember) data.member_id = f.member_id
      else if (payeeVal || s.detailExp?.member_id) data.member_id = null
      const attIds = s.receipts.filter(r => r.attachment).map(r => r.attachment.id)
      if (attIds.length) data.attachment_ids = attIds
      let saved
      if (s.editId) {
        saved = await api.updateExpense(s.editId, data)
      } else {
        saved = await api.createExpense(data)
      }
      // Delete queued attachments after successful save
      const delErrors = []
      for (const id of s.pendingDeletes) {
        try { await api.deleteAttachment(id) } catch { delErrors.push(id) }
      }
      s.pendingDeletes = new Set()
      if (delErrors.length) toast(`${delErrors.length} attachment(s) failed to delete`, 'warn')
      toast(s.editId ? 'Expense updated' : 'Expense saved', 'success')
      document.querySelectorAll('.field-err').forEach(el => el.classList.remove('field-err'))
      closeForm()
      onSave({ type: 'expense', id: saved?.id || s.editId })
    } catch (e) { s.addErr = setErr(e.message, 'exp', EXP_FIELDS) }
    finally { s.expSaving = false }
  }

  async function delRecord(apiFn) {
    s.deleting = true
    try { await apiFn(s.editId); closeForm(); onSave() }
    catch (e) { s.addErr = e.message }
    finally { s.deleting = false }
  }
  s.delDonation = () => delRecord(api.deleteDonation)
  s.delExpense = () => delRecord(api.deleteExpense)

  s.printDonation = d => {
    if (!d) return
    printHtml(donationReceiptHtml(d, s.memberNames))
  }

  s.approveExp = async () => {
    await expAction(async () => {
      const r = await api.approveExpense(s.editId, s.actionNote)
      const exp = r.expense || r
      if (exp) s.detailExp = { ...s.detailExp, ...exp, approval_count: r.approval_count, approvals_required: r.approvals_required }
      return exp.status === 'approved' ? 'Expense approved' : `Approval recorded (${r.approval_count}/${r.approvals_required})`
    }, { close: false })
  }

  s.rejectExp = async () => {
    if (!s.actionNote.trim()) { s.addErr = 'Reason is required'; return }
    await expAction(async () => { await api.rejectExpense(s.editId, s.actionNote.trim()); return 'Expense rejected' })
  }

  s.payExp = async () => {
    await expAction(async () => {
      const r = await api.payExpense(s.editId, s.payRef.trim(), s.payMethod || '')
      if (r) s.detailExp = { ...s.detailExp, ...r }
      return 'Expense marked as paid'
    }, { close: false })
  }

  s.closeExp = async () => {
    await expAction(async () => { await api.closeExpense(s.editId); return 'Expense closed' })
  }

  return { resetForm }
}
