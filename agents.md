# Mandir

Frontend for ISKCON Montreal temple internal organization management. CRM for charity: donors, expenses, members, tax receipts, reports.

## Goal

Make financial truth visible to a non-accountant. Solve one temple's problem perfectly.
- Beautiful enough that seva feels dignified
- Simple enough that next treasurer can start in 5 minutes
- Calm, trustful dashboard
- System outlasts any individual contributor

## Architecture

```
Frontend: Static HTML on GitHub Pages (Jekyll)
Backend:  Goloka — REST API on Mac Mini at https://api.iskconmontreal.ca
Auth:     Google OAuth2 direct + email/password fallback, JWT in localStorage
Cross-domain: CORS + Authorization: Bearer header, no cookies
```

No build step. No bundler. No framework beyond sprae. No Tailwind.

## API

Goloka REST API: `https://api.iskconmontreal.ca`
Swagger: `https://api.iskconmontreal.ca/swagger/index.html`

## Stack

- **Sprae v12** — DOM microhydration (`lib/sprae.js`). Directives: `:scope`, `:text`, `:if`, `:each`, `:class`, `:onclick`, `:onsubmit`. Loaded with `data-start` attribute for auto-init.
- **Jekyll 4.3** — GitHub Pages hosting. `jekyll-optional-front-matter` plugin so HTML files don't need front matter.
- **CSS custom properties** — Hand-written design tokens in `tokens.css`. Temple-inspired palette: devotional purple `#6b5ce7`, warm neutrals.
- **ES modules** — Vanilla JS, no transpilation.

## Design Token Rule

Use design tokens for visual decisions first: colors, spacing, padding, radius, shadows, typography, and semantic state styling should come from `css/tokens.css` or be derived from those tokens with `calc()`. Avoid raw hex, rgba, or ad-hoc spacing values in component CSS when an existing token or token-derived value can express it.

## UI / Business Logic Separation

JS `<script>` blocks contain **business logic only**: API calls, data transforms, auth guards, localStorage side effects. UI concerns live in **sprae markup**.

| Concern | Where | How |
|---------|-------|-----|
| Display strings, labels, greeting text | Markup | `:text` expression |
| Random picks, quote rotation | Markup | `:scope` IIFE |
| Time-of-day messages, conditional copy | Markup | `:scope` IIFE with branching |
| Label maps (scope→display name) | Markup | Inline object lookup in `:text` |
| Name composition (first+last fallback) | Markup | `:text` with `[].filter(Boolean).join()` |
| API calls, data fetching | JS | `api.*` calls |
| Data transforms (totals, grouping) | JS | Computed getters or functions |
| Auth guards, permission checks | JS | `auth.can()`, redirect guards |
| Side effects (localStorage, navigation) | JS | Expose computed values to markup via init state |

**Pattern**: JS exposes raw data + minimal bridge values (e.g., `_vis` for hours since last visit). Markup formats, picks, labels, and composes display text via `:scope` IIFEs and `:text` expressions.

**Reference**: `login.html` `:scope="brand"` for quote rotation. `_layouts/app.html` footer for random quote pick IIFE. `app/index.html` page-header for time-of-day subtitle `:scope`.
