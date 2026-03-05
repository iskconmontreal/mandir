## Mockups

Mobile-first. 10 screens total.

Core principle: **editable until finalized**. No separate screens.
One expense form, one expense list (filtered by context).
Statuses: submitted → approved → paid | rejected.
No type field. Claim/request/log is UX framing only.


### App Shell

```
┌─────────────────────────────────┐
│ ☰  Mandala         Nani Gopal ▾ │
├─────────────────────────────────┤
│                                 │
│         (content area)          │
│                                 │
├─────────────────────────────────┤
│  ◉ Home  ▤ Expenses  ♡ Donors   │
│          ▦ Reports   ⚙ People   │
└─────────────────────────────────┘
```

Tabs visible per role:
- **Treasurer**: Home, Expenses, Donors, Reports, People
- **Approver**: Home, Expenses
- **Member**: Home, Expenses
- **Donor**: Home (only — shows giving + receipts)


### Dashboard (adaptive — one screen, role determines cards)

**Treasurer sees all cards. Others see subset.**

```
┌─────────────────────────────────┐
│ ☰  Home                    🔔 3 │
├─────────────────────────────────┤
│                                 │
│  February 2026                  │ ← treasurer only
│  ┌───────┬────────┬──────────┐  │
│  │ In    │ Out    │ Net      │  │
│  │$4,230 │$1,870  │ +$2,360  │  │
│  └───────┴────────┴──────────┘  │
│                                 │
│  ┌─────────────────────────┐    │ ← treasurer
│  │ ▸ To Pay          5 $820│    │   (expenses: approved)
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │ ← approver
│  │ ▸ To Approve          3 │    │   (expenses: submitted,
│  └─────────────────────────┘    │    needs my approval)
│                                 │
│  ┌───────────┬─────────────┐    │ ← everyone
│  │+ Expense  │ + Donation   │    │
│  └───────────┴─────────────┘    │
│                                 │
│  Recent                         │
│  ┌─────────────────────────┐    │
│  │ Nani Gopal    $47       │    │
│  │ 10 min ago      approved│    │
│  ├─────────────────────────┤    │
│  │ Hari Das       $300     │    │
│  │ 1 hr ago      submitted│    │
│  ├─────────────────────────┤    │
│  │ Hydro-Qc      $180     │    │
│  │ Yesterday        paid   │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

**Donor dashboard** (same screen, minimal cards):

```
┌─────────────────────────────────┐
│ ☰  Home                        │
├─────────────────────────────────┤
│                                 │
│  Hare Krishna, Arjuna Das       │
│                                 │
│  2026          $1,296           │
│  2025          $2,592           │
│                                 │
│  Tax Receipts                   │
│  ┌─────────────────────────┐    │
│  │ 2025   R-2025-0014  ⤓   │    │
│  │ 2024   R-2024-0014  ⤓   │    │
│  └─────────────────────────┘    │
│                                 │
│  Giving History                 │
│  ┌─────────────────────────┐    │
│  │ Feb 2026  $108  e-xfer  │    │
│  │ Jan 2026  $108  e-xfer  │    │
│  │ Dec 2025  $108  e-xfer  │    │
│  │          ···            │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```


---


### 4. Expense List (one list, context-filtered)

Tapping dashboard cards ("To Pay", "To Approve")
lands here with a pre-set filter. User can change filter.

```
┌─────────────────────────────────┐
│ ☰  Expenses                 +  │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐    │
│  │ All ▾   Any status ▾    │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ E-0044  Nani Gopal      │    │
│  │ $230 · Prasadam         │    │
│  │ submitted · 0/2 approved│    │
│  │                         │    │
│  │ [Approve]  [Reject]     │    │  ← approver sees actions
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ E-0042  Nani Gopal      │    │
│  │ $47 · Prasadam          │    │
│  │ approved                │    │
│  │                         │    │
│  │ [Mark Paid ✓]           │    │  ← treasurer sees action
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ E-0035  Hydro-Qc        │    │
│  │ $180 · Utilities        │    │
│  │ paid                    │    │
│  └─────────────────────────┘    │
│         ···                     │
│                                 │
└─────────────────────────────────┘
```

No separate "Approval Queue" or "Payment Queue" screen.
Just this list with contextual inline actions per role.


### 5. Expense Form (create + edit — same screen)

Editable until paid (editing approved expense resets to submitted).
Tapping a list item opens this. "+" opens this blank.

```
┌─────────────────────────────────┐
│  ← Expenses    E-2026-0044      │
│                       SUBMITTED │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐    │
│  │ 📷  Snap Receipt        │    │
│  └─────────────────────────┘    │
│                                 │
│  Amount *                       │
│  ┌─────────────────────────┐    │
│  │ $ 230.00                │    │
│  └─────────────────────────┘    │
│  GST/HST                        │
│  ┌─────────────────────────┐    │
│  │ $ 29.90                 │    │
│  └─────────────────────────┘    │
│  Vendor                         │
│  ┌─────────────────────────┐    │
│  │ Costco                  │    │
│  └─────────────────────────┘    │
│  Date                           │
│  ┌─────────────────────────┐    │
│  │ 2026-02-26              │    │
│  └─────────────────────────┘    │
│  Category                       │
│  ┌─────────────────────────┐    │
│  │ Prasadam             ▾  │    │
│  └─────────────────────────┘    │
│  Description                    │
│  ┌─────────────────────────┐    │
│  │ Sunday feast supplies   │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │        Submit           │    │
│  └─────────────────────────┘    │
│                                 │
│  ── Approvals (1/2) ──         │  ← shown after submit
│  ┌─────────────────────────┐    │    count shown inline
│  │ ✓ Govinda    Approved   │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

Status determines behavior:
- **submitted** → editable by reporter (editing resets to submitted). Shows approval progress (N/M).
- **approved** → editable by reporter (resets to submitted). Treasurer sees payment section:

```
│  ── Pay ──                      │
│  ┌─────────────────────────┐    │
│  │ 📷  Payment Proof       │    │  ← e-transfer screenshot,
│  └─────────────────────────┘    │    cheque scan, etc.
│  ┌─────────────────────────┐    │
│  │       Mark Paid ✓       │    │
│  └─────────────────────────┘    │
```

- **paid** → read-only for reporter. Treasurer can edit until paid. Admin can edit always.
- **rejected** → read-only, no actions

**Treasurer "log" flow**: treasurer creates expense → saves directly at paid status. If amount > threshold, approvers get notified (informational only).

**Editing rules**:
- Reporter: edit own expense until paid. Editing approved → resets to submitted.
- Treasurer: edit any expense until paid.
- Admin: edit any expense always.


---


### 6. Donors (list → detail drill-down, one screen)

List view:
```
┌─────────────────────────────────┐
│ ☰  Donors                   +  │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐    │
│  │ 🔍 Search donors..      │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Arjuna Das              │    │
│  │ $1,296 ytd · pledge $108│    │
│  ├─────────────────────────┤    │
│  │ Bhakta Tom              │    │
│  │ $600 ytd                │    │
│  ├─────────────────────────┤    │
│  │ Nani Gopal Das          │    │
│  │ $200 ytd                │    │
│  └─────────────────────────┘    │
│         ···                     │
│                                 │
└─────────────────────────────────┘
```

Tapping a donor drills into detail (same screen, not a new one):
```
┌─────────────────────────────────┐
│  ← Donors      Arjuna Das       │
├─────────────────────────────────┤
│                                 │
│  arjuna@example.com             │
│  514-555-1234                   │
│                                 │
│  Pledges                        │
│  ┌─────────────────────────┐    │
│  │ $108/mo · active · Mar'25│   │
│  └─────────────────────────┘    │
│  [+ Add Pledge]                 │
│                                 │
│  Donations          2026: $1,296│
│  ┌─────────────────────────┐    │
│  │ Feb 26  $108  e-xfer ✓  │    │
│  │ Jan 28  $108  e-xfer ✓  │    │
│  │ Dec 25  $108  e-xfer ✓  │    │
│  │         ···             │    │
│  └─────────────────────────┘    │
│  [+ Add Donation]               │
│                                 │
└─────────────────────────────────┘
```

"+" on list header creates new donor.
"+ Add Donation" opens donation form pre-filled with this donor.
"+ Add Pledge" opens inline pledge fields (donor, amount, frequency, start).


### 7. Donation Form (create + edit — same screen)

"+" from Donors tab or "+ Add Donation" from donor detail.
Donor pre-filled when coming from detail.

```
┌─────────────────────────────────┐
│  ← Donors      New Donation     │
├─────────────────────────────────┤
│                                 │
│  Donor *                        │
│  ┌─────────────────────────┐    │
│  │ 🔍 Search or create...  │    │
│  └─────────────────────────┘    │
│  Amount *                       │
│  ┌─────────────────────────┐    │
│  │ $ 200.00                │    │
│  └─────────────────────────┘    │
│  Method                         │
│  ┌─────────────────────────┐    │
│  │ E-transfer           ▾  │    │
│  └─────────────────────────┘    │
│  Category                       │
│  ┌─────────────────────────┐    │
│  │ General              ▾  │    │
│  └─────────────────────────┘    │
│  Date                           │
│  ┌─────────────────────────┐    │
│  │ 2026-02-26              │    │
│  └─────────────────────────┘    │
│  Note                           │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │          Save           │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

**Method = in-kind** reveals:
```
│  Description *                  │
│  ┌─────────────────────────┐    │
│  │ Commercial kitchen equip│    │
│  └─────────────────────────┘    │
│  Fair Market Value *            │
│  ┌─────────────────────────┐    │
│  │ $ 2,000.00              │    │
│  └─────────────────────────┘    │
│  ⚠ FMV > $1,000 — appraisal    │
│    required                     │
│  ┌─────────────────────────┐    │
│  │ ⤒ Upload Appraisal     │    │
│  └─────────────────────────┘    │
```


---


### 8. Reports (one screen, period selector + type toggle)

```
┌─────────────────────────────────┐
│ ☰  Reports                      │
├─────────────────────────────────┤
│                                 │
│  ┌──────────┬───────┬────────┐  │
│  │▌Summary ▐│ Tax   │  GST   │  │
│  └──────────┴───────┴────────┘  │
│                                 │
│  ┌─────────────────────────┐    │
│  │ February 2026        ▾  │    │
│  └─────────────────────────┘    │
│                                 │
│  Donations         $4,230       │
│  ┌─────────────────────────┐    │
│  │ ▪▪▪▪▪▪▪ General  $2,100│    │
│  │ ▪▪▪▪    Deity    $1,080│    │
│  │ ▪▪      Building   $700│    │
│  │ ▪       Festival   $350│    │
│  └─────────────────────────┘    │
│                                 │
│  Expenses          $1,870       │
│  ┌─────────────────────────┐    │
│  │ ▪▪▪▪▪   Prasadam   $780│    │
│  │ ▪▪▪▪    Utilities   $480│   │
│  │ ▪▪▪     Maint      $390│    │
│  │ ▪▪      Supplies   $220│    │
│  └─────────────────────────┘    │
│                                 │
│  Net               +$2,360      │
│                                 │
│  ┌─────────────────────────┐    │
│  │      Export PDF         │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

**Tax tab** — same screen, different content:
```
│  ┌──────────┬───────┬────────┐  │
│  │ Summary  │▌Tax  ▐│  GST   │  │
│  └──────────┴───────┴────────┘  │
│                                 │
│  ┌─────────────────────────┐    │
│  │ 2025                 ▾  │    │
│  └─────────────────────────┘    │
│                                 │
│  47 donors · $58,320 eligible   │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Arjuna Das    $2,592 ✉  │    │
│  │ R-2025-0014    issued   │    │
│  ├─────────────────────────┤    │
│  │ Bhakta Tom    $1,200    │    │
│  │               pending   │    │
│  └─────────────────────────┘    │
│                                 │
│  [Generate PDFs]  [Email All]   │
```

**GST tab** — same screen:
```
│  ┌──────────┬───────┬────────┐  │
│  │ Summary  │ Tax   │▌ GST  ▐│  │
│  └──────────┴───────┴────────┘  │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Jul–Dec 2025         ▾  │    │
│  └─────────────────────────┘    │
│                                 │
│  GST Paid          $2,340       │
│  Eligible Rebate   $1,170       │
│                                 │
│  [Export for GST66]             │
```


### 10. People

```
┌─────────────────────────────────┐
│ ☰  People                   +  │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐    │
│  │ Nani Gopal Das          │    │
│  │ member                  │    │
│  ├─────────────────────────┤    │
│  │ Govinda Prabhu          │    │
│  │ approver · treasurer    │    │
│  ├─────────────────────────┤    │
│  │ Radha Devi              │    │
│  │ approver                │    │
│  └─────────────────────────┘    │
│                                 │
│  ── Invite ──                   │  ← inline, no
│  Name *                         │    separate screen
│  ┌─────────────────────────┐    │
│  │                         │    │
│  └─────────────────────────┘    │
│  Email *                        │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  └─────────────────────────┘    │
│  Roles                          │
│  ☑ Member  ☐ Approver  ☐ Treas  │
│                                 │
│  ┌─────────────────────────┐    │
│  │      Send Invite        │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```


---


### Screen Inventory (final)

| #  | Screen         | What it covers                            |
|----|----------------|-------------------------------------------|
| 1  | Login          | Auth + password reset (inline)            |
| 2  | Set Password   | Invite accept + reset (shared)            |
| 3  | Dashboard      | Adaptive by role (1 layout, 4 variants)   |
| 4  | Expense List   | All expenses, filtered. Inline approve/pay|
| 5  | Expense Form   | Create + edit. Status governs editability  |
| 6  | Donor List     | All donors + search                       |
| 7  | Donation Form  | Cash/in-kind/collection. Pledge via donor |
| 8  | Reports        | Summary/Tax/GST tabs. One screen          |
| 9  | Bank Reconcile | CSV import + match/unmatch buckets        |
| 10 | People         | Member list + inline invite               |

### Design Principles

- **Editable until paid.** Reporter edits until paid (editing approved resets to submitted). Treasurer edits until paid. Admin edits always.
- **One list, contextual actions.** Expense list serves as approval queue, payment queue, and "my expenses" — filtered by role.
- **Form = detail.** Creating and viewing are the same screen. Status governs editability.
- **Inline over separate.** Password reset on login, invite on people, pledge on donor detail.
- **Approval count visible.** "1/2 approved" shown inline. Threshold and required count configurable.
- **Deferred.** Donor Board, Year-End Close — not core accounting.
