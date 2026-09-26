import type { MouseEvent } from 'react';
import { color, type Box, type QueueDayItem } from 'q-wash-shared';
import { fmtMin, fmtTime, HOUR_PX, minutesOfDay, STATUS_META } from './queueModel';

const GRID_BG =
  'repeating-linear-gradient(180deg, #262623 0 1px, transparent 1px 32px, #1E1E1B 32px 33px, transparent 33px 64px)';

export function Timeline({
  boxes,
  items,
  openMin,
  closeMin,
  nowMin,
  selectedId,
  canAdd,
  onSelect,
  onAddAt,
}: {
  boxes: Box[];
  items: QueueDayItem[];
  openMin: number;
  closeMin: number;
  nowMin: number | null;
  selectedId: string | null;
  canAdd: boolean;
  onSelect: (id: string) => void;
  onAddAt: (box: number, minutes: number) => void;
}) {
  const height = ((closeMin - openMin) / 60) * HOUR_PX;
  const hours = Array.from({ length: (closeMin - openMin) / 60 }, (_, i) => fmtMin(openMin + i * 60));

  const columnClick = (box: number) => (ev: MouseEvent<HTMLDivElement>) => {
    if (!canAdd) return;
    const r = ev.currentTarget.getBoundingClientRect();
    if (r.height <= 0) return;
    const t = openMin + Math.floor((((ev.clientY - r.top) / r.height) * (closeMin - openMin)) / 30) * 30;
    onAddAt(box, t);
  };

  return (
    <div style={{ flex: 1, minWidth: 0, borderRadius: 18, background: color.panel, border: `1px solid ${color.borderAlt}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${color.borderAlt}` }}>
        <div style={{ width: 56, flex: '0 0 56px' }} />
        {boxes.map((b) => {
          const count = items.filter((e) => e.box_number === b.number && e.status !== 'canceled').length;
          return (
            <div key={b.id} style={{ flex: 1, minWidth: 0, padding: '12px 14px', borderLeft: `1px solid ${color.borderAlt}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ color: color.textPrimary, fontSize: 13.5, fontWeight: 600 }}>
                Бокс {b.number}
                {b.label && <span style={{ color: color.textTertiary, fontWeight: 500 }}> · {b.label}</span>}
                {!b.is_open && <span style={{ color: color.bad, fontWeight: 500 }}> · закрыт</span>}
              </span>
              <span style={{ color: color.textTertiary, fontSize: 12 }}>{count} зап.</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'relative', display: 'flex', height, overflowY: 'auto' }}>
        <div style={{ width: 56, flex: '0 0 56px', display: 'flex', flexDirection: 'column' }}>
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_PX, flex: `0 0 ${HOUR_PX}px`, boxSizing: 'border-box', padding: '5px 0 0 12px', color: color.textTertiary, fontSize: 11 }}>
              {h}
            </div>
          ))}
        </div>
        {boxes.map((b) => (
          <div
            key={b.id}
            data-testid={`box-col-${b.number}`}
            onClick={columnClick(b.number)}
            title={canAdd ? 'Нажмите на пустое место, чтобы добавить запись' : undefined}
            style={{ position: 'relative', flex: 1, minWidth: 0, borderLeft: `1px solid ${color.borderAlt}`, cursor: canAdd ? 'copy' : 'default', background: GRID_BG }}
          >
            {items
              .filter((e) => e.box_number === b.number)
              .map((e) => {
                const meta = STATUS_META[e.status];
                const start = minutesOfDay(new Date(e.scheduled_start_at));
                const dur = (new Date(e.scheduled_end_at).getTime() - new Date(e.scheduled_start_at).getTime()) / 60000;
                const on = e.id === selectedId;
                const strike = e.status === 'canceled' ? 'line-through' : undefined;
                return (
                  <div
                    key={e.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${e.ticket} ${e.car_name}`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSelect(e.id);
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') onSelect(e.id);
                    }}
                    style={{
                      position: 'absolute',
                      left: 6,
                      right: 6,
                      top: ((start - openMin) / 60) * HOUR_PX + 2,
                      height: (dur / 60) * HOUR_PX - 4,
                      boxSizing: 'border-box',
                      padding: '6px 10px',
                      borderRadius: 10,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      zIndex: 2,
                      background: meta.bg,
                      border: `1px solid ${meta.border}`,
                      opacity: meta.dim ? 0.6 : 1,
                      boxShadow: on ? `0 0 0 2px ${color.gold}` : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '-.01em', textDecoration: strike, color: e.status === 'washing' ? color.ok : e.status === 'waiting' ? color.gold : color.textPrimary }}>
                          {e.ticket}
                        </span>
                        {e.source === 'manual' && (
                          <span style={{ padding: '1px 6px', borderRadius: 6, background: '#31312B', color: color.textSecondary, fontSize: 10, fontWeight: 600 }}>вручную</span>
                        )}
                      </div>
                      <span style={{ color: color.textTertiary, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {fmtTime(e.scheduled_start_at)}–{fmtTime(e.scheduled_end_at)}
                      </span>
                    </div>
                    <div style={{ color: color.textSecondary, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: strike }}>
                      {[e.car_name, e.service_name].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
        {nowMin != null && nowMin >= openMin && nowMin <= closeMin && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: ((nowMin - openMin) / 60) * HOUR_PX - 9, display: 'flex', alignItems: 'center', zIndex: 4, pointerEvents: 'none' }}>
            <span style={{ width: 50, flex: '0 0 50px', boxSizing: 'border-box', marginLeft: 3, padding: '2px 0', borderRadius: 6, background: color.bad, color: color.goldOnLight, fontSize: 10.5, fontWeight: 800, textAlign: 'center' }}>
              {fmtMin(nowMin)}
            </span>
            <div style={{ flex: 1, height: 2, background: color.bad }} />
          </div>
        )}
      </div>
    </div>
  );
}
