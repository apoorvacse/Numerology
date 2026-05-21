# Mini Lead CRM

Submission for the Superleap Frontend Engineering Intern assessment. A
single-page CRM for managing leads through a sales pipeline, with a list
view, a Kanban board, bulk actions, and a 5,000-record dataset to exercise
performance.

All three levels are implemented:

- **Level 1** — list view CRUD, status transition rules, deep-linkable
  routes, validated forms with server error mapping, optimistic delete.
- **Level 2** — Kanban board with `@dnd-kit` drag-and-drop, valid-drop
  rules, optimistic updates, filters/search shared via the URL.
- **Level 3** — bulk select with virtualization (`@tanstack/react-virtual`),
  bulk delete and bulk status change with intersection-of-valid-transitions
  logic, per-lead failure summaries, debounced search, URL-as-state.

---

## Setup

Requires Node 18+ (developed on Node 22).

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm run build        # type-check + production build
npm run typecheck    # tsc --noEmit
npm run preview      # serve the production build
node scripts/generate-seed.mjs   # regenerate public/seed.json
```

The mock API runs **in-browser** via [MSW](https://mswjs.io/) — no separate
process. On first load it seeds 5,000 leads into `localStorage`. Click
**Reset data** in the footer to reseed.

A canonical `public/seed.json` (50 records) is included for inspection;
the runtime store is generated from the same algorithm.

---

## Tech stack

| Concern              | Choice                                    | Why |
| -------------------- | ----------------------------------------- | --- |
| Framework            | **React 18 + Vite + TypeScript**          | Fast HMR, strong typing on a small surface, minimal config. |
| Routing              | **React Router v6**                       | The deep-link requirement is small enough that v6 covers it without needing TanStack Router's data APIs. |
| Server state         | **TanStack Query v5**                     | Built-in caching, optimistic updates, retry/loading/error. The list cache is the source of truth for the table and the board, which is why mutations patch list caches directly. |
| UI state             | **Local component state + URL params**    | No Redux/Zustand. Filter/search/sort live in the URL via `useSearchParams` so views are shareable and survive refresh. Selection is local because it's transient. |
| Form state           | **react-hook-form + zod**                 | Uncontrolled inputs (no re-render storm), `onChange` validation, `zodResolver` so the form schema is the same one the mock API validates against. |
| Styling              | **Tailwind CSS** (custom palette)         | Lets every component carry its visual rules locally. A small `@layer components` (~6 classes) holds the buttons/inputs so the page-level code stays clean. No UI library — every component you see was hand-rolled (modal, toaster, badge, status menu, etc.). |
| Drag and drop        | **@dnd-kit/core**                         | `react-beautiful-dnd` is unmaintained; `react-dnd` is heavier than needed. We don't reorder within a column, so we use `useDraggable` + `useDroppable` directly without `@dnd-kit/sortable`. |
| Virtualization       | **@tanstack/react-virtual**               | The list view virtualizes 5,000+ rows. Kanban columns are capped (per column) for UI sanity rather than virtualized — each column has at most a few hundred cards in normal use. |
| Mock API             | **MSW**                                   | Same `GET/POST/PATCH/PUT/DELETE /leads` contract as `json-server`, but runs entirely in the browser — one less moving part for reviewers. The handlers re-validate inputs with the same zod schemas the form uses, and re-enforce the status transition rules. |

---

## Status transitions — single source of truth

The pipeline lives in `src/domain/statusRules.ts`:

```
NEW → CONTACTED → QUALIFIED → CONVERTED
 ↘         ↘          ↘
                  LOST  (terminal)
```

Both `CONVERTED` and `LOST` are terminal. The same module is consulted by:

- **`StatusMenu`** — only valid next statuses are rendered as menu items.
  Terminal leads render a locked badge with a lock icon (no menu).
- **`BoardPage`** — droppable columns mark themselves "won't accept" via
  visual feedback when an active drag's transition is invalid; on drop we
  re-check before any state change.
- **`BulkActionBar`** — the bulk "Move to" dropdown only shows statuses
  valid for *every* selected lead. If a terminal lead is selected, the
  dropdown is disabled with a clear inline reason.
- **MSW handlers** — server-side validation, returns `422` for invalid
  transitions so even a stale client can't corrupt state.

Centralising the rules means there's exactly one `isValidTransition` /
`commonValidNextStatuses` to change if the pipeline is ever updated.

---

## Code organization

```
src/
  api/        # fetch wrapper + typed endpoints + react-query keys
  components/ # presentation + shared UI primitives (modal, toaster, etc.)
  domain/     # types, status rules, zod schemas (no React imports)
  hooks/      # data hooks, debounce, URL state
  mocks/      # MSW handlers + in-memory DB + seed generator
  pages/      # route-level views
  utils/      # tiny helpers (cn, format)
```

A few intentional separations:

- **Domain code has no React.** Types and rules live in `domain/` and can
  be unit-tested or reused in a server context unchanged.
- **No prop-drilling soup.** Server state goes through TanStack Query
  (`useLeadsList`, `useUpdateLead`, etc.), URL state through
  `useViewState`, transient UI state stays local. Toasts ride a context
  (`ToastProvider`) because they're cross-cutting.
- **Components have one job.** `StatusBadge` (display), `StatusMenu`
  (transition), `StatusFilter` (multi-select). Combining them into a
  "smart status component" was tempting and would have been wrong.

---

## Async handling

Every async path has loading and error states surfaced in the UI:

- **List load** — skeleton spinner, retryable `ErrorState`, contextual
  empty state ("no leads match" vs "no leads yet").
- **Mutations** — TanStack Query's `onMutate` / `onError` / `onSettled`
  apply optimistic updates against the list cache and roll back on
  failure. Status changes and deletes feel instant; if the mock fails,
  the table snaps back and a toast explains why.
- **Forms** — submit button is disabled until the form is valid. Server
  4xx responses are decoded into per-field errors via `setError(field, …)`
  so a `400` on `email` lights up that input — never a raw JSON dump.
- **Drag-and-drop** — invalid drops are blocked before any API call;
  valid drops are optimistic with rollback on error.
- **Bulk actions** — every per-record result is surfaced. A summary toast
  reads "Updated X, Y failed" with the first few failure reasons inline.

---

## Performance choices

- **Virtualized table.** With 5,000 leads the table renders ~12 visible
  rows at a time via `useVirtualizer`. The semantic structure
  (`role="rowgroup"`, `role="row"`, `role="cell"`) is preserved — we use
  CSS Grid on the row so virtualization can absolutely-position rows
  while screen readers still see a real table-shaped list.
- **Debounced search.** The search input buffers keystrokes locally and
  only updates the URL after 250ms; the URL-bound filter parameter is
  itself debounced before being forwarded to the query, so a fast typist
  triggers one fetch instead of N.
- **`keepPreviousData`.** While a new query loads, the previous result
  stays on screen — toggling filters doesn't flash an empty state.
- **Stable query keys.** `leadKeys` factories prevent reference churn,
  so React Query doesn't refetch identical filters on rerender.
- **Memoised derived state.** Columns on the board, selected leads, and
  the common-valid-next-status set are all `useMemo`'d off `items` and
  `selection`.
- **Board column cap.** Cards per column are capped at 250 with a "+N
  more" hint. The board is intended for working sets, not as the canonical
  list — that's what `/leads` is for.

---

## What I'd change with another week

- **Offline support.** Move the mock store from `localStorage` to
  IndexedDB via `idb-keyval`, and wrap mutations with a small outbox
  queue so changes queued offline replay when the API comes back.
- **Concurrent edits.** Today the last write wins. I'd add an
  `If-Match: <updated_at>` style header on PATCH and have the server
  return `409` when the record changed under a stale client. The UI
  would show a non-blocking "this lead changed since you opened it —
  reload? merge?" banner.
- **Pagination on the list.** With virtualization we can hold 5K rows
  fine, but past ~50K we'd want server-side cursor pagination.
  TanStack Query's `useInfiniteQuery` with `getNextPageParam` slots in
  cleanly here.
- **More routing.** Move the create/edit/view modals to dedicated routes
  (`/leads/new`, `/leads/:id`, `/leads/:id/edit`) with proper data
  loaders so a hard refresh on `/leads/<missing-id>` shows a real 404
  page instead of toast-and-redirect.
- **Per-lead activity timeline + audit trail.** Status transitions and
  edits are the natural primitives for it.
- **Tests.** I deferred them per the brief, but the obvious targets are
  `statusRules.ts` (pure functions, unit tests) and the mutations
  hook (mock API + RTL render).
- **Bundle splitting.** The current build emits one ~218KB gzipped
  chunk. Lazy-loading `BoardPage` and `LeadFormDialog` would trim the
  initial JS by roughly a third.
- **Accessibility audit.** The basics are in (focus trap, ESC, aria-live
  toasts, semantic table) — but I'd run axe + a screen reader pass on
  the DnD flow specifically.

---

## AI usage note

I used Kiro (Claude under the hood) as a pair-programmer for scaffolding
and structure decisions. Concretely:

- **Accepted, with light edits:** the project skeleton, the seed data
  generator, the Tailwind component classes, and the boilerplate for
  React Query mutations (`onMutate` / `onError` / `onSettled` patterns).
- **Wrote by hand or rewrote:** the status-transition rules and the
  intersection logic for bulk transitions, the URL-state hook, the
  optimistic cache-patching strategy, the virtualized table layout
  (the AI's first attempt used a non-semantic `<div>` list — I switched
  it to grid-on-row so it could stay a real table), and the modal focus
  trap (I wanted a known-correct ~50 lines, not a copy-pasted snippet).
- **Rejected:** suggestions to pull in `tailwind-merge`, `react-hot-toast`,
  Radix primitives, and a handful of one-off utilities. The dependency
  surface is deliberately small — every package in `package.json`
  earned its slot.

I can walk through any line in the codebase in a follow-up.

---

## Routes

| URL                       | Renders                                         |
| ------------------------- | ----------------------------------------------- |
| `/leads`                  | List view with search, filters, bulk actions    |
| `/leads/:id`              | List view + details modal (View)                |
| `/leads/:id/edit`         | List view + form modal (Edit)                   |
| `/board`                  | Kanban board                                    |

URL parameters honoured on `/leads` and `/board`:
`q`, `status` (comma-separated), `sort`, `order`. They're shared across
both views — applying a filter on `/leads` and switching to `/board`
keeps the same selection.
