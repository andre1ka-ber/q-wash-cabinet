# Progress

See `PLAN.md` for the full plan and build order.

- [x] Phase A — Scaffold
- [x] Phase B — Услуги tab, real data
- [x] Phase C/D — Боксы, real data (unblocked — see PLAN.md and log below)
- [x] Phase E/F — Часы работы, real data (built as one step, not
      mock-then-wire — see PLAN.md)
- [x] Phase G/H — Фото и описание, real data (same)
- [x] Phase I — Polish (dedicated pass, see log below)

## Log

- 2026-08-20 — Imported the design from Claude Design (`Car Wash Web
  Apps.dc.html`, "Кабинет мойки" tab), read `q-wash-api` end to end,
  grilled the plan with the user, wrote `PLAN.md`. Nothing built yet.
- 2026-08-22 — Built phases A, B, E/F, G/H in one session (see PLAN.md's
  "Update 2026-08-22" for why E/F and G/H collapsed to one step each —
  their backend blockers had shipped by the time this session started).

  **Blocker found before any code**: the app's whole design assumes a
  logged-in staff account can discover its own `washing_point_id` with no
  point-picker anywhere — but `GET /me` and the login response never
  exposed it (only the `User` DB model had the column, per
  `PLAN_WEB_APPS.md` phase 1). Every tab this app needs (`services`,
  `schedule`, `photos`) is path-scoped by washing-point id, so this was a
  hard blocker for even scaffolding auth. Flagged to the user as an
  API-contract change (small, additive, nullable) per the platform's
  boundary rule rather than silently working around it with a throwaway
  login-time picker; approved. See `q-wash-api/PROGRESS.md`'s matching
  entry and `q-wash-shared/PROGRESS.md` for the `User.washing_point_id`
  type addition. `q-wash-api`'s dev seed (`cmd/seed`) also never actually
  set `washing_point_id` on the seeded `staff` account — a second, smaller
  gap found while trying to log in locally, fixed in the same pass (see
  `q-wash-api/PROGRESS.md`).

  **Phase A (scaffold)**: same Vite/React/TS/`@tanstack/react-query`/
  `react-router-dom` versions as `q-wash-admin` (the tooling-vouched
  combination, not hand-picked), `q-wash-shared` via `file:` dependency.
  Layout is a header (point name/address, "Принимаем записи"/"Записи
  приостановлены" status pill that PATCHes `WashingPoint.status` instantly
  on click, logout) + a horizontal tab bar (not a sidebar — the mock is
  tab-based for this app) + `<Outlet/>`, unlike `q-wash-admin`'s sidebar
  shell. `App.tsx`'s `ProtectedRoute` adds a second gate beyond
  "authenticated": role must be `staff`/`worker` *and* `washing_point_id`
  must be set, else an `UnsupportedAccount` screen with just a logout
  button — an admin or customer account has nowhere sensible to land in
  an app with no point-picker. `useMyWashingPointId()`/`useMyWashingPoint()`
  (`src/shared/useMyWashingPoint.ts`) read that id off `useAuth()` once and
  are reused by every tab instead of each tab re-deriving it.

  **Phase B (Услуги, real data)**: table (service name+description,
  duration, price options as chips, an instant active/inactive `Toggle`)
  + a create/edit drawer. Added `q-wash-shared`'s `Toggle` component
  (deferred from the original component pass specifically for this —
  first real use). Money renders via a new local `formatSomoni` helper
  (`src/shared/format.ts`) matching the mobile app's convention exactly
  ("128 смн.", not rubles — checked `q-wash/lib/shared/format.dart` before
  inventing a format). The drawer's create path is a single
  `createService` call with a bundled `price_options` array (matches the
  API shape 1:1); the edit path is a real client-side diff against
  `q-wash-api`'s separate price-option endpoints — `PATCH /services/{id}`
  for the service's own fields, then per-row `createPriceOption`/
  `updatePriceOption`/`deletePriceOption` calls, deletes issued before
  creates so removing one option and adding a differently-named one in
  its place never trips the "at least one price option" 409, and
  `is_default` is only ever sent as `true` (never explicit `false` — the
  API rejects unsetting the current sole default; setting a *different*
  row's default to `true` is what unsets the old one server-side). One
  UI-only save button per drawer even though it's several API calls under
  the hood, consistent with the other apps' drawer pattern.

  **Phase E/F (Часы работы, real data)**: 7-row weekday editor (`Toggle`
  per day, `<input type="time">` pairs, an optional break window). Built
  as a local draft seeded once from `GET .../schedule` and left alone
  after that (a background refetch never clobbers an in-progress edit),
  submitted as one `PUT .../schedule` on a single "Сохранить" — matches
  the "Save model" decision (hours gets its own scoped save, not an
  instant per-field one, since the endpoint only accepts a full
  atomic-replace of all 7 rows anyway). Client-side validation mirrors the
  server's (`close_time > open_time`, break within hours) so a bad row is
  caught with a specific weekday-named message before the request goes
  out, not just a generic 400 back.

  **Real backend bug found and fixed here**: `PUT .../schedule` silently
  ignored `is_open: false` — closing a day always left it open in the DB.
  Root-caused to a GORM gotcha (`schedule.WashingPointSchedule.IsOpen`'s
  `default:true` gorm tag colliding with `false` being the Go zero value,
  so `Create` — used by the bulk delete-then-insert `ReplaceAll` — silently
  dropped the column from the INSERT and let the DB's own default win).
  Confirmed via a direct `curl PUT`+`GET` round-trip before touching any
  code (so this was verified as a real server bug, not a client bug), then
  fixed and re-verified the same way after a server restart. Full
  writeup, plus an audit of every other `bool`+`default` gorm field in the
  codebase for the same bug class (none affected), is in
  `q-wash-api/PROGRESS.md`'s matching entry.

  **Phase G/H (Фото и описание, real data)**: photo grid (`+ Ещё` file
  input, one instant `PATCH .../photos/{id} {is_cover:true}` per
  "Сделать обложкой" click, instant `DELETE` per photo) + a description
  textarea and an amenities tag picker, both saved together via one
  "Сохранить" → `PATCH /washing-points/{id} {description, amenities}`.
  Amenities is a free-text Postgres array on the backend, not a lookup
  table (per `PLAN_WEB_APPS.md`), so the picker offers the mock's named
  examples ("Кофе", "Wi-Fi", etc.) as suggested chips *plus* a free-text
  input for anything else, rather than inventing a closed enum the
  backend doesn't have. `q-wash-shared`'s `client.ts` needed one real fix
  to support this tab: `apiRequest` always forced
  `Content-Type: application/json`, which breaks a `multipart/form-data`
  photo upload (the browser needs to set its own boundary) — now skipped
  whenever the request body is a `FormData`. Also added
  `resolveApiAssetUrl()` there, since uploaded photos are served from a
  top-level `/uploads/...` path outside `/api/v1` (see
  `q-wash-api/internal/platform/httpserver`), so an `<img>` needs the
  API's origin, not the app's own.

  **End-to-end browser verification** (`claude-in-chrome`, real login as
  the dev `staff` account against a locally running `q-wash-api`, every
  mutation cross-checked with a direct `curl` against the DB afterward,
  not just visually): created a service with a price option, edited it
  (added a second price option, toggled active off) — all confirmed
  persisted via `GET .../services`; closed Sunday and added a Wednesday
  break in Часы работы — confirmed via `GET .../schedule` (this is what
  surfaced the `is_open` bug above, and confirmed fixed afterward);
  uploaded two photos, swapped the cover, deleted the non-cover one, and
  saved a description + 3 amenities (2 suggested + 1 custom) — all
  confirmed via `GET .../photos` and `GET /washing-points/{id}`.
  `tsc -b`, `oxlint`, and `vite build` all clean for `q-wash-cabinet`
  itself; re-ran the same three for `q-wash-shared` and `q-wash-admin`
  after the shared-package changes to confirm nothing broke there.

  Two unrelated tooling snags hit mid-session, noted for next time: a
  background dev-server job died silently at a 120s default timeout more
  than once (fixed by using a longer-lived background job); the
  browser automation's screenshot action timed out intermittently
  (unrelated to the app — a retry always succeeded).
- 2026-08-22 (later still, same day) — First real polish pass, prompted by
  the user noticing Часы работы and Фото и описание looked narrower than
  Услуги: both had an arbitrary `maxWidth` (760/900) picked ad hoc while
  building each tab, with no cross-tab consistency check at the time.
  Removed both page-level caps so all three tabs share the same full-width
  layout Услуги always had. Часы работы's per-day row also switched from a
  flex row with `marginLeft: auto` pushing the break controls to the far
  right (fine at 760px, but left a large dead gap at full width) to a
  4-column CSS grid (`160px 44px 260px 1fr`), so the break toggle sits
  right after the open/close inputs regardless of viewport width. Фото и
  описание's photo grid now also spans full width (more columns fit), but
  the description/amenities form underneath keeps its own `maxWidth: 760`
  — a full-width single-line-feeling textarea would have been its own
  readability regression, so this is a deliberate inner cap, not the same
  bug. Re-verified all three tabs in the browser at the real 1920px
  viewport this session was running at. `tsc -b`/`oxlint` clean.
- 2026-08-22 (later still, same day) — Discoverability fix on Услуги,
  flagged by the user: clicking a service row opened the edit drawer with
  no visual affordance suggesting it was clickable. Added an explicit
  "Изменить" `GhostButton` per row (new 5th grid column) that opens the
  same drawer; left the row itself still clickable too rather than
  removing it, so this is additive, not a replacement. `tsc -b`/`oxlint`
  clean, re-verified in the browser (button opens the correct service
  pre-filled).
- 2026-08-26 — **Боксы tab built, unblocking Phase C/D**: the backend
  blocker (`Box` entity, `PLAN_WEB_APPS.md` phase 6) had actually shipped
  in `q-wash-api` on 2026-08-22, same day as this app's main build
  session, but this app's own docs hadn't been updated to reflect it — the
  tab was still drawn inert. Re-verified the backend first (ran
  `make test-integration` against real Postgres for the first time this
  session, previously blocked by Docker being outside this sandbox's
  shell allowlist — see `q-wash-api/PROGRESS.md`): all green, including
  `TestBoxes_CRUDOwnershipAndAvailabilityFilter`.

  Grilled three open questions with the user before building (the mock's
  Боксы design assumes fields the `Box` API doesn't return): (1) dropped
  the mock's per-box services-count/slot-length/today's-bookings stats
  entirely — the API response is just `{id, number, label, is_open}`, and
  `PLAN_WEB_APPS.md` already defers per-box services ("all open boxes
  support all of the point's active services"), so a per-box count would
  be meaningless; (2) "Настроить" opens a drawer that edits only `label`
  (same right-side-drawer pattern as `ServiceDrawer`, new `BoxDrawer.tsx`,
  used for both create and edit); "Закрыть"/"Открыть" is a direct
  one-click `GhostButton` on the card toggling `is_open`, no drawer
  round-trip, matching the mock's two separate actions and the
  instant-toggle precedent from Услуги's active switch.

  New `features/boxes/{BoxesPage,BoxDrawer}.tsx`. `BoxesPage` is a card
  grid (`repeat(auto-fill, minmax(220px, 1fr))`, same layout primitive as
  Фото и описание's photo grid) — each card shows "Бокс {number}", the
  label (or "Без описания"), a `StatusPill` (Открыт/ok, Закрыт/bad), and
  the two actions; a dashed "+ Добавить бокс" card matches the photo
  grid's "+ Ещё" tile. `number` is never client-editable (server-assigned
  per the API), so `BoxDrawer` only ever has a label field — deliberately
  narrower than `ServiceDrawer`. No delete affordance built — the mock
  itself doesn't show one for boxes (unlike photos), so this stays out of
  scope rather than being added speculatively.

  `TabBar.tsx`'s Боксы entry switched from the inert placeholder branch to
  a real `to: '/boxes'` route; `App.tsx` gained the matching
  `<Route path="boxes">`. `q-wash-shared` gained the `boxes` resource
  module in the same session (see its own `PROGRESS.md`).

  **Verification**: real end-to-end against a locally seeded backend
  (`make seed`/`make run` in `q-wash-api`, `docker compose up` for
  Postgres). Logged in as `staff`, opened Боксы: both seeded boxes
  rendered correctly (number, "Без описания", Открыт). Closed Бокс 1 —
  pill flipped to Закрыт, button relabeled Открыть, confirmed via a fresh
  page reload the state persisted server-side. Opened Бокс 2's Настроить
  drawer, set a label, saved — card updated to show it. Added a new box
  via "+ Добавить бокс" — server auto-numbered it Бокс 3, exactly as the
  auto-numbering guarantee promises. No console errors on load or through
  the flow. Reopened all three boxes afterward to leave seed data clean.
  `tsc -b`/`oxlint` clean in both `q-wash-shared` and `q-wash-cabinet`.

  **Still open**: no delete UI (see scope note above); a `worker`-role
  account has still never been exercised in this app (pre-existing gap,
  not new).

- 2026-08-31 — **Phase I dedicated polish pass**, closing five concrete
  gaps found by a fresh screen-by-screen audit (compared against this app's
  own established conventions — no toast/confirm-dialog component exists
  anywhere on the platform, confirmed via a cross-app grep, so their
  absence here was never a gap to begin with):
  1. `features/photos/PhotosPage.tsx`'s `PhotoTile` — `coverMutation` and
     `deleteMutation` had no `onError` at all (silent failure). Added,
     copying the exact pattern the same file's `uploadMutation`/
     `saveMutation` already used (`onError: (err) => onError(...)`, now
     lifted to a prop since `PhotoTile` is a child component without its
     own error state).
  2. `features/services/ServicesPage.tsx`'s `ActiveToggleCell` — failure
     only surfaced via a hover `title` tooltip most users would never see.
     Replaced with the visible-inline-text pattern `HoursPage.tsx` already
     used, via the same lifted-`onError`-prop approach as #1 (`ServicesPage`
     gained its own `error` state, rendered the same way `BoxesPage`/
     `PhotosPage` already render theirs).
  3. `features/boxes/BoxesPage.tsx`'s `BoxCard` toggle — zero error handling
     of any kind. Same fix and lifted-prop pattern as #1/#2.
  4. `PhotosPage.tsx` — no loading indicator while `photosQuery` was
     pending, unlike every other tab. Added the identical
     `{query.isLoading ? <div>Загрузка…</div> : ...}` pattern already used
     in `ServicesPage`/`BoxesPage`/`HoursPage`.
  5. Empty-state text inconsistency — `ServicesPage` shows "Пока нет ни
     одной услуги" when empty; `BoxesPage`/`PhotosPage` showed nothing but
     the add-tile. Added matching one-line messages to both.

  Confirmed **not** gaps, no action taken: the two items `PLAN.md`'s own
  "Still open" note already flagged — no box-delete UI (matches the mock,
  deliberate) and the untested `worker`-role session (see verification
  below, not a code gap) — plus 409 error paths on `ServiceDrawer` (already
  handled by its existing generic `onError`) and the unused
  `deactivateService` export in `q-wash-shared` (dead code, out of this
  app's scope to remove).

  **Live verification**, staff account against a locally seeded backend
  (`make seed`/`make run` in `q-wash-api`, `npm run dev` here):
  killed the running `q-wash-api` process and, with it down, triggered each
  of the three new error paths for real — Услуги's active toggle, Боксы's
  open/close toggle, and Фото's delete button all showed a visible
  "Не удалось связаться с сервером" message where before there was silence
  or (for services) only a hover tooltip. Restarted the API between each
  check and confirmed the underlying happy path still worked (toggled a
  service active, closed then reopened a box, both persisting correctly
  server-side on reload). Logged in as the seeded `worker` account
  (previously never exercised in this app): reached the full app with all
  four tabs, no console errors — closes that gap as "already correct,
  just untested," matching what the code audit had already found
  (`App.tsx` already gates staff-or-worker). No console errors at any
  point in this pass (`onlyErrors: true`).

  `tsc -b` and `oxlint` clean throughout (`q-wash-shared` untouched, no
  regressions).

- 2026-08-31 — **Test infrastructure added** (this app had none). Vitest +
  React Testing Library + jsdom, `npm test` runs `vitest run`. New devDeps:
  `vitest`, `@testing-library/react`, `@testing-library/jest-dom`,
  `@testing-library/user-event`, `jsdom` — none of them runtime deps.
  `vitest.config.ts` + `vitest.setup.ts` (jest-dom matchers), and
  `"@testing-library/jest-dom"` added to `tsconfig.app.json`'s `types` so
  `tsc -b` recognizes the matcher types.

  Test coverage added, prioritizing the Phase I `onError` paths above
  (highest regression risk) plus the two pure helpers:
  - `shared/format.test.ts` — `formatSomoni` (whole unit, fractional,
    zero, negative)
  - `shared/pluralRu.test.ts` — all four Russian plural-form branches,
    including the 11-14 teens exception
  - `features/photos/PhotosPage.test.tsx` — loading state, empty state,
    and a failed delete mutation (mocked `ApiError` rejection) surfacing
    its message in the UI
  - `features/services/ServicesPage.test.tsx` — empty state, failed
    toggle mutation surfaces its message
  - `features/boxes/BoxesPage.test.tsx` — empty state, failed toggle
    mutation surfaces its message

  All component tests mock `q-wash-shared`'s API functions and `useAuth`
  only (via `vi.mock` + `importOriginal`, keeping the real UI components/
  theme tokens/`ApiError` class) — the true external boundary from this
  app's point of view, per `docs/testing.md`'s mocking policy. Nothing
  under test is itself mocked.

  `npm test`: 5 files, 15 tests, all passing. `npm run lint` (oxlint) and
  `npx tsc -b --noEmit`: both clean.

  Out of scope, per plan: `HoursPage.tsx` (already had this error pattern
  before Phase I) and drawer form-validation coverage — left for later.

- 2026-09-24 — **Mobile view (≤768px)**, part of a platform-wide pass across
  all four web apps (see root `plan.md`/`progress.md` for the shared plan).
  Uses the new `useIsMobile(768)` hook from `q-wash-shared`.

  `TabBar.tsx`: labels already overflow a 375px viewport well before any
  content does (padding+gaps alone exceed available width), so mobile gets
  `overflowX:'auto'` + reduced `18px` side padding + `flexShrink:0` per tab
  — same horizontal-scroll pattern the source design mock itself uses for
  its tab rows. `Header.tsx` needed no change — its accept pill/logout
  group is narrow enough that the point-name column's existing
  ellipsis/`minWidth:0` absorbs the rest, verified by hand with the real
  measurements before touching anything.

  `ServicesPage.tsx`: new `ServiceCard` (name+description+duration, an
  `Изменить` button, `ActiveToggleCell` reused unchanged) renders as a
  stacked list on mobile instead of `DataTable`; desktop table untouched.
  Price options render as the same flexible chip row as desktop — the
  mock's fixed Седан/SUV/Минивэн columns don't exist on `Service` (its
  `price_options` are free-form named tiers), so this mirrors `q-wash-admin`'s
  precedent of reusing the app's real data shape rather than inventing the
  mock's fields.

  `HoursPage.tsx`: the 4-column `160px 44px 260px 1fr` grid row genuinely
  overflows a phone width (open/close + break inputs alone exceed it) —
  refactored into shared `timesRow`/`breakRow`/`dayLabel`/`toggle` JSX
  fragments reused by both a `display:grid` desktop row and a stacked-flex
  mobile row (day+toggle on one line, then times, then a `flexWrap`'d break
  row so its inputs drop to their own line instead of overflowing).

  `PhotosPage.tsx`: photo grid and description section already reflow on
  their own (`auto-fill` grid, `maxWidth` cap that just shrinks). Only
  change: the custom-amenity input row gets `flexWrap:'wrap'` — its fixed
  200px input plus the "Добавить" button narrowly overflowed a 375px
  content width; the button now wraps to its own line instead. Universal
  fix, not mobile-gated, no visual change at desktop widths.

  `BoxesPage.tsx`: deliberately untouched — its `repeat(auto-fill,
  minmax(220px,1fr))` card grid already collapses to one column on a phone,
  no reflow needed.

  Cross-app gotcha (same one hit in `q-wash-admin`): `vitest.config.ts` was
  missing the `resolve.dedupe: ['react','react-dom']` that `vite.config.ts`
  already carried — only surfaces once a component calls a hook from
  `q-wash-shared`. Fixed here too, plus a `window.matchMedia` jsdom
  polyfill in `vitest.setup.ts` (defaults to non-matching/desktop).

  `npx tsc -b`, `npx vitest run` (5 files / 15 tests), `npm run lint`
  (oxlint), and `npm run build` all clean. No new tests added — existing
  component tests don't exercise `useIsMobile` (they run at its jsdom
  default of "desktop"), consistent with this app's existing coverage
  choices; flagged here rather than silently skipped.

- 2026-09-19 — **New palette/font/logo from Claude Design.** Picked up
  `q-wash-shared`'s new `theme/tokens.ts` values (near-black palette,
  single Sora font) and its new `LogoMark` component (replaces the old
  bordered letter badge in the sidebar/header/login screen — no
  app-specific logic changed, see `q-wash-shared/PROGRESS.md`). Locally:
  removed the `theme/fonts.css` import from `main.tsx` and added the
  Google Fonts `<link>`s + an inline-SVG favicon (same logo mark) to
  `index.html` — self-hosted Manrope/Prata dropped in favor of the CDN.

- 2026-09-24 — **New "QR-код" tab** (5th tab, after "Фото и описание"),
  per the platform's cross-repo `plan.md`. `src/features/qr-code/
  QrCodePage.tsx`: real data throughout via `q-wash-shared`'s
  `getMyQrCode()`/`requestQrCodeReplacement()` (step 1/2 of that plan,
  both already live and reviewed) — the sticker preview (real, scannable
  `QrCodeImage`, encoding the same `resolveApiAssetUrl('/api/v1/qr-codes/
  scan/'+token)` URL q-wash-admin's pool page already verified), the
  scans-today/7d/bookings-via-QR stat row, a 7-day scan bar chart (day
  labels derived from each `scans_by_day` entry's real date, not
  hardcoded weekday names — the window is a real rolling 7 days, not a
  fixed Mon–Sun), and the replacement-request flow (driven by
  `replacement_requested_at` on the fetched data itself, so a page reload
  still shows "already requested" instead of resetting to idle).

  "Скачать наклейку · PDF" reuses q-wash-admin's already-reviewed
  `window.print()` + `@media print` pattern (mount-on-demand print block,
  not permanently CSS-hidden) rather than a PDF library, consistent with
  that decision. "Скачать PNG" is a genuine client-side export — grabs the
  rendered `<svg>` via a wrapper ref, serializes it, rasterizes through an
  offscreen `<canvas>`, and downloads a real PNG; didn't need to touch
  `q-wash-shared`'s `QrCodeImage` for this (no ref-forwarding added — a
  wrapper `<div>` + `querySelector('svg')` was simpler). The 404 empty
  state ("no code assigned yet") is a plain explanatory message — staff
  has no action here, assignment is admin-only per `plan.md`'s scope.
  `TabBar.tsx` needed no other change (already `overflowX:auto` on mobile
  from the earlier mobile-views pass); this page also gets a light
  `useIsMobile()` single-column reflow for free, matching that pass's
  pattern, since it cost little to add alongside the desktop layout.

  `npx tsc -b`, `npx vitest run` (6 files / 19 tests, 4 new), `npm run
  lint` (oxlint), and `npm run build` all clean. `git diff --stat`
  confirms scope: `App.tsx`/`TabBar.tsx` (+3 lines total) plus the new
  `src/features/qr-code/` — `q-wash-shared` untouched.

- 2026-09-25 — **Fixed a real visual regression**: the sticker's QR looked
  denser than the design mock's clean pattern — the mock's fake generator
  used a small fixed grid, but the real encoded URL was long enough to
  need a much higher QR version. `q-wash-api` added a short root-level
  alias, `GET /q/{token}` (same handler, see its own `PROGRESS.md`);
  `scanUrl()` here now builds against that instead of
  `/api/v1/qr-codes/scan/{token}`. `npx tsc -b`, `npx vitest run` (19/19,
  no test changes needed), `npx oxlint` all clean.
  `npm run build` and `npm test` both clean.

- 2026-09-25 (same day) — **Follow-up fix, same QR-image work**: dropped
  `size={192}` on the sticker's `QrCodeImage` in favor of its new default
  (fill 100% of the wrapper) — see `q-wash-shared`'s own `PROGRESS.md` for
  why a hardcoded pixel size is the wrong default (it broke q-wash-admin's
  detail panel the same way) and why this app's sticker wrapper (a fixed
  220×220 `box-sizing:border-box` box) was actually already safe either
  way. Also switched `downloadSvgAsPng`'s size lookup from
  `svg.width.baseVal.value` to `getBoundingClientRect().width`, since the
  former only reliably resolves a plain pixel width attribute, not the
  percentage one `QrCodeImage` now renders by default.

  `npx tsc -b`, `npx vitest run` (19/19), `npx oxlint` clean. Verified for
  real: the sticker QR still renders square (zoomed in to check), and
  clicking "Скачать PNG" produces an actual 192×192 PNG file on disk with
  the correct QR content — not just assumed from the code change.

- 2026-09-25 (same day) — Restyled scrollbars (`index.css`): thin (10px),
  transparent track, rounded dark thumb (`#33322C`, `#4E4E47` on hover)
  instead of the browser default, applied globally (`*`). Same change made
  identically across all four web apps (`q-wash-admin`, `q-wash-cabinet`,
  `q-wash-worker`, `q-wash-display`) for a consistent look. `npx vitest
  run` still 19/19 (CSS-only change).

- 2026-09-25 (same day) — **Часы работы showed 12h AM/PM**: the native
  `<input type="time">` picker's AM/PM-vs-24h display is governed entirely
  by the browser's own UI language, not by page content — tried a `lang`
  attribute on the input first (a commonly-cited fix) and confirmed live,
  by setting `document.documentElement.lang` on the running page, that
  Chromium ignores it completely here. Replaced all four `type="time"`
  inputs in `HoursPage.tsx` (open/close × main hours/break) with a new
  local `TimeSelect` (hour 00–23 + minute 00–59 as two plain `<select>`s),
  which is immune to browser locale by construction. Backend already
  accepts any `HH:MM` in 24h format (`schedule/manager.go`'s
  `timeFormatRegexp`), so no API change was needed.

  `npx tsc --noEmit`, `npx vitest run` (19/19), `npx oxlint` clean.
  Verified for real: values render as plain `09 : 00` with no AM/PM,
  changing an hour via the select updates state correctly, and a direct
  `PUT /washing-points/{id}/schedule` with the exact payload this UI now
  sends round-trips correctly (fetched back unchanged).

  Aside, not fixed (out of scope for this change): saving from the actual
  browser tab twice failed with `503` from chi's `middleware.Timeout`,
  while the identical request via `curl` with a freshly-issued token
  succeeded instantly — looks like the access token in that long-lived
  dev tab expired and the frontend's refresh logic
  (`q-wash-shared/api/client.ts`) only triggers on a `401`, not a `503`,
  so an expired-token request that the backend answers slowly instead of
  with an immediate `401` never gets refreshed-and-retried. Worth a look
  if `PUT`/`POST` calls start failing with "Не удалось связаться с
  сервером" after a session's been open a while.

- 2026-09-25 (same day) — Updated the favicon (`index.html`'s inline
  `data:image/svg+xml` `<link rel="icon">`) to match the `LogoMark` fix
  (see `q-wash-shared`'s `PROGRESS.md`): dark bordered square instead of
  gold, gray/gray/gold bars instead of dark-on-gold. Same change applied
  identically in `q-wash-admin`, `q-wash-worker`, `q-wash-display`.

- 2026-09-25 (same day) — Both logout call sites (`Header.tsx`'s icon
  button and `App.tsx`'s `UnsupportedAccount` screen) now go through the
  new `q-wash-shared` `ConfirmDialog` ("Выйти из аккаунта?") instead of
  calling `authStore.logout()` directly. `npx tsc --noEmit`, `npx vitest
  run` (19/19) clean. Verified `Header.tsx`'s for real in the browser:
  clicking the icon opens the dialog, "Отмена" closes it with no logout.
  `App.tsx`'s uses the identical pattern but wasn't separately
  browser-tested (no unassigned test account handy to reach that screen).

- 2026-09-25 (same day) — `QrCodePage.tsx` was already mostly
  mobile-adjusted (column stacking via `useIsMobile`) but drifted from
  the design mock's now-mobile-adjusted `Q Wash QR Codes.dc.html` (read
  via the `claude_design` MCP,
  `f6bd39c5-b19d-4809-8dd5-e05719c4f6e9`) in two spots:

  1. The stat-card row dropped to a single column on mobile, where the
     mock keeps it 3-up even at phone width. Fixed — `repeat(3,1fr)`
     unconditionally, just a smaller gap on mobile (8px vs 12px),
     matching both the mock and how `q-wash-admin`'s own mobile stat
     grids stay multi-column.
  2. The mock's mobile screen replaces the desktop's inline
     PDF/PNG/"Открыть страницу" button row with a sticky bottom action
     bar (gradient fade, icon + label, PDF/PNG only — no page link) and
     a slightly smaller QR image (196px vs 220px). The page still had
     the old inline row at any width. Fixed: on mobile the inline row is
     replaced by a `position: fixed` bottom bar (a plain spacer `div`
     above it reserves the scroll space so it doesn't cover the
     replacement-request block), "Открыть страницу" is dropped on
     mobile to match the mock, and the QR image shrinks to 196px.
     Desktop is untouched — same three buttons, same 220px image.

  `npx tsc --noEmit`, `npx vitest run` (4/4) clean. Browser-verified with
  the same `window.matchMedia` monkey-patch workaround used for
  `q-wash-admin`'s QR page today (see its `PROGRESS.md` — the sandbox's
  actual browser viewport wouldn't resize below desktop width, so this
  proves the mobile code path renders correctly, not the exact spacing
  at true phone width): confirmed the stat row stays 3 columns, the
  inline button row disappears, the fixed PDF/PNG bar appears and stays
  pinned while the page scrolls, and the spacer keeps the last content
  block ("Запросить замену") clear of it.

- 2026-09-25 (same day) — **New "Отчёты" (reports) tab** — 5th cabinet
  tab, source: `Car Wash Web Apps.dc.html`'s `tabReports` section (same
  Claude Design project as the rest of this app), tab order confirmed
  against the QR-codes mock's own tab list (Услуги, Боксы, Часы работы,
  Фото и описание, Отчёты, QR-код — added between Фото и описание and
  QR-код). User explicitly chose wiring this to a real new backend
  endpoint over a mock-data-first pass when asked — see `q-wash-api`'s
  `PROGRESS.md` phase 10 for that half. Added `ReportsPage.tsx`
  (`features/reports/`), a route (`/reports`) and `TabBar` entry.

  Period picker (Сегодня/Неделя/Месяц, `getReports(washingPointId,
  period)` from `q-wash-shared`), 4 `StatCard`s with delta pills
  (`pctDelta`/`intDelta`/`ppDelta` map the backend's `null`-on-no-prior-data
  convention to no pill at all, not a misleading "+0%"), a revenue bar
  chart (raw RFC3339 bucket timestamps from the backend, formatted
  client-side via `barLabel` — same convention `dayLabel` already uses on
  the QR code page; `period=today`'s bars are further trimmed to the
  point's own open/close hours via `visibleTodayBars`, using
  `useMyWashingPoint()`'s already-fetched `open_time`/`close_time` rather
  than showing 24 mostly-empty hourly bars), a "По услугам" breakdown
  (`DataTable` on desktop, a card list on mobile — this page was built
  mobile-responsive from day one, not as a follow-up gap like the QR
  pages earlier today), and a "По боксам" load list.

  Export, per the plan doc's decision to add no new dependency: "Скачать
  PDF" reuses the exact `window.print()` + print-only-block pattern
  `QrCodePage.tsx` already established; "Скачать Excel" builds a CSV
  client-side (`csvEscape` + a UTF-8 BOM so Cyrillic renders correctly in
  Excel) rather than pulling in an xlsx library.

  New `ReportsPage.test.tsx` (loading state, real KPI/delta/service/box
  rendering, period-switch triggers a refetch with the new period, error
  state) — needed an explicit `cleanup()` in `afterEach` alongside
  `vi.clearAllMocks()`; without it, stale DOM from this file's own
  loading-state test (a query that deliberately never resolves) leaked
  into later tests in the same file and caused spurious
  multiple-elements-found failures — every other test file in this app
  gets away without it, not fully sure why, flagging as an unexplained
  gap in understanding rather than pretending it's solved. `npx tsc
  --noEmit`, `npx vitest run` (4/4 new, 23/23 total) clean.

  Browser-verified for real against the actual local backend (had to
  restart its `go run ./cmd/api` process — the one already running
  predated this session's endpoint and 404'd; found and killed the
  orphaned child binary still holding port 8080 after the wrapper
  process died, then restarted cleanly): the zero-activity empty state
  renders correctly (no seeded completed bookings for this account),
  period switching actually refetches and updates the range label/chart
  title/bucket count (`week` → 7 daily bars in `businessLocation`
  weekdays with today highlighted gold; `today` → hourly bars correctly
  trimmed to the point's real 08:00–20:00 hours; `month` → 25 daily bars
  with sparse 1/5/9/13/17/21/25 labels, last one highlighted), and the
  mobile layout (via the same `matchMedia` monkey-patch as the QR pages)
  stacks correctly — full-width period picker, 2-up export buttons,
  2-column stat grid, card-list services instead of a table. Did not
  actually click "Скачать Excel" to trigger a real file download (no
  need — the CSV-building logic is a simple, directly-reviewed pure
  function, and clicking it would leave a stray downloaded file behind
  for no verification gain); confirmed only that the button renders
  enabled once data loads. The `computer` tool's click-by-coordinate
  action was unreliable on this page for an unrelated reason — its
  screenshot pixel space didn't match the page's actual CSS pixel
  coordinates in this session, so a "correctly aimed" click by eye
  landed on nothing — worked around by reading each button's real
  `getBoundingClientRect()` via `javascript_tool` and dispatching a
  `MouseEvent` at those coordinates instead; noting this in case it
  recurs, since it cost real time to diagnose and isn't a bug in this
  page's code.

- 2026-09-26 — Built the "Очередь" tab (first tab, index route; Услуги moved
  to `/services`) from the Claude Design mock (`Car Wash Web Apps.dc.html`
  desktop + `Car Wash Web Apps Mobile.dc.html` mobile). Desktop: a 7-day strip
  (today + 6), a per-box timeline at 64px/hour whose range comes from that
  weekday's schedule row (widened to fit any out-of-hours booking), a now-line
  on today, and a right-hand panel that swaps between "Выберите запись",
  booking details with status actions, and the manual-add form (clicking empty
  timeline space prefills box/time). Mobile (`useIsMobile`): day strip, box
  filter, chronological list with a "сейчас" marker, details and the form as
  bottom sheets, full-width "Добавить в очередь" button. Actions follow the
  design: past days are view-only; "Отметить приезд" (`waiting`) only on
  today; "Не приехал" = `no_show`; "Отменить запись" = `cancel` endpoint;
  "Вернуть в очередь" = status `queue` from `no_show`/`canceled` (409
  `slot_unavailable` surfaces if the slot was retaken). Manual add needs a
  valid E.164 phone (the backend finds-or-creates the client by it), a car
  name, service, "класс" (= the service's price options), box and a free slot
  from `GET .../availability`; new bookings always start as `queue`.
  Live data: `GET .../queue/day`, refetched on every board SSE event
  (`subscribeToBoardEvents`) with a 15s poll as fallback. All times are
  formatted/sent in Asia/Dushanbe (+05:00) regardless of browser zone. Tests:
  Vitest+RTL (`QueuePage.test.tsx`, `queueModel.test.ts`) — 42/42 total,
  `tsc -b`, `oxlint`, `npm run build` clean. Not verified in a real browser
  against a running API/DB in this pass.
