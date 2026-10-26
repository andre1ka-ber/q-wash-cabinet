import { useMemo, useState, type ReactNode } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  color,
  font,
  radius,
  listQueueDay,
  listBookingPhotos,
  resolveApiAssetUrl,
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
import { BottomSheet, CloseButton } from '../queue/QueueParts';
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

const searchInputStyle = {
  flex: 1,
  minWidth: 0,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: color.textPrimaryAlt,
  fontFamily: 'inherit',
  fontSize: 13,
} as const;

function SearchField({ icon, children }: { icon: 'phone' | 'search'; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderRadius: 13, background: color.input, border: `1px solid ${color.borderStrong}`, color: color.textTertiary }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {icon === 'phone' ? (
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
        ) : (
          <>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4.2-4.2" />
          </>
        )}
      </svg>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: `1px solid ${color.borderAlt}` }}>
      <span style={{ color: color.textFaint, fontSize: 12.5 }}>{label}</span>
      <span style={{ color: color.textPrimaryAlt, fontSize: 12.5, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function MasterPhotos({ bookingId }: { bookingId: string }) {
  const photosQuery = useQuery({
    queryKey: ['cabinet', 'booking-photos', bookingId],
    queryFn: () => listBookingPhotos(bookingId),
  });
  const photos = photosQuery.data?.items ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ color: color.textFaint, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>
        Фото мастера{photos.length > 0 ? ` · ${photos.length}` : ''}
      </div>
      {photosQuery.isError ? (
        <div style={{ padding: 14, borderRadius: radius.md, background: color.panel, color: color.bad, fontSize: 12.5, textAlign: 'center' }}>
          Не удалось загрузить фото
        </div>
      ) : photos.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {photos.map((photo) => (
            <a key={photo.id} href={resolveApiAssetUrl(photo.url)} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
              <img
                src={resolveApiAssetUrl(photo.url)}
                alt=""
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12, border: `1px solid ${color.borderAlt}`, display: 'block' }}
              />
            </a>
          ))}
        </div>
      ) : (
        <div style={{ padding: 14, borderRadius: radius.md, background: color.panel, color: color.textFaint, fontSize: 12.5, textAlign: 'center' }}>
          {photosQuery.isLoading ? 'Загрузка…' : 'Мастер не добавил фото'}
        </div>
      )}
    </div>
  );
}

// Detail panel for one selected booking: a right-side drawer on desktop, a
// bottom sheet on mobile.
function DetailDrawer({ entry, mobile, onClose }: { entry: HistoryEntry; mobile: boolean; onClose: () => void }) {
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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: mobile ? 'rgba(8,8,7,.6)' : 'rgba(8,8,7,.5)', zIndex: 30 }} />
      <div
        role="dialog"
        aria-label="Запись"
        style={
          mobile
            ? {
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 31,
                maxHeight: '88%',
                borderRadius: '28px 28px 0 0',
                background: '#171714',
                borderTop: '1px solid #31312B',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
              }
            : {
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
              }
        }
      >
        {mobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
            <div style={{ width: 40, height: 5, borderRadius: 3, background: color.borderDashed }} />
          </div>
        )}
        <div style={{ padding: mobile ? '12px 20px 14px' : '24px 26px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
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
        <div style={{ padding: mobile ? '0 20px 30px' : '0 26px 26px', display: 'flex', flexDirection: 'column', gap: mobile ? 16 : 18 }}>
          <div style={{ borderRadius: radius.lg, background: color.panel, border: `1px solid ${color.borderAlt}`, padding: '4px 14px' }}>
            {rows.map(([k, v]) => (
              <DetailRow key={k} label={k} value={v} />
            ))}
          </div>
          <MasterPhotos bookingId={entry.id} />
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
      style={{ padding: '12px 14px', borderRadius: 16, background: color.panel, border: `1px solid ${color.borderAlt}`, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
    >
      <div style={{ width: 46, flex: '0 0 46px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: color.textPrimary, fontSize: 13.5, fontWeight: 700 }}>{fmtTime(entry.scheduled_start_at)}</span>
        <span style={{ color: color.gold, fontSize: 11.5, fontWeight: 700 }}>{entry.ticket}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.car_name}
          {entry.plate ? ` · ${entry.plate}` : ''}
        </span>
        <span style={{ color: color.textTertiary, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.service_name} · {entry.client_phone}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        <span style={{ color: color.textPrimary, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{formatSomoni(entry.price_cents)}</span>
        {status.pill !== 'mute' && <StatusPill kind={status.pill}>{status.label}</StatusPill>}
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
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  const serviceOptions = Array.from(new Set(allEntries.flatMap((e) => e.items.map((l) => l.service_name)))).sort();
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
      {!isMobile && (
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
      )}

      {isMobile && (
        <>
          <SearchField icon="phone">
            <input
              value={phoneQuery}
              onChange={(e) => {
                setPhoneQuery(e.target.value.replace(/[^0-9+ ]/g, ''));
                setLimit(20);
              }}
              placeholder="Найти по телефону клиента"
              inputMode="tel"
              style={searchInputStyle}
            />
          </SearchField>
          <SearchField icon="search">
            <input
              value={textQuery}
              onChange={(e) => {
                setTextQuery(e.target.value);
                setLimit(20);
              }}
              placeholder="Авто, госномер или талон"
              style={searchInputStyle}
            />
          </SearchField>
          <div style={{ display: 'flex', gap: 3, background: color.panel, border: `1px solid ${color.borderAlt}`, padding: 4, borderRadius: 13 }}>
            {PERIODS.map(([id, label]) => (
              <button key={id} type="button" onClick={() => pickPeriod(id)} style={{ ...pillStyle(period === id), padding: '9px 6px', borderRadius: 10 }}>
                {label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="date" aria-label="С" value={customFrom} max={today} onChange={(e) => { setCustomFrom(e.target.value); setLimit(20); }} style={dateInputStyle} />
              <input type="date" aria-label="По" value={customTo} max={today} onChange={(e) => { setCustomTo(e.target.value); setLimit(20); }} style={dateInputStyle} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: color.panel, border: `1px solid ${color.borderStrong}`, color: color.textPrimaryAlt, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              Фильтры
              {service !== 'all' && (
                <span style={{ minWidth: 20, padding: '1px 6px', boxSizing: 'border-box', borderRadius: 10, background: color.gold, color: color.goldOnLight, fontSize: 11, fontWeight: 800, textAlign: 'center' }}>
                  1
                </span>
              )}
            </button>
            {hasFilters && (
              <button type="button" onClick={resetFilters} style={{ background: 'none', border: 'none', color: color.gold, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                Сбросить
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              <span style={{ color: color.textPrimary, fontSize: 13, fontWeight: 700 }}>
                {totalCount} {pluralRu(totalCount, ['услуга', 'услуги', 'услуг'])}
              </span>
              <span style={{ color: color.textTertiary, fontSize: 11 }}>{periodRangeLabel(period, customFrom, customTo, today)}</span>
            </div>
          </div>
        </>
      )}

      {!isMobile && (
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
      )}

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

      {selected && <DetailDrawer entry={selected} mobile={isMobile} onClose={() => setSelectedId(null)} />}

      {isMobile && filtersOpen && (
        <BottomSheet label="Фильтры" onClose={() => setFiltersOpen(false)}>
          <div style={{ padding: '10px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 600, letterSpacing: '-.02em' }}>Фильтры</div>
            <CloseButton onClick={() => setFiltersOpen(false)} />
          </div>
          <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ color: color.textTertiary, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>Услуга</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {['all', ...serviceOptions].map((name) => {
                const on = service === name;
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setService(name);
                      setLimit(20);
                    }}
                    style={{
                      padding: '9px 13px',
                      borderRadius: 11,
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: on ? color.gold : color.input,
                      color: on ? color.goldOnLight : color.textSecondary,
                      border: `1px solid ${on ? color.gold : color.borderStrong}`,
                    }}
                  >
                    {name === 'all' ? 'Все услуги' : name}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ padding: '14px 20px 30px', borderTop: `1px solid ${color.borderAlt}`, display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={resetFilters}
              style={{ flex: 1, padding: 15, borderRadius: 14, border: `1px solid ${color.borderStrong}`, background: 'transparent', color: color.textSecondary, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Сбросить
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              style={{ flex: 2, padding: 15, borderRadius: 14, border: 'none', background: color.gold, color: color.goldOnLight, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              Показать {totalCount}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
