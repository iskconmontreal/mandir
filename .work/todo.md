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

* [x] Donations
  * [ ] "+" → "Donation" → selects/creates donor → amount, category, date, note → Save or save and add one more

## Today

* [ ] Complete expense flow: adding expenses should work well
* [ ]


## Onboard

* Sandeep
* Imon
* Remy
* Rama Keshava
* TC members
* Ash


## Backlog

* [ ] Enhance frontend looks

* [ ] Limit user/pass login only to temple internal network

* [ ] Overview
  * [ ] donation total this month
  * [ ] expense total
  * [ ] net
  * [ ] recent activity

* [ ] Tax receipt template formatting / PDF generation (necessary, not exciting)
* [ ] Auth/session management for cross-domain static→API (real friction, must solve cleanly)
  - JWT tokens, cookie-less, Authorization header

* [ ] Offline/unreachable API — Static pages must gracefully handle API being down. No spinner-of-death.

* [ ] Mac Mini reliability — Hardware failure, power outage, network. Need backup strategy. Not day-one, but must be acknowledged.
* [ ] Data integrity — Financial data is sacred. Backup, audit trail, immutable records. This is non-negotiable from day one.

* [ ] Disaster being pretended away: Mitigation: automated backups to a second location. Document this requirement now.
