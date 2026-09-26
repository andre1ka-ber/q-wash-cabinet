import { color, StatusPill, type Box, type QueueDayItem } from 'q-wash-shared';
import { fmtMin, fmtTime, STATUS_META } from './queueModel';

function NowMarker({ nowMin }: { nowMin: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
      <span style={{ padding: '2px 8px', borderRadius: 6, background: color.bad, color: color.goldOnLight, fontSize: 10.5, fontWeight: 800 }}>сейчас {fmtMin(nowMin)}</span>
      <div style={{ flex: 1, height: 2, background: color.bad }} />
    </div>
  );
}

export function MobileList({
  boxes,
  items,
  boxFilter,
  onBoxFilter,
  nowMin,
  selectedId,
  onSelect,
}: {
  boxes: Box[];
  items: QueueDayItem[];
  boxFilter: number | 'all';
  onBoxFilter: (b: number | 'all') => void;
  nowMin: number | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const sorted = items
    .slice()
    .sort((a, b) => a.scheduled_start_at.localeCompare(b.scheduled_start_at) || a.box_number - b.box_number)
    .filter((e) => boxFilter === 'all' || e.box_number === boxFilter);
  const startMin = (e: QueueDayItem) => {
    const [h, m] = fmtTime(e.scheduled_start_at).split(':').map(Number);
    return h * 60 + m;
  };
  const firstUp = nowMin != null ? sorted.findIndex((e) => startMin(e) > nowMin) : -1;
  const filters: { id: number | 'all'; label: string }[] = [{ id: 'all', label: 'Все' }, ...boxes.map((b) => ({ id: b.number, label: `Бокс ${b.number}` }))];

  return (
    <>
      <div style={{ display: 'flex', gap: 4, background: color.panel, border: `1px solid ${color.borderAlt}`, padding: 4, borderRadius: 13 }}>
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={boxFilter === f.id}
            onClick={() => onBoxFilter(f.id)}
            style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: boxFilter === f.id ? '#282825' : 'transparent', color: boxFilter === f.id ? color.textPrimary : color.textTertiary }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((e, i) => {
          const meta = STATUS_META[e.status];
          const on = e.id === selectedId;
          const strike = e.status === 'canceled' ? 'line-through' : undefined;
          return (
            <div key={e.id} style={{ display: 'contents' }}>
              {nowMin != null && i === firstUp && <NowMarker nowMin={nowMin} />}
              <div
                role="button"
                tabIndex={0}
                aria-label={`${e.ticket} ${e.car_name}`}
                onClick={() => onSelect(e.id)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') onSelect(e.id);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, cursor: 'pointer', background: e.status === 'queue' ? color.panel : meta.bg, border: `1px solid ${on ? color.gold : meta.border}`, opacity: meta.dim ? 0.62 : 1 }}
              >
                <div style={{ width: 44, flex: '0 0 44px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: color.textPrimary, fontSize: 14, fontWeight: 700 }}>{fmtTime(e.scheduled_start_at)}</span>
                  <span style={{ color: color.textTertiary, fontSize: 11 }}>{fmtTime(e.scheduled_end_at)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, textDecoration: strike, color: e.status === 'washing' ? color.ok : e.status === 'waiting' ? color.gold : color.textPrimary }}>{e.ticket}</span>
                    <span style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.car_name || e.client_phone}</span>
                  </div>
                  <div style={{ color: color.textSecondary, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: strike }}>
                    Бокс {e.box_number} · {e.service_name}
                  </div>
                </div>
                <StatusPill kind={meta.pill}>{meta.label}</StatusPill>
              </div>
            </div>
          );
        })}
        {nowMin != null && firstUp === -1 && sorted.length > 0 && <NowMarker nowMin={nowMin} />}
        {sorted.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: color.textTertiary, fontSize: 13 }}>Записей нет</div>}
      </div>
    </>
  );
}
