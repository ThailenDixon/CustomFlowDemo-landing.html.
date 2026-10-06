# Custom Flow — Portfolio Demo Build

A static, backend-free version of the **Custom Flow** capstone project, built for [Cope Aesthetic Customs](https://www.copeaestheticcustoms.com/). This demo runs entirely in the browser so you can drop it onto a portfolio site and let people click through the full application without needing a database, Flask server, or Railway deployment.

**Capstone team (Group 7, ITEC 564 — University of South Carolina):**
- Nia English — Product Owner
- Caden Weeks — Scrum Master
- David Camp — Technical Lead
- Thailen Cato-Dixon — Technical Lead

---

## What this demo is

Custom Flow is a centralized order-tracking and workflow system for Buffy Taylor's hand-painted custom apparel business. Think of it as a Domino's-style tracker for one-of-one wearable art — customers see exactly where their piece is in the pipeline (Free Waitlist → Paid Waitlist → Production Queue → Prep → Painting → Completed → Shipped), and Buffy has a full admin dashboard to manage quotes, payments, revisions, rush approvals, and the production queue.

The full project has a Flask + PostgreSQL backend running on Railway. **This demo replaces that backend with a JavaScript mock** — every `fetch('/api/...')` call is intercepted and served from sample data stored in the browser's localStorage. Everything works the same from the user's perspective: you can log in, create orders, approve rush requests, mark things completed, add payments, edit FAQs — and your changes persist across pages while you're browsing.

## Live demo tour

Visitors land on `landing.html` and pick one of two entry points:

- **👤 View Customer Demo** — Sign in as `customer@email.com` (James Carter) and explore the portal: see order history, submit a new order, track a piece through the pipeline, tweak profile settings.
- **🎨 View Admin Demo** — Sign in as `admin@copeaesthetic.com` (Buffy) and explore the admin side: dashboard with charts, production queue with priority sorting, order detail with payments/revisions/mockups, reports with revenue analytics, full settings management.

Credentials are **pre-filled** on both login pages with a visible note — visitors never have to type anything.

A magenta "DEMO" banner stays fixed at the top of every page with a **↻ Reset** link that wipes the sample data back to its starting state and a **← Home** link back to the landing page.

## Deploying to GitHub Pages

The whole demo is static HTML/CSS/JS — no build step, no dependencies to install. Deployment is about as simple as it gets.

**1. Create a new GitHub repository.** Public is fine (and required for free Pages). Name it something like `custom-flow-demo` or whatever fits your portfolio.

**2. Push these files to the repo.** All files in this folder go in the repo root — don't nest them in a subfolder. Easiest path if you're not a git person:
- Click **Add file → Upload files** on GitHub
- Drag every file from this folder into the uploader
- Scroll down, write a commit message, click **Commit changes**

**3. Turn on GitHub Pages.** In the repo: **Settings → Pages → Build and deployment**. Set source to **Deploy from a branch**, branch to **main** (or **master**), folder to **/ (root)**. Save.

**4. Wait about a minute.** GitHub will give you a URL like `https://yourusername.github.io/custom-flow-demo/`. The landing page will be at `https://yourusername.github.io/custom-flow-demo/landing.html`.

**5. Link to it from your portfolio.** Share `landing.html` as the entry point — that's where the demo tour starts.

## File overview

```
demo/
├── landing.html              ← public entry with two demo CTAs
├── mock-backend.js           ← fetch() interceptor + demo banner (the magic)
├── core.js                   ← shared constants, MOCK data, apiFetch(), formatters
├── navbar.js                 ← admin + customer top nav
├── styles.css                ← full design system
│
├── admin-login.html          ← pre-filled admin credentials
├── admin-dashboard.html      ← stats, charts, recent orders, queue snapshot
├── admin-orders.html         ← searchable orders table
├── admin-order-detail.html   ← full order view (payments, revisions, tracking, invoices)
├── admin-queue.html          ← priority-sorted production queue
├── admin-reports.html        ← revenue analytics with Chart.js
├── admin-settings.html       ← booking, FAQs, pricing, users, account management
│
├── customer-login.html       ← pre-filled customer credentials
├── customer-register.html    ← reCAPTCHA stubbed out for demo
├── customer-terms.html       ← terms + pricing (must read before registering)
├── customer-portal.html      ← customer home: orders + FAQs + quick actions
├── customer-order-form.html  ← multi-step new order submission
├── customer-order-detail.html← pipeline status, timeline, payments
├── customer-track.html       ← quick order lookup
├── customer-pending.html     ← influencer account awaiting approval
├── customer-settings.html    ← profile, notifications, password
│
└── logo_*.png                ← brand assets
```

## How the mock backend works

`mock-backend.js` loads right after `core.js` on every page and overrides `window.fetch()`. Only URLs starting with `/api/` are intercepted — everything else (Chart.js CDN, Google Fonts, etc.) passes through to the real network.

When a page calls `apiFetch('/api/orders')` or any other endpoint, the interceptor:

1. Parses the method + path + body + Authorization header
2. Matches it against the route table (50+ routes covering login, register, orders CRUD, payments, revisions, add-ons, consult calls, invoices, images, queue, dashboard, reports, users, FAQs, pricing tiers, settings)
3. Reads/writes the database from localStorage key `cope_demo_db_v1` (seeded from the `MOCK` object in `core.js` on first load)
4. Returns a `Response` object with the same JSON shape the real Flask backend would return

Auth tokens are fake JWTs — they're real base64-encoded JSON with a 7-day `exp` claim so `_jwtExpired()` in `core.js` works correctly, but the signature is just the literal string `demo-signature`. The frontend never verifies signatures (that's the server's job), so this is fine for demo purposes.

Mutations persist to localStorage, so if Buffy marks order #1047 complete on the queue page, it shows as complete on the dashboard, the orders list, and the customer portal. Clicking **↻ Reset** in the banner (or running `window.resetDemoData()` in the console) wipes everything back to the starting sample data.

## What's different from the real app

- **No real server** — the Flask backend on Railway is replaced by `mock-backend.js`. All logic that was server-side (priority queue sorting, revenue aggregation, dashboard stats) was ported to the mock.
- **No real emails** — `/api/invoices/:id/send` marks the invoice as sent and returns success, but nothing actually leaves. Email preview HTML (in `core.js`) is still intact.
- **No real file uploads** — mockup/reference image uploads return a generated SVG placeholder labeled "Demo Image" instead of a Cloudinary URL.
- **reCAPTCHA disabled** — the registration form shows a demo notice instead of the Google widget (no valid sitekey would work on a different domain anyway).
- **Any password works** for pre-seeded accounts on login — the demo is lenient so testers can't get locked out. Registration still requires a password (min 6 chars).
- **Chart.js and Google Fonts** still load from CDN — they need a live internet connection on the visitor's side.

## What's the same

- Every page, every interaction, every visual element
- All pipeline logic, priority sorting rules, status transitions
- The full design system (magenta/gold/violet on near-black, Barlow Condensed + Cormorant Garamond)
- Navigation, auth guards, token expiry handling, toast notifications
- Data model: users, orders, payments, mockups, revisions, order_images, status_history, consult_calls, add_ons, invoices, faqs, pricing, settings

## Troubleshooting

**"The demo loads but the charts are blank."** Chart.js is loaded from a CDN — the visitor needs an internet connection. If you're testing offline, this is expected.

**"I clicked Reset and nothing happened."** Reset reloads the page after wiping data. Give it a second and you should see the page refresh with fresh sample data. If you're looking at the customer portal and it logs you out, that's because the reset also clears your auth token — just log back in with the pre-filled credentials.

**"My changes disappeared."** Browser localStorage is per-origin, per-browser, and some privacy modes (Incognito, Safari private browsing) clear it when the tab closes. That's by design — you're not accidentally contaminating anyone else's demo session.

**"The register page says 'Connection error' when I try to submit."** Make sure `mock-backend.js` is loaded before you click submit. Check the browser console (F12) — you should see the magenta line "[Cope Demo] Mock backend active."

## Credits

- **Client:** Buffy Taylor, Cope Aesthetic Customs
- **Course:** ITEC 564 Capstone, University of South Carolina
- **Real backend:** Flask + SQLAlchemy + PostgreSQL on Railway (see original `app.py`, `seed.py`, `requirements.txt`, `Procfile`, `railway.json` — not included in this demo build)

---

*This is a portfolio build of an academic capstone project. It's not affiliated with Anthropic, Claude, or any commercial product — it's just a capstone team wanting a clickable version of their work to share with future employers.*
