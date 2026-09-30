import type { QueueDayItem } from 'q-wash-shared';
import { pluralRu } from '../../shared/pluralRu';

export type HistoryPeriod = 'today' | '7' | '30' | 'custom';

// A "Период" (custom range) is built from N parallel per-day requests
// (q-wash-api has no date-range history endpoint, only GET .../queue/day
// for one day at a time) — capped so picking a huge range doesn't fire
// hundreds of requests at once. Same order of magnitude as the "30 дней"
// preset.
export const MAX_CUSTOM_DAYS = 31;

const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function formatIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, delta: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + delta);
  return formatIso(d);
}

function dayAndMonth(iso: string): string {
  const d = parseIso(iso);
  return `${d.getUTCDate()} ${MONTH_GENITIVE[d.getUTCMonth()]}`;
}

// Group header label: "Сегодня, 26 сентября" / "Вчера, 25 сентября" /
// "Пт, 24 сентября".
export function dayGroupLabel(iso: string, today: string): string {
  if (iso === today) return `Сегодня, ${dayAndMonth(iso)}`;
  if (iso === addDays(today, -1)) return `Вчера, ${dayAndMonth(iso)}`;
  return `${DOW[parseIso(iso).getUTCDay()]}, ${dayAndMonth(iso)}`;
}

// Header subtitle range label: "сегодня, 26 сентября" / "20 – 26
// сентября" (same month) / "28 августа – 26 сентября" (different months).
export function periodRangeLabel(period: HistoryPeriod, from: string, to: string, today: string): string {
  if (period === 'today') return `сегодня, ${dayAndMonth(today)}`;
  const a = parseIso(from);
  const b = parseIso(to);
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${a.getUTCDate()} – ${dayAndMonth(to)}`;
  }
  return `${dayAndMonth(from)} – ${dayAndMonth(to)}`;
}

// The set of dates (newest first) to fetch for a period. 'today' is one
// request, '7'/'30' are rolling windows ending today, 'custom' is the
// picked range clamped to [MAX_CUSTOM_DAYS] and to not extend past today.
export function datesForPeriod(period: HistoryPeriod, customFrom: string, customTo: string, today: string): string[] {
  if (period === 'today') return [today];
  if (period === '7') return Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  if (period === '30') return Array.from({ length: 30 }, (_, i) => addDays(today, -i));
  if (!customFrom || !customTo || customFrom > customTo) return [];
  const to = customTo > today ? today : customTo;
  const spanDays = Math.round((parseIso(to).getTime() - parseIso(customFrom).getTime()) / 86_400_000) + 1;
  const from = spanDays > MAX_CUSTOM_DAYS ? addDays(to, -(MAX_CUSTOM_DAYS - 1)) : customFrom;
  const out: string[] = [];
  for (let d = to; d >= from; d = addDays(d, -1)) out.push(d);
  return out;
}

export function durationMinutes(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
}

export interface HistoryEntry extends QueueDayItem {
  date: string;
}

export interface HistoryFilters {
  service: string;
  phoneQuery: string;
  textQuery: string;
}

export function filterEntries(entries: HistoryEntry[], { service, phoneQuery, textQuery }: HistoryFilters): HistoryEntry[] {
  const phoneDigits = phoneQuery.replace(/\D/g, '').replace(/^992/, '');
  const text = textQuery.trim().toLowerCase();
  return entries.filter((e) => {
    if (service !== 'all' && e.service_name !== service) return false;
    if (phoneDigits && !e.client_phone.replace(/\D/g, '').includes(phoneDigits)) return false;
    if (text && !`${e.car_name} ${e.plate ?? ''} ${e.ticket} ${e.client_name ?? ''}`.toLowerCase().includes(text)) return false;
    return true;
  });
}

export interface HistoryGroup {
  date: string;
  label: string;
  countLabel: string;
  entries: HistoryEntry[];
}

// Groups only the paginated (`limit`) slice, but each group's count badge
// reflects that whole day's filtered total, not just the shown rows —
// mirrors the design mock's own grouping (its `total` comes from the
// full per-day bucket, `rows` from the sliced one).
export function groupByDay(entries: HistoryEntry[], limit: number, today: string): { groups: HistoryGroup[]; totalCount: number } {
  const countsByDate = new Map<string, number>();
  for (const e of entries) countsByDate.set(e.date, (countsByDate.get(e.date) ?? 0) + 1);

  const groups: HistoryGroup[] = [];
  for (const e of entries.slice(0, limit)) {
    const last = groups[groups.length - 1];
    if (!last || last.date !== e.date) {
      groups.push({
        date: e.date,
        label: dayGroupLabel(e.date, today),
        countLabel: `${countsByDate.get(e.date)} ${pluralRu(countsByDate.get(e.date)!, ['услуга', 'услуги', 'услуг'])}`,
        entries: [],
      });
    }
    groups[groups.length - 1]!.entries.push(e);
  }
  return { groups, totalCount: entries.length };
}
