import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  color,
  font,
  radius,
  listQueueDay,
  DataTable,
  DataTableHeaderRow,
  DataTableRow,
  StatusPill,
  useIsMobile,
} from 'q-wash-shared';
import { useMyWashingPointId } from '../../shared/useMyWashingPoint';
import { formatSomoni } from '../../shared/format';
import { pluralRu } from '../../shared/pluralRu';
import { fmtTime, SOURCE_LABEL, STATUS_META } from '../queue/queueModel';
import {
  addDays,
  datesForPeriod,
  durationMinutes,
  filterEntries,
  groupByDay,
  periodRangeLabel,
  type HistoryEntry,
  type HistoryPeriod,
} from './historyModel';

const TABLE_COLUMNS = '64px 96px minmax(0,1.3fr) minmax(0,1.1fr) minmax(0,1.5fr) 0.6fr 0.85fr 30px';
const PERIODS: [HistoryPeriod, string][] = [['today', 'Сегодня'], ['7', '7 дней'], ['30', '30 дней'], ['custom', 'Период']];

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dushanbe' });
}

const filterInputStyle = {
  flex: 1,
  minWidth: 160,
  boxSizing: 'border-box' as const,
  padding: '10px 12px',
  borderRadius: radius.md,
  background: color.input,
  border: `1px solid ${color.borderAlt}`,
  color: color.textPrimaryAlt,
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
};

const dateInputStyle = {
  padding: '9px 10px',
  borderRadius: radius.md,
  background: color.input,
  border: `1px solid ${color.borderAlt}`,
  color: color.textPrimaryAlt,
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
  colorScheme: 'dark' as const,
  boxSizing: 'border-box' as const,
  minWidth: 0,
};

function pillStyle(active: boolean) {
  return {
    flex: 1,
    textAlign: 'center' as const,
    padding: '9px 14px',
    borderRadius: radius.sm,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    border: 'none',
    fontFamily: 'inherit',
    background: active ? color.gold : 'transparent',
    color: active ? color.goldOnLight : color.textFaint,
  };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: `1px solid ${color.borderAlt}` }}>
      <span style={{ color: color.textFaint, fontSize: 12.5 }}>{label}</span>
      <span style={{ color: color.textPrimaryAlt, fontSize: 12.5, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// Right-side detail drawer for one selected booking. The "Фото мастера"
// section mirrors the design mock's chrome but q-wash-api has no concept
// of per-booking photos at all (only a per-point photo gallery, see the
// "Фото и описание" tab) — nor does q-wash-worker capture any. This
// always renders the mock's own empty state rather than a fabricated
// count, since there is no real data source to show, even a fake one.
function DetailDrawer({ entry, onClose }: { entry: HistoryEntry; onClose: () => void }) {
  const status = STATUS_META[entry.status];
  const when = `${fmtTime(entry.scheduled_start_at)}–${fmtTime(entry.scheduled_end_at)}`;
  const rows: [string, string][] = [
    ['Авто', entry.car_name],
    ['Госномер', entry.plate ?? '—'],
    ['Клиент', entry.client_name ?? '—'],
    ['Телефон', entry.client_phone],
    ['Услуга', entry.service_name],
    ['Время работы', `${durationMinutes(entry.scheduled_start_at, entry.scheduled_end_at)} мин`],
    ['Стоимость', formatSomoni(entry.price_cents)],
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,8,7,.5)', zIndex: 30 }} />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(440px, 100vw)',
          zIndex: 31,
          background: color.panelAlt,
          borderLeft: `1px solid ${color.borderStrong}`,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '24px 26px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ color: color.gold, fontSize: 30, fontWeight: 700, letterSpacing: '-.04em', lineHeight: 1 }}>{entry.ticket}</div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div>
              <StatusPill kind={status.pill}>{status.label}</StatusPill>
            </div>
            <div style={{ color: color.textFaint, fontSize: 12 }}>{when}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              width: 34,
              height: 34,
              flex: '0 0 34px',
              borderRadius: radius.sm,
              border: `1px solid ${color.borderStrong}`,
              background: 'transparent',
              color: color.textFaint,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: '0 26px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ borderRadius: radius.lg, background: color.panel, border: `1px solid ${color.borderAlt}`, padding: '4px 14px' }}>
            {rows.map(([k, v]) => (
              <DetailRow key={k} label={k} value={v} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: color.textFaint, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>Фото мастера</div>
            <div style={{ padding: 14, borderRadius: radius.md, background: color.panel, color: color.textFaint, fontSize: 12.5, textAlign: 'center' }}>
              Мастер не добавил фото
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DesktopRow({ entry, onClick }: { entry: HistoryEntry; onClick: () => void }) {
  const status = STATUS_META[entry.status];
  return (
    <DataTableRow gridTemplateColumns={TABLE_COLUMNS} onClick={onClick}>
      <div style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600 }}>{fmtTime(entry.scheduled_start_at)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ color: color.gold, fontSize: 13, fontWeight: 700 }}>{entry.ticket}</span>
        {entry.status !== 'ready' && <StatusPill kind={status.pill}>{status.label}</StatusPill>}
      </div>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.car_name}
        </span>
        <span style={{ color: color.textFaint, fontSize: 11.5, fontFamily: 'monospace' }}>{entry.plate ?? '—'}</span>
      </div>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: color.textSecondary, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.client_name ?? SOURCE_LABEL[entry.source]}
        </span>
        <span style={{ color: color.textFaint, fontSize: 11.5, whiteSpace: 'nowrap' }}>{entry.client_phone}</span>
      </div>
      <div style={{ color: color.textSecondary, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {entry.service_name}
      </div>
      <div style={{ color: color.textFaint, fontSize: 12.5 }}>{durationMinutes(entry.scheduled_start_at, entry.scheduled_end_at)} мин</div>
      <div style={{ color: color.textPrimary, fontSize: 13, fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {formatSomoni(entry.price_cents)}
      </div>
      <div />
    </DataTableRow>
  );
}

function MobileCard({ entry, onClick }: { entry: HistoryEntry; onClick: () => void }) {
  const status = STATUS_META[entry.status];
  return (
    <div
      onClick={onClick}
      style={{ padding: 14, borderRadius: radius.xxl, background: color.panel, border: `1px solid ${color.borderAlt}`, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: color.textPrimaryAlt, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {entry.client_name ?? entry.client_phone}
          </div>
          <div style={{ color: color.textFaint, fontSize: 11.5 }}>
            {fmtTime(entry.scheduled_start_at)} · {entry.ticket} · {durationMinutes(entry.scheduled_start_at, entry.scheduled_end_at)} мин
          </div>
        </div>
        {status.pill !== 'mute' && <StatusPill kind={status.pill}>{status.label}</StatusPill>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ color: color.textTertiary, fontSize: 12.5 }}>
          {entry.car_name}
          {entry.plate ? ` · ${entry.plate}` : ''} · {entry.service_name}
        </div>
        <div style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600, flex: '0 0 auto' }}>{formatSomoni(entry.price_cents)}</div>
      </div>
    </div>
  );
}

// Past bookings for this washing point — a period switcher (today/7/30/
// custom range) over the "Очередь" tab's own per-day endpoint, merged
// client-side (q-wash-api has no date-range history endpoint, see
// historyModel.ts's MAX_CUSTOM_DAYS). Read-only by design: unlike
// "Очередь", there's no status-change/cancel actions here, since a
// finished day isn't something to operate on.
export function HistoryPage() {
  const washingPointId = useMyWashingPointId();
  const isMobile = useIsMobile();
  const today = useMemo(() => todayKey(), []);

  const [period, setPeriod] = useState<HistoryPeriod>('7');
  const [customFrom, setCustomFrom] = useState(() => addDays(today, -6));
  const [customTo, setCustomTo] = useState(today);
  const [service, setService] = useState('all');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [textQuery, setTextQuery] = useState('');
  const [limit, setLimit] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dates = useMemo(() => datesForPeriod(period, customFrom, customTo, today), [period, customFrom, customTo, today]);

  const dayQueries = useQueries({
    queries: dates.map((date) => ({
      queryKey: ['cabinet', 'history', washingPointId, date],
      queryFn: () => listQueueDay(washingPointId, date),
    })),
  });

  const isLoading = dayQueries.some((q) => q.isLoading);
  const isError = dayQueries.some((q) => q.isError);

  // Not memoized: `dayQueries` is a fresh array every render (useQueries'
  // own contract), so there's no stable dependency to key a useMemo on
  // anyway — and merging/sorting at most MAX_CUSTOM_DAYS small day-lists
  // is cheap enough to just redo each render.
  const allEntries: HistoryEntry[] = [];
  dates.forEach((date, i) => {
    const items = dayQueries[i]?.data?.items ?? [];
    const sorted = items.slice().sort((a, b) => b.scheduled_start_at.localeCompare(a.scheduled_start_at));
    for (const item of sorted) allEntries.push({ ...item, date });
  });

  const serviceOptions = Array.from(new Set(allEntries.map((e) => e.service_name))).sort();
  const filtered = filterEntries(allEntries, { service, phoneQuery, textQuery });
  const { groups, totalCount } = groupByDay(filtered, limit, today);
  const selected = selectedId ? filtered.find((e) => e.id === selectedId) ?? null : null;
  const hasFilters = service !== 'all' || !!phoneQuery || !!textQuery;

  function resetFilters() {
    setService('all');
    setPhoneQuery('');
    setTextQuery('');
    setLimit(20);
  }

  function pickPeriod(p: HistoryPeriod) {
    setPeriod(p);
    setLimit(20);
    setSelectedId(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontFamily: font.display, color: color.textPrimary, fontSize: 17, fontWeight: 700 }}>История</div>
          <div style={{ color: color.textFaint, fontSize: 13 }}>
            Выполненные услуги · {periodRangeLabel(period, customFrom, customTo, today)}
          </div>
        </div>
        <div style={{ color: color.textPrimary, fontSize: 20, fontWeight: 700, letterSpacing: '-.03em', whiteSpace: 'nowrap' }}>
          {totalCount} {pluralRu(totalCount, ['услуга', 'услуги', 'услуг'])}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: color.panel, border: `1px solid ${color.borderAlt}`, padding: 4, borderRadius: radius.lg }}>
          {PERIODS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => pickPeriod(id)} style={pillStyle(period === id)}>
              {label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              aria-label="С"
              value={customFrom}
              max={today}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                setLimit(20);
              }}
              style={dateInputStyle}
            />
            <span style={{ color: color.textFaint }}>—</span>
            <input
              type="date"
              aria-label="По"
              value={customTo}
              max={today}
              onChange={(e) => {
                setCustomTo(e.target.value);
                setLimit(20);
              }}
              style={dateInputStyle}
            />
          </div>
        )}
        {serviceOptions.length > 0 && (
          <select
            aria-label="Услуга"
            value={service}
            onChange={(e) => {
              setService(e.target.value);
              setLimit(20);
            }}
            style={{ ...filterInputStyle, flex: '0 0 auto', minWidth: 140, cursor: 'pointer' }}
          >
            <option value="all">Все услуги</option>
            {serviceOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        <input
          value={phoneQuery}
          onChange={(e) => {
            setPhoneQuery(e.target.value.replace(/[^0-9+ ]/g, ''));
            setLimit(20);
          }}
          placeholder="Телефон клиента"
          inputMode="tel"
          style={{ ...filterInputStyle, flex: '0 0 200px' }}
        />
        <input
          value={textQuery}
          onChange={(e) => {
            setTextQuery(e.target.value);
            setLimit(20);
          }}
          placeholder="Авто, госномер или талон"
          style={{ ...filterInputStyle, minWidth: 200 }}
        />
        {hasFilters && (
          <button type="button" onClick={resetFilters} style={{ padding: '10px 12px', background: 'none', border: 'none', color: color.gold, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Сбросить
          </button>
        )}
      </div>

      {isError && <div style={{ color: color.bad, fontSize: 13 }}>Не удалось загрузить историю</div>}

      {isLoading ? (
        <div style={{ color: color.textFaint, fontSize: 13 }}>Загрузка…</div>
      ) : groups.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '46px 20px' }}>
          <div style={{ color: color.textPrimary, fontSize: 15, fontWeight: 600 }}>Ничего не найдено</div>
          <div style={{ color: color.textFaint, fontSize: 13 }}>Измените период или фильтры</div>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              style={{ marginTop: 4, padding: '10px 16px', borderRadius: radius.md, border: `1px solid ${color.borderDashed}`, background: 'none', color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groups.map((g) => (
            <div key={g.date} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '0 2px' }}>
                <span style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600 }}>{g.label}</span>
                <span style={{ color: color.textFaint, fontSize: 12 }}>{g.countLabel}</span>
              </div>
              {g.entries.map((entry) => (
                <MobileCard key={entry.id} entry={entry} onClick={() => setSelectedId(entry.id)} />
              ))}
            </div>
          ))}
          {totalCount > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + 20)}
              style={{ padding: 14, textAlign: 'center', background: 'none', border: 'none', color: color.gold, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Показать ещё · осталось {totalCount - Math.min(limit, totalCount)}
            </button>
          )}
        </div>
      ) : (
        <DataTable>
          <DataTableHeaderRow gridTemplateColumns={TABLE_COLUMNS} columns={['Время', 'Талон', 'Авто', 'Клиент', 'Услуга', 'Работа', 'Сумма', 'Фото']} />
          {groups.map((g) => (
            <div key={g.date}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 20px', background: color.panelAlt, borderBottom: `1px solid ${color.borderAlt}` }}>
                <span style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600 }}>{g.label}</span>
                <span style={{ color: color.textFaint, fontSize: 12 }}>{g.countLabel}</span>
              </div>
              {g.entries.map((entry) => (
                <DesktopRow key={entry.id} entry={entry} onClick={() => setSelectedId(entry.id)} />
              ))}
            </div>
          ))}
          {totalCount > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + 20)}
              style={{ width: '100%', padding: 14, textAlign: 'center', background: 'none', border: 'none', color: color.gold, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Показать ещё · осталось {totalCount - Math.min(limit, totalCount)}
            </button>
          )}
        </DataTable>
      )}

      {selected && <DetailDrawer entry={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
