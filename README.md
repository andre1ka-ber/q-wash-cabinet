# q-wash-cabinet

Single-washing-point staff console — one logged-in `staff` account, scoped
to the point they manage (`User.washing_point_id`). Manages that point's
services, boxes, weekly hours, and photos/description. Talks only to
`q-wash-api` over its documented HTTP API, via `q-wash-shared`'s API
client — no direct DB access, no private endpoints.

Design and scope decisions live in `PLAN.md`; the phase-by-phase
implementation log lives in `PROGRESS.md` (including two real backend bugs
found and fixed while building this app). Both are the source of truth for
this app's internals — this file is just how to run it.

## Stack

Vite + React 19.2 + TypeScript, `react-router-dom` v7, `@tanstack/react-query`
v5. Depends on `../q-wash-shared` via a `file:` dependency for theme
tokens, the API client, auth, and common components — not a workspace,
this stays a fully separate top-level project. Vitest + React Testing
Library for tests, oxlint for linting.

## Getting started

```bash
npm install
npm run dev      # needs a running q-wash-api
npm run build    # tsc -b && vite build
```

Log in with a `staff`-role account (username + password via
`POST /auth/login` — see `q-wash-api/README.md` for seeded dev accounts).

## Testing

```bash
npm test          # vitest run
npm run lint       # oxlint
npx tsc -b         # typecheck
```

## Structure

```
src/
  main.tsx, App.tsx      router root, auth gate, tab shell
  features/
    auth/                 login screen
    services/              Услуги — service + price-option table
    boxes/                  Боксы — box card grid + label-edit drawer
    hours/                  Часы работы — per-weekday schedule editor
    photos/                 Фото и описание — photo grid + description
                           + amenities
  shared/
    layout/                Header + tab-bar shell specific to this app
    useMyWashingPoint.ts    resolves the logged-in staff account's own
                           point id — no point picker anywhere in this app
    format.ts, pluralRu.ts helpers (currency formatting, Russian plurals)
```

Save model: instant per-row saves for toggles (services-active, photo
cover/delete); a per-tab "Сохранить" for hours and description/amenities.
See `PLAN.md`'s "Save model" decision for why.
