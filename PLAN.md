# q-wash-cabinet — Plan

Source design: Claude Design project "Car wash queue app"
(`Car Wash Web Apps.dc.html`), the "Кабинет мойки" tab, imported
2026-08-20. Backend: `../q-wash-api`, extended per
`../q-wash-api/docs/PLAN_WEB_APPS.md` — the Услуги tab already works
against the API as it exists today; the other three tabs were blocked on
that plan's phases 4–6 (photos, per-weekday schedule, boxes) as of
2026-08-20.

**Update 2026-08-22**: by the time this app's build actually started,
`PLAN_WEB_APPS.md` phases 4 (photos) and 5 (per-weekday schedule) had
since shipped — see its own `PROGRESS.md`. Only phase 6 (boxes) is still
outstanding. See "Build order, revised" below.

Single-washing-point staff console — one logged-in staff account, scoped to
the one point they manage (`User.washing_point_id` per
`PLAN_WEB_APPS.md`). This is the "wash-cabinet" app from the original ask;
the mock's own label, "Кабинет мойки", is where the directory name comes
from.

## What the design actually is

Header (point name + address, "Принимаем записи" [accepting bookings]
status pill, Save button) over a 4-tab layout:

1. **Услуги (services)** — a table: service name+description, duration,
   price per car class (Седан/SUV/Минивэн), an active/inactive toggle, "+
   Добавить услугу". Maps directly onto the existing `Service` +
   `ServicePriceOption` model — no backend change needed here.
2. **Боксы (boxes)** — a card grid, one per box: name, kind (free-text
   label), status badge (Открыт/Закрыт), services-count/slot-length/
   today's-bookings stats, "Настроить"/"Закрыть" actions, plus a
   dashed "+ Добавить бокс" card. Needs the new `Box` entity.
   **As built (2026-08-26)**: the services-count/slot-length/
   today's-bookings stats were dropped — the real `Box` API response is
   just `{id, number, label, is_open}`, none of that is per-box data on
   the backend, and `PLAN_WEB_APPS.md` explicitly defers per-box services.
   Decided with the user rather than guessed — see `PROGRESS.md`.
3. **Часы работы (hours)** — one row per weekday: name, an on/off toggle,
   a time-range bar with a visual break-window carve-out, a note column.
   Needs `WashingPointSchedule` — this is the one screen whose backend
   dependency is also an availability-algorithm change, not just CRUD (see
   `PLAN_WEB_APPS.md` phase 5's risk note).
4. **Фото и описание (photos & description)** — a photo grid (cover +
   4 more, "+ Ещё" to add), a description textarea, an amenities tag
   picker (multi-select chips, e.g. "Кофе", "Wi-Fi"). Needs
   `WashingPointPhoto` + the `description`/`amenities` columns on
   `WashingPoint`.
5. **Отчёты (reports)** — added later (2026-09-25), source:
   `Car Wash Web Apps.dc.html`'s `tabReports` section, same project. A
   period picker (Сегодня/Неделя/Месяц), 4 KPI cards with deltas
   (выручка/машин/средний чек/загрузка боксов), a revenue bar chart, a
   "по услугам" breakdown table, a "по боксам" load list, and PDF/Excel
   export. Needs a new backend aggregation endpoint — see
   `../q-wash-api/docs/PLAN_WEB_APPS.md` phase 10 — no schema change,
   everything's derived from existing `Queue`/`Service`/`Box` data. Tab
   order (confirmed against the QR-codes mock's own tab list, which
   includes this tab too): Услуги, Боксы, Часы работы, Фото и описание,
   Отчёты, QR-код.

## Decisions locked in (with the user)

- **Framework**: Vite + React + TypeScript.
- **Shared package**: depends on `../q-wash-shared` via `file:` dependency.
- **Fidelity**: close visual port, same bar as the other three apps.
- **Auth**: username + password, `staff` role, scoped to the one point on
  their `User.washing_point_id` — no point picker anywhere in this app,
  unlike `q-wash-admin`.
- **Save model**: the mock shows one header-level "Сохранить" button
  spanning all tabs, but each tab's data maps to a different API
  resource/endpoint with its own natural save point (service toggle is
  instant per-row, hours/photos are more form-like). Building it as one
  giant unsaved-draft-across-4-tabs form adds real complexity for a
  payoff the mock doesn't clearly ask for — **default to instant/
  per-section saves** (toggle fires immediately, hours/photos each save
  on their own "Сохранить" scoped to that tab) unless the user pushes back
  once they see it built.

## App architecture

```
q-wash-cabinet/
  PLAN.md
  PROGRESS.md
  package.json          depends on q-wash-shared via file:../q-wash-shared
  vite.config.ts
  src/
    main.tsx
    App.tsx               router root, auth gate, tab shell
    features/
      auth/                 login screen
      services/              services table + editor — real data
      hours/                  weekday schedule editor — real data
      photos/                 photo grid + description + amenities —
                             real data
      boxes/                  box card grid + label-edit drawer — real
                             data
    shared/
      layout/                Header + tab-bar shell specific to this app
      useMyWashingPoint.ts    resolves the logged-in staff/worker's own
                             point id from useAuth() — no picker anywhere
                             in this app, see the Auth decision above
```

- **Routing**: `react-router`, 4 tab routes under one authenticated shell.
- **Data/server-state**: `@tanstack/react-query` over `q-wash-shared`'s API
  client, per-tab query/mutation hooks.
- **Localization**: Russian only, matching the mock.

## Phased build order

- [x] **A — Scaffold**: Vite react-ts, `q-wash-shared` wired in, theme
      applied, tab shell routed, auth.
- [x] **B — Услуги tab, real data**: this is the one tab that can go
      straight to real `q-wash-api` calls from day one — existing
      Service/ServicePriceOption endpoints already support it.
- [x] **C/D — Боксы**: built 2026-08-26, going straight to real data (no
      mock-first step) — `PLAN_WEB_APPS.md` phase 6 (`Box` entity) had
      already shipped in `q-wash-api` since 2026-08-22, this app's own docs
      just hadn't caught up. Card grid (`BoxesPage.tsx`), label-only edit
      drawer (`BoxDrawer.tsx`, number is server-assigned) — see
      `PROGRESS.md` for the full write-up, including the three
      mock-vs-real-API gaps resolved with the user (dropped the mock's
      per-box stats, split Настроить/Закрыть into a drawer + a direct
      toggle).
- [x] **E/F — Часы работы, real data**: by the time this tab was built,
      `PLAN_WEB_APPS.md` phase 5 (per-weekday schedule) had already
      shipped, so the originally-planned "mock data first, wire up later"
      split was pure overhead — went straight to the real
      `GET`/`PUT .../schedule` endpoints, one step instead of two.
- [x] **G/H — Фото и описание, real data**: same reasoning as E/F — phase 4
      (photos) had also already shipped, so this went straight to real
      `GET/POST/PATCH/DELETE .../photos` + `PATCH /washing-points/{id}`
      (description/amenities) instead of a mock-first pass.
- [x] **I — Polish**: loading/error/empty states were built inline per
      screen as each tab landed, not as a separate pass. Per-tab save
      affordance matches the "Save model" decision below (instant toggles
      for services-active and photo cover/delete; per-tab "Сохранить" for
      hours and description/amenities). Two incremental fixes landed after
      user review, not from a dedicated sweep: made Часы работы/Фото и
      описание span full width like Услуги (both had picked an arbitrary,
      inconsistent `maxWidth` while being built independently), and added
      an explicit "Изменить" button per row on Услуги (row-click alone
      wasn't a discoverable enough affordance). Still open, not yet
      addressed: a `worker`-role account has never been tested (no seeded
      one exists locally); `deactivateService`
      (`DELETE /services/{id}` in `q-wash-shared`) is exported but unused
      — the active/inactive `Toggle` already covers deactivation via
      `PATCH`, so it may be dead weight rather than a real gap; the 409
      error paths (deleting a service's last price option, or one that's
      in use) have never been exercised in the browser, only reasoned
      about; no Go-side regression test guards the `is_open` GORM bug
      fixed this session from recurring.

See `PROGRESS.md` for the full build log, including two real backend bugs
found and fixed while building this app (a missing `washing_point_id` on
`GET /me`, and a GORM default-value bug that silently dropped
`is_open: false` on the schedule PUT) and the end-to-end browser
verification each tab went through.
