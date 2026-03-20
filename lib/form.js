// Finance shared utilities
// - formDefaults: minimal page state (memberNames, userNames)
// - createPrintDonation: donation receipt printing

import { fmtCat, fmtAmt } from './app.js'

const logoUrl = new URL('../assets/iskcon-montreal.svg', import.meta.url).href
const tokensUrl = new URL('../css/tokens.css', import.meta.url).href
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const longDate = d => d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'
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
      body { margin: 0; color: var(--c-text); font: var(--f-md)/1.5 var(--f-sans); }
      .sheet { width: min(100%, 8.5in); margin: 0 auto; padding: calc(var(--s-xl) + var(--s-sm)); background: var(--c-surface); }
      .head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-lg); padding-bottom: var(--s-lg); border-bottom: 1px solid var(--c-border); }
      .brand { display: flex; align-items: center; gap: var(--s-md); }
      .logo { width: 4rem; height: 4rem; object-fit: contain; }
      .brand h1 { margin: 0; font-size: var(--f-xl); }
      .brand p, .meta-copy, .foot, .hint { color: var(--c-text-dim); }
      .brand p, .meta-copy, .hint, .foot, .note p, dd, dt { margin: 0; }
      .badge { display: inline-flex; align-items: center; gap: var(--s-xs); padding: var(--s-xs) var(--s-sm); border-radius: 999px; background: ${official ? 'var(--c-ok-active)' : 'var(--c-accent-hover)'}; color: ${official ? 'var(--c-ok)' : 'var(--c-accent)'}; font-size: var(--f-sm); font-weight: var(--f-wt-b); }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-md); margin-top: var(--s-lg); }
      .card { padding: var(--s-md); border: 1px solid var(--c-border); border-radius: var(--r-md); background: linear-gradient(180deg, var(--c-surface), rgba(0, 0, 0, 0)); }
      .card h2 { margin: 0 0 var(--s-sm); font-size: var(--f-md); }
      dl { display: grid; grid-template-columns: minmax(8rem, 11rem) minmax(0, 1fr); gap: var(--s-xs) var(--s-md); }
      dt { color: var(--c-text-dim); font-size: var(--f-sm); }
      dd strong { font-size: var(--f-lg); }
      .note { margin-top: var(--s-lg); padding: var(--s-md); border-radius: var(--r-md); background: var(--c-bg); border: 1px solid var(--c-border); }
      .note p { white-space: pre-wrap; }
      .foot { margin-top: var(--s-lg); padding-top: var(--s-md); border-top: 1px solid var(--c-border); font-size: var(--f-sm); }
      @media (max-width: 720px) { .sheet { padding: var(--s-lg); } .head, .brand { flex-direction: column; } .grid, dl { grid-template-columns: 1fr; } }
      @media print { body { background: var(--c-surface); } .sheet { width: auto; padding: 0; } }
    </style>
  </head>
  <body>
    <main class="sheet">
      <header class="head">
        <div class="brand">
          <img class="logo" src="${logoUrl}" alt="ISKCON Montreal">
          <div><h1>ISKCON Montreal</h1><p>${esc(status)}</p></div>
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
            <dt>Name</dt><dd>${esc(src)}</dd>
            <dt>Gift type</dt><dd>${esc(fmtCat(kind))}</dd>
            <dt>Method</dt><dd>${esc(fmtCat(d?.method || '—'))}</dd>
            <dt>Date received</dt><dd>${esc(longDate(d?.date_received))}</dd>
          </dl>
        </article>
        <article class="card">
          <h2>Receipt</h2>
          <dl>
            <dt>Receipt no.</dt><dd>${esc(receiptNo || 'Pending')}</dd>
            <dt>Date issued</dt><dd>${esc(issuedAt ? longDate(issuedAt) : 'Pending')}</dd>
            <dt>Eligible amount</dt><dd><strong>$${esc(fmtAmt(eligible))}</strong></dd>
            <dt>Advantage amount</dt><dd>${esc(advantage ? '$' + fmtAmt(advantage) : '$0.00')}</dd>
            <dt>Gift amount</dt><dd>${esc('$' + fmtAmt(gross))}</dd>
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
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', opacity: '0' })
  const drop = () => setTimeout(() => frame.remove(), 300)
  frame.onload = () => {
    const w = frame.contentWindow
    if (!w) return drop()
    w.addEventListener('afterprint', drop, { once: true })
    setTimeout(() => { w.focus(); w.print(); setTimeout(drop, 1500) }, 250)
  }
  frame.srcdoc = html
  document.body.append(frame)
}

// Minimal page defaults — only what pages actually need from shared state
export function formDefaults(apiBase, myUid) {
  return { memberNames: {}, userNames: {}, apiBase, myUid }
}

// Standalone donation receipt printer
export function createPrintDonation(memberNames) {
  return d => {
    if (!d) return
    printHtml(donationReceiptHtml(d, memberNames || {}))
  }
}
