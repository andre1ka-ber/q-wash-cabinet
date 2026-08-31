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
