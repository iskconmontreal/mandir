## Scenarios

What users do. Not UI specs, not infrastructure.


### 1. Expenses

Statuses: submitted → approved → paid | rejected.
No "type" field. Backend stores status, amount, audit trail. Claim/request/log distinction is UX only.

**Editing rules:**
- Reporter can edit until paid. Editing an approved expense resets status to submitted.
- Treasurer can edit any expense until paid.
- Admin can edit any expense at any time.

**Approval rules (configurable in backend config):**
- Under threshold (default $100): auto-approved on submit.
- Over threshold: requires N approvals (default 2). Approval count shown in UI near Approve button.
- Threshold and required approval count are backend config values.

**1.a Claim** — member already spent own money
1. Member clicks "+ Expense" from home or finance page
2. Scans/uploads receipt(s) — OCR pre-fills amount, date, vendor
3. Fills title, category, description
4. Submits → status: submitted (auto-approved if under threshold)
5. If over threshold: approvers approve (count shown in UI) → status: approved
6. Treasurer reimburses member → status: paid

**1.b Request** — member needs funds before purchase
1. Same form, member indicates request in title (e.g. "Kitchen supplies (request)")
2. Fills estimated amount, category, description
3. Same approval flow as claim
4. Treasurer gives funds → status: paid
5. If actual amount differs, reporter or treasurer edits expense (resets to submitted if was approved)

**1.c Log** — treasurer records existing transaction
1. Treasurer clicks "+ Expense"
2. Fills vendor, amount, category, bank ref, date
3. Saves directly at status: paid, auto-approved by treasurer
4. If amount over threshold: notification sent to approvers (informational, not blocking)

**Rejection**: Approver rejects with a note → status: rejected. Member creates new expense if needed.


### 2. Donations

**2.a Add Donation** — cash/cheque/e-transfer/card, one-time
1. Authorized user clicks "+ Donation" from home or finance page
2. Scans receipt or fills manually: donor, amount, method, category, date
2.1 If donor not in system — created in place
3. Save. Running totals update.
4. If donor requests tax receipt → issue from donation detail (see 3.a)

**2.b In-Kind Donation** — goods not cash
1. Method set to "in-kind" in donation form
2. Fills donor, description, fair market value, category
3. If FMV > $1,000: uploads independent appraisal (CRA requirement)
4. Receipt issued for FMV amount


### 3. Compliance

**3.a Tax Receipt** — per donation or annual, CRA-compliant
1. From donation detail or donor profile: "Issue Receipt"
2. System generates: receipt_no, eligible amount, org details (charity name, address, reg no, CRA statement)
3. Treasurer reviews, generates PDF
4. Can email to donor or print
5. Copies retained minimum 2 years
6. In-kind: FMV + description shown separately. Advantage amounts deducted.
7. Annual batch: treasurer selects fiscal year → one receipt per donor for all eligible donations

**3.b GST/HST Rebate** — 50% back on GST paid
1. System totals GST/HST from expenses for selected period
2. Calculates 50% rebate amount
3. Treasurer exports for Form GST66
4. When rebate received, recorded as income

**3.c T3010 Annual Return** — within 6 months of fiscal year end
1. System generates summary: revenue by source, expenditures by category
2. Treasurer exports to fill T3010
3. Data ready and categorized, not full automation


### 4. Donor Self-Service

**4.a Donor Portal** — donor views own history + receipts
1. Donor logs in (or uses unique link)
2. Sees: giving history, year totals, downloadable tax receipts
3. Read-only


### 5. Auth

**5.a Invite** — admin adds someone
1. Admin enters name, email, role flags (member/approver/treasurer)
2. System sends invite email with one-time link
3. User sets password, logged in

**5.b Login**
1. Email + password → session
2. Role-appropriate view
3. 30-day session, explicit logout

**5.c Password Reset**
1. "Forgot password" → email → reset link → new password


### 6. Year-End

**6.a Year-End Close**
1. Treasurer selects year to close
2. System checks: all expenses paid/rejected, all donations receipted
3. Gaps shown as checklist
4. Once clean: year locked (read-only), new year active


### 7. Home Page (Happy Paths)

Two primary actions, prominent on home page for everyone:

**+ Expense** → opens expense form
- Any member can submit
- Treasurer saves directly at status: paid

**+ Donation** → opens donation form
- Authorized users (treasurer, admin)
- Scan receipt or fill manually
