import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  color,
  radius,
  listQueueDay,
  DataTable,
  DataTableHeaderRow,
  DataTableRow,
  StatusPill,
  useIsMobile,
  type QueueDayItem,
} from 'q-wash-shared';
import { useMyWashingPointId } from '../../shared/useMyWashingPoint';
import { formatSomoni } from '../../shared/format';
import { fmtTime, SOURCE_LABEL, STATUS_META } from '../queue/queueModel';

const TABLE_COLUMNS = '0.7fr 1.8fr 1.6fr 1.4fr 0.6fr 1fr 1fr';

// A native date input fires onChange on every keystroke while typing a
// segment (month/day/year) one digit at a time, including transient,
// not-yet-complete values like year "0026" — each would otherwise fire a
// real, wasted query for a nonsense date. Only a fully-formed YYYY-MM-DD
// with a plausible year is a date worth querying for.
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isCompleteDate(value: string): boolean {
  return FULL_DATE.test(value) && Number(value.slice(0, 4)) >= 2000;
}

function yesterdayKey(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Dushanbe' });
}

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dushanbe' });
}

function clientLabel(item: QueueDayItem): string {
  return item.client_name ? `${item.client_name} · ${item.client_phone}` : item.client_phone;
}

function DesktopRow({ item, isLast }: { item: QueueDayItem; isLast: boolean }) {
  const status = STATUS_META[item.status];
  return (
    <DataTableRow gridTemplateColumns={TABLE_COLUMNS} isLast={isLast}>
      <div style={{ color: color.textTertiary, fontSize: 13 }}>{fmtTime(item.scheduled_start_at)}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: color.textPrimaryAlt, fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {clientLabel(item)}
        </div>
        <div style={{ color: color.textFaint, fontSize: 11.5 }}>{SOURCE_LABEL[item.source]}</div>
      </div>
      <div style={{ color: color.textTertiary, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {item.car_name}
        {item.plate ? ` · ${item.plate}` : ''}
      </div>
      <div style={{ color: color.textTertiary, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {item.service_name}
      </div>
      <div style={{ color: color.textPrimaryAlt, fontSize: 13 }}>{item.box_number}</div>
      <div>
        <StatusPill kind={status.pill}>{status.label}</StatusPill>
      </div>
      <div style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600 }}>{formatSomoni(item.price_cents)}</div>
    </DataTableRow>
  );
}

function MobileCard({ item }: { item: QueueDayItem }) {
  const status = STATUS_META[item.status];
  return (
    <div style={{ padding: 14, borderRadius: radius.xxl, background: color.panel, border: `1px solid ${color.borderAlt}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: color.textPrimaryAlt, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {clientLabel(item)}
          </div>
          <div style={{ color: color.textFaint, fontSize: 11.5 }}>
            {fmtTime(item.scheduled_start_at)} · Бокс {item.box_number} · {SOURCE_LABEL[item.source]}
          </div>
        </div>
        <StatusPill kind={status.pill}>{status.label}</StatusPill>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ color: color.textTertiary, fontSize: 12.5 }}>
          {item.car_name}
          {item.plate ? ` · ${item.plate}` : ''} · {item.service_name}
        </div>
        <div style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600, flex: '0 0 auto' }}>{formatSomoni(item.price_cents)}</div>
      </div>
    </div>
  );
}

// Past bookings for this washing point, one calendar day at a time — the
// "Очередь" tab's day strip only reaches 6 days forward, nothing back, so
// this is the only place to look up what happened on an earlier day.
// Read-only by design: unlike "Очередь", there's no status-change/cancel
// actions here, since a finished day isn't something to operate on.
export function HistoryPage() {
  const washingPointId = useMyWashingPointId();
  const isMobile = useIsMobile();
  const [date, setDate] = useState(() => yesterdayKey());
  const maxDate = useMemo(() => todayKey(), []);

  const dayQuery = useQuery({
    queryKey: ['cabinet', 'history', washingPointId, date],
    queryFn: () => listQueueDay(washingPointId, date),
  });

  const items = useMemo(
    () => (dayQuery.data?.items ?? []).slice().sort((a, b) => a.scheduled_start_at.localeCompare(b.scheduled_start_at)),
    [dayQuery.data],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 700 }}>История</div>
        <input
          type="date"
          aria-label="Дата"
          value={date}
          max={maxDate}
          onChange={(e) => isCompleteDate(e.target.value) && setDate(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: radius.md,
            background: color.input,
            border: `1px solid ${color.borderStrong}`,
            color: color.textSecondary,
            fontSize: 13,
            fontFamily: 'inherit',
            colorScheme: 'dark',
            outline: 'none',
          }}
        />
      </div>

      {dayQuery.isError && <div style={{ color: color.bad, fontSize: 13 }}>Не удалось загрузить историю</div>}

      {dayQuery.isLoading ? (
        <div style={{ color: color.textFaint, fontSize: 13 }}>Загрузка…</div>
      ) : items.length === 0 ? (
        <div style={{ color: color.textFaint, fontSize: 13, padding: '20px 0' }}>Нет записей за этот день</div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item) => (
            <MobileCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <DataTable>
          <DataTableHeaderRow
            gridTemplateColumns={TABLE_COLUMNS}
            columns={['Время', 'Клиент', 'Авто', 'Услуга', 'Бокс', 'Статус', 'Цена']}
          />
          {items.map((item, i) => (
            <DesktopRow key={item.id} item={item} isLast={i === items.length - 1} />
          ))}
        </DataTable>
      )}
    </div>
  );
}
