import type { BookingStatus, QueueDayItem, ScheduleRow, StatusPillKind } from 'q-wash-shared';

// All booking/scheduling logic resolves times in the fixed Asia/Dushanbe
// zone (UTC+5, no DST) — see the platform CLAUDE.md. The browser's own zone
// must never leak into what staff see.
const TZ = 'Asia/Dushanbe';
const TZ_OFFSET = '+05:00';
export const HOUR_PX = 64;
export const DEFAULT_OPEN_MIN = 9 * 60;
export const DEFAULT_CLOSE_MIN = 21 * 60;
export const DAYS_IN_STRIP = 7;

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(d: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(d)) out[p.type] = p.value;
  return out;
}

export function dateKey(d: Date): string {
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

export function minutesOfDay(d: Date): number {
  const p = parts(d);
  return Number(p.hour) * 60 + Number(p.minute);
}

export function fmtMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function fmtTime(iso: string): string {
  return fmtMin(minutesOfDay(new Date(iso)));
}

export function toIsoAt(date: string, minutes: number): string {
  return `${date}T${fmtMin(minutes)}:00${TZ_OFFSET}`;
}

const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export interface DayInfo {
  key: string;
  dow: string;
  num: number;
  label: string;
  rel: 'past' | 'today' | 'future';
  relLabel?: string;
  // 0 = Monday .. 6 = Sunday, the API's schedule weekday convention.
  weekday: number;
}

// Keys are calendar dates, so noon UTC of that date is a safe anchor for
// day-of-week/offset arithmetic regardless of the viewer's zone.
function infoFor(key: string, todayKey: string, offsetFromToday: number): DayInfo {
  const [y, m, d] = key.split('-').map(Number);
  const jsDow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  const rel = key === todayKey ? 'today' : key < todayKey ? 'past' : 'future';
  const relLabel =
    offsetFromToday === 0 ? 'сегодня' : offsetFromToday === 1 ? 'завтра' : offsetFromToday === -1 ? 'вчера' : undefined;
  return { key, dow: DOW[jsDow], num: d, label: `${d} ${MONTHS[m - 1]}`, rel, relLabel, weekday: (jsDow + 6) % 7 };
}

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}

// Today plus the next six days (the design's strip shows yesterday too, but
// the API's per-day list is meaningful for any date, so past days simply
// aren't offered beyond "today" — past-day view-only behaviour still applies
// if a stale selection outlives midnight).
export function buildDays(now: Date): DayInfo[] {
  const todayKey = dateKey(now);
  return Array.from({ length: DAYS_IN_STRIP }, (_, i) => infoFor(addDays(todayKey, i), todayKey, i));
}

export function dayInfoFor(key: string, now: Date): DayInfo {
  const todayKey = dateKey(now);
  const a = new Date(`${key}T12:00:00Z`).getTime();
  const b = new Date(`${todayKey}T12:00:00Z`).getTime();
  return infoFor(key, todayKey, Math.round((a - b) / 86_400_000));
}

export interface StatusMeta {
  label: string;
  pill: StatusPillKind;
  border: string;
  bg: string;
  dim?: boolean;
}

export const STATUS_META: Record<BookingStatus, StatusMeta> = {
  queue: { label: 'Записан', pill: 'mute', border: '#31312B', bg: '#1D1D1A' },
  waiting: { label: 'Приехал', pill: 'warn', border: 'rgba(242,209,75,.55)', bg: 'rgba(242,209,75,.08)' },
  washing: { label: 'Моется', pill: 'ok', border: 'rgba(143,203,134,.5)', bg: 'rgba(143,203,134,.08)' },
  ready: { label: 'Готово', pill: 'mute', border: '#232320', bg: '#171714', dim: true },
  no_show: { label: 'Не приехал', pill: 'bad', border: 'rgba(208,138,122,.35)', bg: '#171714', dim: true },
  canceled: { label: 'Отменён', pill: 'bad', border: '#232320', bg: '#151513', dim: true },
};

export const SOURCE_LABEL = { app: 'Приложение', qr: 'QR у входа', manual: 'Вручную' } as const;

export type ActionKind = 'acc' | 'ghost' | 'bad';
export type ActionType =
  | { type: 'status'; status: 'queue' | 'waiting' | 'washing' | 'ready' | 'no_show' }
  | { type: 'cancel' };

export interface BookingAction {
  label: string;
  kind: ActionKind;
  run: ActionType;
}

// Mirrors the design's actions(): past days are view-only; "arrived" is only
// offered on today (a future booking can't have arrived yet).
export function actionsFor(status: BookingStatus, rel: DayInfo['rel']): BookingAction[] {
  if (rel === 'past') return [];
  const cancel: BookingAction = { label: 'Отменить запись', kind: 'bad', run: { type: 'cancel' } };
  const noShow: BookingAction = { label: 'Не приехал', kind: 'ghost', run: { type: 'status', status: 'no_show' } };
  switch (status) {
    case 'queue':
      return rel === 'today'
        ? [{ label: 'Отметить приезд', kind: 'acc', run: { type: 'status', status: 'waiting' } }, noShow, cancel]
        : [cancel];
    case 'waiting':
      return [{ label: 'Начать мойку', kind: 'acc', run: { type: 'status', status: 'washing' } }, noShow, cancel];
    case 'washing':
      return [{ label: 'Завершить мойку', kind: 'acc', run: { type: 'status', status: 'ready' } }];
    case 'no_show':
    case 'canceled':
      return [{ label: 'Вернуть в очередь', kind: 'ghost', run: { type: 'status', status: 'queue' } }];
    default:
      return [];
  }
}

export interface BoxColumn {
  number: number;
  label: string | null;
}

export function timelineRange(
  schedule: ScheduleRow | undefined,
  items: QueueDayItem[],
): { openMin: number; closeMin: number } {
  let open = DEFAULT_OPEN_MIN;
  let close = DEFAULT_CLOSE_MIN;
  if (schedule?.is_open && schedule.open_time && schedule.close_time) {
    const [oh, om] = schedule.open_time.split(':').map(Number);
    const [ch, cm] = schedule.close_time.split(':').map(Number);
    open = oh * 60 + om;
    close = ch * 60 + cm;
  }
  for (const it of items) {
    const s = minutesOfDay(new Date(it.scheduled_start_at));
    const e = minutesOfDay(new Date(it.scheduled_end_at));
    if (s < open) open = s;
    if (e > close && e > s) close = e;
  }
  open = Math.floor(open / 60) * 60;
  close = Math.ceil(close / 60) * 60;
  return { openMin: open, closeMin: Math.max(close, open + 60) };
}

export function summaryText(items: QueueDayItem[], rel: DayInfo['rel'], firstFree: { min: number; box: number } | null) {
  const active = items.filter((e) => e.status !== 'canceled').length;
  const manual = items.filter((e) => e.source === 'manual').length;
  const free =
    rel === 'past' ? 'день завершён' : firstFree ? `свободно с ${fmtMin(firstFree.min)} · Бокс ${firstFree.box}` : 'свободных окон нет';
  return `${active} записей · ${manual} вручную · ${free}`;
}

export interface FirstFree {
  min: number;
  box: number;
}

// Earliest 30-minute-aligned start (from "now" today, else opening) where an
// open box has a 50-minute gap — the design's "свободно с …" summary, computed
// from the day's own bookings instead of a per-service availability call.
export function firstFree(
  items: QueueDayItem[],
  boxes: { number: number; is_open: boolean }[],
  openMin: number,
  closeMin: number,
  nowMin: number | null,
): FirstFree | null {
  const from = nowMin == null ? openMin : Math.max(openMin, Math.ceil(nowMin / 30) * 30);
  let best: FirstFree | null = null;
  for (const b of boxes) {
    if (!b.is_open) continue;
    const busy = items
      .filter((e) => e.box_number === b.number && e.status !== 'canceled' && e.status !== 'no_show')
      .map((e) => [minutesOfDay(new Date(e.scheduled_start_at)), minutesOfDay(new Date(e.scheduled_end_at))]);
    for (let t = from; t + 50 <= closeMin; t += 30) {
      if (!busy.some(([s, e]) => t < e && s < t + 50)) {
        if (!best || t < best.min) best = { min: t, box: b.number };
        break;
      }
    }
  }
  return best;
}

// Only a sanity check — the API normalizes the number (adds +992 when the
// country code is missing) and is the authority on validity.
export function isValidPhone(raw: string): boolean {
  return (raw.match(/\d/g) ?? []).length >= 9;
}
