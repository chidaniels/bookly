# Bookly

A booking and payments app for local service providers in Lagos and Accra. Customers browse providers, pick a live time slot, and pay in the provider's currency (₦, $ or ₵). Providers get a dashboard with their week, earnings and availability settings.

**Role:** sole frontend engineer (design, frontend, mock API)

## Stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript (strict) |
| State | Redux Toolkit: RTK Query for server data, slices for session, checkout and the Network Lab |
| Forms | react-hook-form + Zod (login, checkout, availability with `useFieldArray`) |
| Styling | Tailwind CSS v4, no component library |
| Backend | Next.js route handlers over an in-memory store (stands in for a real API) |
| Hosting | Render (Node web service, see `render.yaml`) |

## Pages (9)

| Route | What it does |
| --- | --- |
| `/` | Landing page with search and top-rated providers (server-rendered) |
| `/services` | Search and category filter. A plain GET form, so it works before JavaScript loads |
| `/providers/[slug]` | Profile, services, opening hours, and the live slot picker |
| `/book/[id]` | Checkout: hold countdown, details form, and the payment state machine |
| `/bookings/[id]` | Confirmation and receipt, with an "Add to calendar" (.ics) download |
| `/bookings` | My bookings: upcoming and past, reschedule (slot picker) and cancel (refund preview) |
| `/login` | Demo sign-in as a customer or as one of six providers. No passwords |
| `/dashboard` | Provider KPIs, week calendar (agenda list on phones), 8-week earnings chart, up next |
| `/dashboard/availability` | Weekly hours and slot length, validated with Zod |

## The hard problems

### 1. A payment screen that never lies about money

`src/store/checkoutSlice.ts` is an explicit state machine: `idle → submitting → processing → succeeded | failed`, plus `unknown`, `mismatch`, `expired` and `error`.

- **Double taps.** Every payment attempt gets one idempotency key. The thunk's `condition` refuses to start while a payment is in flight, and the server returns the existing payment if the same key arrives twice. Three rapid taps send one request and create one charge.
- **Timeouts.** The client gives up waiting after 8 seconds, but the charge may still exist. Instead of showing "failed", the UI moves to "We're not sure yet. Please don't pay again" and polls `GET /api/payments/:key` until the server gives a real answer. If the payment never arrived, it says so and retries with the **same** key, which is safe.
- **Wrong currency.** Money is always `{ amountMinor: integer, currency }`, never a float. A response is only shown as paid if both amount and currency equal the quote on the button. If the API echoes ₦25 for a $25 quote, the UI shows "We couldn't verify this payment" and re-checks with the server.
- **Refresh mid-payment.** The key and phase are saved in `sessionStorage`. Reloading during a payment resumes polling instead of showing the Pay button again.
- A new key is only created after the server has definitively said "failed".

### 2. Two people booking the same slot

Choosing a time creates a 5-minute **hold** on the server. The check and the insert run in one synchronous step, so two simultaneous requests can't both win: one gets `201`, the other gets `409 SLOT_TAKEN` and the slot list refreshes. The hold pauses while a payment is processing, so a slow bank can't make you lose the slot. Slot lists also refresh every 30 seconds while you're deciding.

### 3. Time zones

Providers set hours in their local time (Lagos is WAT, Accra is GMT). Slots are generated in the provider's timezone and stored as UTC. A customer in another timezone sees both times. All of this uses `Intl` only, with no date library (`src/lib/time.ts`).

## Try the edge cases: the Network Lab

The **Network lab** button (bottom-right) changes how the mock payment API behaves:

| Scenario | What happens |
| --- | --- |
| Normal | Settles in about 2.5s |
| Slow 3G | 3s response, 5s settlement |
| Timeout | Charge is recorded, response comes after 15s, client gives up at 8s and polls |
| Bank declines | Accepted, then fails at settlement. "Try a new payment" uses a new key |
| Wrong currency | API returns the right number in the wrong currency |

## Run locally

```bash
npm install
npm run dev
```

Sign in with "Fill in the demo customer" to get a customer account that already has bookings, or choose a provider to see the dashboard.

## Deploy to Render

Push to GitHub, then on Render choose **New → Blueprint** and select the repo. `render.yaml` sets the build (`npm ci && npm run build`) and start (`npm start`) commands.

The data store is in memory and is reseeded on each start, so bookings reset when the free instance sleeps. That's intentional for a demo. A real deployment would swap `src/server/db.ts` for a database and a payment provider such as Paystack, and the API contract would stay the same.

## Performance notes

- Landing and browse pages are server components: about 106 kB first-load JS.
- Heavier client code (forms, Redux, checkout) only loads on the pages that need it.
- Fonts use `display: swap`. There are no images to download; avatars are CSS.
