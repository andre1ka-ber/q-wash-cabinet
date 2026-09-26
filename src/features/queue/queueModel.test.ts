import { describe, expect, it } from 'vitest';
import { actionsFor, buildDays, dateKey, firstFree, fmtMin, isValidPhone, timelineRange, toIsoAt } from './queueModel';

describe('time helpers (Asia/Dushanbe)', () => {
  it('formats the business date/time regardless of the browser zone', () => {
    // 2026-09-26T21:30Z is already Sept 27 02:30 in UTC+5.
    expect(dateKey(new Date('2026-09-26T21:30:00Z'))).toBe('2026-09-27');
    expect(toIsoAt('2026-09-27', 9 * 60 + 5)).toBe('2026-09-27T09:05:00+05:00');
    expect(fmtMin(605)).toBe('10:05');
  });

  it('builds today + 6 days with relative labels and API weekday index', () => {
    const days = buildDays(new Date('2026-09-26T05:00:00Z')); // Saturday in Dushanbe
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ key: '2026-09-26', rel: 'today', relLabel: 'сегодня', weekday: 5 });
    expect(days[1]).toMatchObject({ key: '2026-09-27', rel: 'future', relLabel: 'завтра', weekday: 6 });
    expect(days[2].weekday).toBe(0);
  });
});

describe('actionsFor', () => {
  const labels = (s: Parameters<typeof actionsFor>[0], rel: Parameters<typeof actionsFor>[1]) => actionsFor(s, rel).map((a) => a.label);

  it('offers arrival only on today', () => {
    expect(labels('queue', 'today')).toEqual(['Отметить приезд', 'Не приехал', 'Отменить запись']);
    expect(labels('queue', 'future')).toEqual(['Отменить запись']);
  });
  it('walks the wash lifecycle', () => {
    expect(labels('waiting', 'today')).toEqual(['Начать мойку', 'Не приехал', 'Отменить запись']);
    expect(labels('washing', 'today')).toEqual(['Завершить мойку']);
    expect(labels('ready', 'today')).toEqual([]);
  });
  it('restores canceled and no-show bookings to the queue', () => {
    expect(actionsFor('no_show', 'today')[0].run).toEqual({ type: 'status', status: 'queue' });
    expect(actionsFor('canceled', 'future')[0].label).toBe('Вернуть в очередь');
  });
  it('is view-only on past days', () => {
    for (const s of ['queue', 'waiting', 'washing', 'no_show', 'canceled'] as const) expect(actionsFor(s, 'past')).toEqual([]);
  });
});

describe('phone validation', () => {
  it('accepts numbers with or without a country code, rejects too-short input', () => {
    expect(isValidPhone('+992 90 123 45 67')).toBe(true);
    expect(isValidPhone('90 123 45 67')).toBe(true);
    expect(isValidPhone('12345678')).toBe(false);
    expect(isValidPhone('901234567')).toBe(true);
    expect(isValidPhone('')).toBe(false);
  });
});

describe('timelineRange / firstFree', () => {
  it('uses the schedule and stretches to cover out-of-hours bookings', () => {
    const row = { weekday: 0, is_open: true, open_time: '08:30', close_time: '20:00' };
    expect(timelineRange(row, [])).toEqual({ openMin: 8 * 60, closeMin: 20 * 60 });
    expect(timelineRange(undefined, [])).toEqual({ openMin: 9 * 60, closeMin: 21 * 60 });
  });

  it('finds the earliest free window across open boxes only', () => {
    const boxes = [
      { number: 1, is_open: true },
      { number: 2, is_open: false },
    ];
    const items = [
      { box_number: 1, status: 'queue', scheduled_start_at: '2026-09-27T09:00:00+05:00', scheduled_end_at: '2026-09-27T10:00:00+05:00' },
    ] as Parameters<typeof firstFree>[0];
    expect(firstFree(items, boxes, 540, 1260, null)).toEqual({ min: 600, box: 1 });
  });
});
