# Progress

See `PLAN.md` for the full plan and build order.

- [x] Phase A — Scaffold
- [x] Phase B — Услуги tab, real data
- [~] Phase C/D — Боксы (still blocked, see PLAN.md — drawn as an inert
      nav item, not a mock-data build)
- [x] Phase E/F — Часы работы, real data (built as one step, not
      mock-then-wire — see PLAN.md)
- [x] Phase G/H — Фото и описание, real data (same)
- [~] Phase I — Polish (inline per-screen so far, no dedicated pass yet)

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
