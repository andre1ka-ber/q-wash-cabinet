import { describe, expect, it } from 'vitest';
import type { QueueDayItem } from 'q-wash-shared';
import {
  MAX_CUSTOM_DAYS,
  addDays,
  dayGroupLabel,
  datesForPeriod,
  durationMinutes,
  filterEntries,
  groupByDay,
  periodRangeLabel,
  type HistoryEntry,
} from './historyModel';

const TODAY = '2026-09-26';

function entry(overrides: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: 'q1',
    status: 'ready',
    ticket: 'A1',
    box_number: 1,
    scheduled_start_at: '2026-09-26T05:00:00Z',
    scheduled_end_at: '2026-09-26T05:30:00Z',
    source: 'app',
    car_name: 'Toyota Camry',
    client_phone: '+992900000001',
    service_name: 'Комплексная мойка',
    price_option_name: 'Седан',
    price_cents: 12000,
    date: TODAY,
    ...overrides,
  } satisfies HistoryEntry & QueueDayItem;
}

describe('addDays', () => {
  it('adds/subtracts calendar days, including across a month boundary', () => {
    expect(addDays(TODAY, -1)).toBe('2026-09-25');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
  });
});

describe('dayGroupLabel', () => {
  it('labels today and yesterday specially, everything else by weekday', () => {
    expect(dayGroupLabel(TODAY, TODAY)).toBe('Сегодня, 26 сентября');
    expect(dayGroupLabel('2026-09-25', TODAY)).toBe('Вчера, 25 сентября');
    expect(dayGroupLabel('2026-09-24', TODAY)).toBe('Чт, 24 сентября');
  });
});

describe('periodRangeLabel', () => {
  it('formats each period distinctly', () => {
    expect(periodRangeLabel('today', TODAY, TODAY, TODAY)).toBe('сегодня, 26 сентября');
    expect(periodRangeLabel('7', '2026-09-20', TODAY, TODAY)).toBe('20 – 26 сентября');
    expect(periodRangeLabel('custom', '2026-08-28', TODAY, TODAY)).toBe('28 августа – 26 сентября');
  });
});

describe('datesForPeriod', () => {
  it('today is a single date', () => {
    expect(datesForPeriod('today', '', '', TODAY)).toEqual([TODAY]);
  });

  it('7/30 are rolling windows ending today, newest first', () => {
    const seven = datesForPeriod('7', '', '', TODAY);
    expect(seven).toHaveLength(7);
    expect(seven[0]).toBe(TODAY);
    expect(seven.at(-1)).toBe('2026-09-20');

    expect(datesForPeriod('30', '', '', TODAY)).toHaveLength(30);
  });

  it('custom respects the picked range', () => {
    expect(datesForPeriod('custom', '2026-09-23', '2026-09-25', TODAY)).toEqual([
      '2026-09-25', '2026-09-24', '2026-09-23',
    ]);
  });

  it('custom clamps a range longer than MAX_CUSTOM_DAYS to the most recent window', () => {
    const dates = datesForPeriod('custom', '2026-01-01', TODAY, TODAY);
    expect(dates).toHaveLength(MAX_CUSTOM_DAYS);
    expect(dates[0]).toBe(TODAY);
  });

  it('custom clamps "to" so it never extends past today', () => {
    expect(datesForPeriod('custom', '2026-09-24', '2026-12-31', TODAY)).toEqual([
      TODAY, '2026-09-25', '2026-09-24',
    ]);
  });

  it('custom is empty when incomplete or inverted', () => {
    expect(datesForPeriod('custom', '', TODAY, TODAY)).toEqual([]);
    expect(datesForPeriod('custom', TODAY, '2026-09-01', TODAY)).toEqual([]);
  });
});

describe('durationMinutes', () => {
  it('computes whole minutes between two timestamps', () => {
    expect(durationMinutes('2026-09-26T05:00:00Z', '2026-09-26T05:30:00Z')).toBe(30);
  });
});

describe('filterEntries', () => {
  const entries = [
    entry({ id: 'a', service_name: 'Комплексная мойка', car_name: 'Toyota Camry', plate: '0100 AB 01', client_phone: '+992900000001', client_name: 'Азиз' }),
    entry({ id: 'b', service_name: 'Экспресс', car_name: 'Kia Rio', plate: '0200 CD 02', client_phone: '+992900000002', client_name: 'Фарух', ticket: 'B2' }),
  ];

  it('filters by service', () => {
    expect(filterEntries(entries, { service: 'Экспресс', phoneQuery: '', textQuery: '' }).map((e) => e.id)).toEqual(['b']);
  });

  it('filters by phone digits, ignoring the 992 country code', () => {
    expect(filterEntries(entries, { service: 'all', phoneQuery: '992900000002', textQuery: '' }).map((e) => e.id)).toEqual(['b']);
    expect(filterEntries(entries, { service: 'all', phoneQuery: '900000001', textQuery: '' }).map((e) => e.id)).toEqual(['a']);
  });

  it('filters by free text across car/plate/ticket/client', () => {
    expect(filterEntries(entries, { service: 'all', phoneQuery: '', textQuery: 'rio' }).map((e) => e.id)).toEqual(['b']);
    expect(filterEntries(entries, { service: 'all', phoneQuery: '', textQuery: 'b2' }).map((e) => e.id)).toEqual(['b']);
    expect(filterEntries(entries, { service: 'all', phoneQuery: '', textQuery: 'азиз' }).map((e) => e.id)).toEqual(['a']);
  });

  it('is a no-op with no filters', () => {
    expect(filterEntries(entries, { service: 'all', phoneQuery: '', textQuery: '' })).toHaveLength(2);
  });
});

describe('groupByDay', () => {
  it('splits entries into per-day groups', () => {
    const entries = [entry({ id: 'a', date: TODAY }), entry({ id: 'b', date: '2026-09-25' })];
    const { groups, totalCount } = groupByDay(entries, 20, TODAY);

    expect(totalCount).toBe(2);
    expect(groups.map((g) => g.date)).toEqual([TODAY, '2026-09-25']);
    expect(groups[0]!.entries).toEqual([entries[0]]);
  });

  it("a group's count badge reflects that day's full filtered total, not just the paginated slice", () => {
    const entries = [entry({ id: 'a', date: TODAY }), entry({ id: 'b', date: TODAY }), entry({ id: 'c', date: TODAY })];
    const { groups } = groupByDay(entries, 2, TODAY);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.countLabel).toBe('3 услуги');
    expect(groups[0]!.entries).toHaveLength(2);
  });
});
