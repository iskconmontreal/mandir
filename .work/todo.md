


## Backlog

* [x] Finances: Add expense > click anywhere > closes modal - should not (add test regression)
* [x] Finances: Add expense > attach doc > cancel closes modal - should not.
* [x] Finances: doesn't show photos: I have created expense #E-2026-0616 with 4 photos, but frontend doesn't show them in preview: https://api.iskconmontreal.ca/uploads/finance/2026/2026-04-12-3.webp 404
  * [ ] Finances: protect images from external access by auth cookie
* [x] Finances: when we add new photos, it autoscans and creates new rows, but when we delete created rows and then add more photos after - it recreates the deleted rows.
* [x] Finances: we should show "Paid" status selector when admin or treasurer is adding the expense - but it should check attached pictures first. initiated expenses can be set directly to target status.
* [ ] Donors: show street address

* [x] Donation receipt — CRA-compliant:
  * [x] Our website (org_website setting + shown on receipt header)
  * [x] Their website (canada.ca/charities-giving on receipt footer)
  * [x] Donor street address (stored at issuance, shown on receipt)
  * [x] official receipts: all 13 CRA mandatory fields implemented

* [ ] Expenses: Send receipt to an email from registered email adds it to the
* [ ] Expenses: try promoting a user to volunteer and see there's expense folder

* [ ] Invitation email link: prefill the email of a person.
* [x] Members: updating the user name breaks loading profile page
* [ ] Members: view org page

* [ ] Members: Updating role displays it two roles in the list, until refresh
* [ ] Members: we need mask for entering phone number to format nicely
* [ ] Members: joined: might be automatic, or joined what? The system? Who cares
* [ ] Members: Photo - should be first
* [ ] Members: hovering mouse outside of modal closes it: should not
* [ ] Members: status - makes person disabled - he is not passed away!
* [ ] Members: status - meaning leaving status, not just status
* [ ] Members: children - likely must be linked to other members, not enough
* [ ] Members: make spiritual details, personal details tabs
* [ ] Members: chanting / years in KC / 4 regs year is the same, no?
* [ ] Members: likely need initiation date,
* [ ] Members: print recommendation letter
* [ ] Members: marriage status should be divorced available
* [ ] Members: Guru - we should track the list (after)
* [ ] Members: Spiritual/personal details can be shown in info (tabs?) as well
* [ ] Members: need to add double or single initiated
* [ ] Members: undefined phone
* [ ] Members: click outside closes the modal
* [ ] Members: optimize autofill street address
* [ ] Members: see all donations / donor profile

* [ ] Server: please pull goloka

* [x] improve add receipt/transaction form

* [ ] reorganize finances page
  * [ ] finance tabs IA pass: keep Transactions; replace Expenses/Income tabs with Donors + Reports
  * [ ] add Donors tab shell (top donors, recurring donors, YTD totals, last donation, quick open)
  * [ ] add Reports tab shell (month close summary, category P&L, export preset links)
  * [ ] move existing expense/income filter logic under Transactions type filter only
  * [ ] remove duplicate Expenses/Income tab-level state once parity is confirmed
  * [ ] QA: desktop + mobile + deep-link query params continue to work

* [ ] donor creation flow (progressive)
  * [x] keep donor autocomplete for existing members
  * [x] when typed donor has no selected member, show inline "Create donor" action
  * [x] create minimal donor member inline (name required, email recommended, address optional)
  * [x] auto-link new member_id to current income form after creation
  * [x] add "Anonymous donor" explicit toggle for non-receiptable cash entries
  * [x] warn when issuing/previewing receipt without email/address on donor profile
  * [ ] QA: create donor -> save income -> open donor in members -> invite flow

* [ ] invite email reliability + correctness
  * [ ] backend default `FRONTEND_URL` should be `https://iskconmontreal.github.io/mandir`
  * [ ] invite target should use `/login.html` (not `/app/login`)
  * [ ] switch invite mail to multipart (text + html) with CTA button
  * [ ] include ISKCON Montreal logo (PNG) in email header
  * [ ] add polite fallback plain link below button for strict mail clients
  * [ ] validate SPF/DKIM/DMARC for sender domain to reduce spam placement

* [ ] better home page
* [ ] 1-image → multiple receipts OCR segmentation (complex, skip for now)
  * [ ] integrate better Apple OCR
* [ ] Double OCR check? ollama can estimate the clarity of parsed data.

* [x] harden backend
* [x] complete flows (tested dev)
  * [ ] request expense - treasurer gets notified
  * [x] changing / assigning roles
* [x] ~~switch year persists~~
* [ ] adding member when adding expense button

* [ ] main: deploy to prod;
  * [ ] import all 2025 receipts database
* [ ] Import all interacs members names from files: MK, Samir
* [ ] Onboard MK, Samir, Ash

* [x] What if user uploads expense receipt into donation form? -> don't store intent.
* [x] Donation form should not necessarily have photos.
  * [x] That should not be called scan "receipt".
* [x] Viewer doesn't see recent activity after uploading the document
  * [x] Viewer has no finance info - no permission
* [x] Treasurer doesnt see freshly added expenses because they can have old date - should sort by date submitted maybe?
* [x] Treasurer append expense form error on appending image
* [x] Hanging loading button on expense details
* [x] Pujari new role breaks list
* [x] Pending approval status doesn't approve
* [x] Search doesn't highlight

* [ ] Ideal scenario: any member can just attach multiple pictures of receipts to goloka. Done: OCR scans and pings treasurer;

* [ ] UIs
  * [x] Search through unloaded data
  * [x] Better pills alignment
  * [x] Income same style as expenses
  * [x] Display attachments shortcuts in the lines
  * [x] Unify icons across the app
  * [ ] Make preloading better, while JS/data loads
  * [x] Quick actions can be better in desktops since there's enough space
  * [ ] Make scan image area for existing items less big maybe? Or humbler
  * [x] Better multiple categories filter
  * [x] History label in modal info is inconsistent
  * [x] Highlight added item in content
  * [x] Fix dot issue with number inputs

* [ ] Notifications
  * [ ] Invitations for all oboardees
  * [ ] Integrate backend notification center from Goloka Swagger
    * [ ] Read `GET /api/me/notifications`
    * [ ] Use `POST /api/me/notifications/:id/read` and `POST /api/me/notifications/read-all`
    * [ ] Add toasts for successful expense/donation submit
    * [ ] Highlight newly created row for 3 seconds
    * [ ] Show status badges + timeline in `/me/expenses`

* [ ] Auth flows
  * [ ] Google
  * [ ] Apple
  * [ ] OTP SMS
  * [ ] Passcode / keycode (biometrics)

* [x] Donations

* [ ] `member-table` CE — sortable columns, pagination, row click

* [ ] Mobile version


* [ ] Sprae load first
* [ ] Autoloading is a bit strange
* [x] page transitions @​view-transition { navigation: auto }

* [ ] Tax receipt template formatting / PDF generation (necessary, not exciting)
* [x] Auth/session management for cross-domain static→API (real friction, must solve cleanly)
  - JWT tokens, cookie-less, Authorization header

* [ ] Offline/unreachable API — Static pages must gracefully handle API being down. No spinner-of-death.

* [ ] Mac Mini reliability — Hardware failure, power outage, network. Need backup strategy. Not day-one, but must be acknowledged.
* [ ] Data integrity — Financial data is sacred. Backup, audit trail, immutable records. This is non-negotiable from day one.

* [ ] Disaster being pretended away: Mitigation: automated backups to a second location. Document this requirement now.

## Ideas

* [ ] Link to soundboard (can be iframe), canon URL
  * [ ] start stream quick button (video control) - links to youtube maybe? in content section?
* [ ] Write down Luv prabhu / sankirtan numbers
* [ ] Upload a file, system decides itself where to classify it: expense, donation, legal etc.
* [ ] Who is online feature
* [ ] Tracking spiritual results to please Guru
* [ ] Integrations: tip-tap
* [ ] Integrations: banks
* [ ]

## Archive

* [x] Componentize

### Phase 1 — Form Modals (biggest win: ~85 props removed, reused on 2 pages)
* [x] `expense-form-modal` CE — extracted as `expense-form` from expense-form.html + form.js state
* [x] `donation-form-modal` CE — extracted as `donation-form` from donation-form.html + form.js state

### Phase 2 — Filter Bars (finance page: ~30 props removed)
* [x] `expense-filter-bar` CE — search, category tags, status, amount range, dates
* [x] `income-filter-bar` CE — search, method, type, amount range, dates

### Phase 3 — Members Page (~60 props removed)
* [x] `member-detail-modal` CE — extracted as `member-detail` (photo, contact, role, devices, permissions)
* [x] `member-edit-modal` CE — extracted as `member-edit-form` (edit form with photo upload)

### Phase 4 — Remaining Pages (assessed: low value, skipped)
Profile, organization, and roles pages are small, self-contained, with zero cross-page reuse. CE extraction adds boilerplate without meaningful benefit.

### Done
* [x] `expense-list` CE (finance page — year/month grouped list)
* [x] `income-list` CE (finance page — year/month grouped list)
* [x] `transaction-list` CE (finance page — mixed list with net)
* [x] `recent-expenses` CE (dashboard — flat list with reporter/status)
* [x] `recent-donations` CE (dashboard — flat list with source/method)
* [x] `my-expense-table` CE (dashboard — simple table with totals)
* [x] `expense-form` CE (full expense modal — used on dashboard + finance)
* [x] `donation-form` CE (full donation modal — used on dashboard + finance)
* [x] `expense-filter-bar` CE (expense filter UI — finance page)
* [x] `income-filter-bar` CE (income filter UI — finance page)
* [x] `member-edit-form` CE (member add/edit modal — members page)
* [x] `member-detail` CE (member detail + roles modal — members page)

* [x] Add `gst`, `pst` (uint32, cents) and `batch_id` (UUID, nullable, indexed) to `Expense` struct + DB migration (`002_batch.sql`)
* [x] Populate gst/pst from `Attachment.extracted_data.taxes` (TPS/TVQ) on expense create/promote
* [x] `POST /api/expenses` accepts array `[]expenseRequest`; len>1 auto-generates shared `batch_id`
* [x] `GET /api/expenses` supports `?batch=<uuid>` filter
* [x] Tests: 10 new tests covering batch create, unique expense nos, validation atomicity, attachment linking, batch filter, gst/pst storage and promotion

* [x] landing: basic setup with sprae
* [x] datatable.net example page for finance
* [x] login page

* [x] Restructure
  * [x] Nav: 3 items only — Overview, Donations, Expenses
    * [x] Settings & Tax Receipts move to user menu (not nav)
    * [x] Members page deleted — donors are a sub-concern of Donations
    * [x] Reports page deleted — merged into Overview
    * [x] Tax page deferred — empty placeholder removed until real
  * [x] Overview (replaces Home + Reports)
    * [x] Net position (keep existing)
    * [x] Donation vs expense proportion — visual bar, not just numbers
    * [x] Category breakdown (move from Reports)
    * [x] Top donors (move from Reports)
    * [x] Recent transactions (keep existing)
    * [x] Month/year filter (keep existing)
    * [x] Quick-add "+" button (keep existing)
  * [x] Donations UX
    * [x] Filter bar: category, date range, search text
    * [x] Inline category summary at top (small breakdown, replaces Reports visit)
    * [x] Recurring donation flag
    * [x] Pagination for real data volumes
    * [x] Export CSV
    * [x] Donor autocomplete (keep existing)
    * [x] Receipt OCR (keep existing placeholder)
  * [x] Expenses UX
    * [x] Filter bar: category, date range, search text
    * [x] Inline category summary at top
    * [x] Recurring expense flag
    * [x] Pagination
    * [x] Export CSV
    * [x] Receipt OCR (keep existing placeholder)
  * [x] DRY: extract shared sprae init
    * [x] `user, active, logout, userMenu` repeated across every page → shared module
    * [x] Categories hardcoded in `<select>` across pages → shared constant or API-driven
    * [x] Year select hardcoded 2024/2025/2026 → dynamic
  * [x] Delete files
    * [x] `app/members.html`
    * [x] `app/reports.html`
    * [x] `app/tax.html`
    * [x] Remove `simple-datatables` CDN dependency
  * [x] Rename `setting.html` → `settings.html`

* [x] OTP with trusted device
