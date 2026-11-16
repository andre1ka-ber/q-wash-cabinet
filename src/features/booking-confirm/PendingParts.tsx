import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { color, radius, type QueueDayItem } from 'q-wash-shared';
import { boxName, fmtTime } from '../queue/queueModel';
import { pendingCountText, usePendingBookings, whenLabel, type PendingEntry } from './usePendingBookings';

export interface QueueLocationState {
  day: string;
  id: string;
}

const BTN: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  fontFamily: 'inherit',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
};
const BTN_ACC: CSSProperties = { ...BTN, background: color.gold, border: `1px solid ${color.gold}`, color: color.goldOnLight };
const BTN_BAD: CSSProperties = { ...BTN, background: 'transparent', border: `1px solid ${color.badBorder}`, color: color.bad };
const BTN_GHOST: CSSProperties = { ...BTN, background: 'transparent', border: `1px solid ${color.borderDashed}`, color: color.textPrimaryAlt };

function line(item: QueueDayItem): string {
  return [item.ticket, item.car_name, item.service_name].filter(Boolean).join(' · ');
}

function meta(e: PendingEntry): string {
  return `${whenLabel(e.day, fmtTime(e.item.scheduled_start_at))} · ${boxName(e.item)}`;
}

function useOpenInQueue() {
  const navigate = useNavigate();
  return (e: PendingEntry, after?: () => void) => {
    const state: QueueLocationState = { day: e.day, id: e.item.id };
    navigate('/', { state });
    after?.();
  };
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

// Bell with an unread badge and a dropdown/sheet listing bookings that wait
// for confirmation. Renders nothing for workers or outside the provider.
export function PendingBell({ mobile = false }: { mobile?: boolean }) {
  const ctx = usePendingBookings();
  const [open, setOpen] = useState(false);
  const openInQueue = useOpenInQueue();
  if (!ctx || !ctx.canDecide) return null;

  const unread = ctx.unreadIds.size;
  const size = mobile ? 44 : 42;

  const toggle = () => {
    // Opening shows the list; closing marks everything as seen.
    if (open) ctx.markAllRead();
    setOpen(!open);
  };
  const close = () => {
    ctx.markAllRead();
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', flex: '0 0 auto' }}>
      <button
        type="button"
        aria-label={unread ? `Уведомления: ${unread} новых` : 'Уведомления'}
        aria-expanded={open}
        onClick={toggle}
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
          background: open ? color.muteBg : color.input,
          border: `1px solid ${open ? color.gold : '#282823'}`,
          color: open ? color.textPrimary : color.textSecondary,
        }}
      >
        <BellIcon />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              boxSizing: 'border-box',
              borderRadius: 9,
              background: color.gold,
              color: color.goldOnLight,
              fontSize: 11,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div
            role="dialog"
            aria-label="Записи, ожидающие подтверждения"
            style={{
              position: mobile ? 'fixed' : 'absolute',
              ...(mobile ? { left: 12, right: 12, top: 76 } : { right: 0, top: size + 10, width: 400 }),
              zIndex: 41,
              maxHeight: 460,
              overflowY: 'auto',
              borderRadius: 16,
              background: '#1D1D1A',
              border: `1px solid ${color.borderStrong}`,
              boxShadow: '0 18px 50px rgba(0,0,0,.55)',
            }}
          >
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${color.borderAlt}`, color: color.textPrimary, fontSize: 14, fontWeight: 700 }}>
              Записи на подтверждение
            </div>
            {ctx.error && <div style={{ padding: '10px 18px', color: color.bad, fontSize: 12.5 }}>{ctx.error}</div>}
            {ctx.pending.length === 0 ? (
              <div style={{ padding: '28px 18px', color: color.textTertiary, fontSize: 13, textAlign: 'center' }}>Нет записей, ожидающих подтверждения</div>
            ) : (
              ctx.pending.map((e) => (
                <div
                  key={e.item.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '14px 18px',
                    borderBottom: `1px solid ${color.borderAlt}`,
                    background: ctx.unreadIds.has(e.item.id) ? 'rgba(242,209,75,.035)' : undefined,
                  }}
                >
                  <div style={{ color: color.textPrimary, fontSize: 13.5, fontWeight: 700 }}>Новая запись · ждёт подтверждения</div>
                  <div style={{ color: color.textSecondary, fontSize: 12.5 }}>{line(e.item)}</div>
                  <div style={{ color: color.textTertiary, fontSize: 12 }}>{meta(e)}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <button type="button" disabled={ctx.busy} onClick={() => ctx.decide(e.item.id, 'confirm')} style={BTN_ACC}>
                      Подтвердить
                    </button>
                    <button type="button" disabled={ctx.busy} onClick={() => ctx.decide(e.item.id, 'reject')} style={BTN_BAD}>
                      Отклонить
                    </button>
                    <button type="button" onClick={() => openInQueue(e, close)} style={BTN_GHOST}>
                      В очереди
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Pops up when a new booking arrives that needs a decision.
export function PendingToast({ mobile = false }: { mobile?: boolean }) {
  const ctx = usePendingBookings();
  const openInQueue = useOpenInQueue();
  if (!ctx || !ctx.canDecide || !ctx.toast) return null;
  const e = ctx.toast;
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        zIndex: 50,
        ...(mobile ? { left: 12, right: 12, top: 12 } : { right: 30, top: 84, width: 380 }),
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '14px 16px',
        borderRadius: 16,
        background: '#1D1D1A',
        border: '1px solid rgba(242,209,75,.6)',
        boxShadow: '0 18px 50px rgba(0,0,0,.55)',
      }}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 32, height: 32, flex: '0 0 32px', borderRadius: 10, background: color.warnBg, color: color.warn, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BellIcon />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: color.textPrimary, fontSize: 13.5, fontWeight: 700 }}>Новая запись ждёт подтверждения</div>
          <div style={{ color: color.textSecondary, fontSize: 12.5, marginTop: 2 }}>{line(e.item)}</div>
          <div style={{ color: color.textTertiary, fontSize: 12 }}>{meta(e)}</div>
        </div>
        <button type="button" aria-label="Закрыть" onClick={ctx.dismissToast} style={{ background: 'transparent', border: 'none', color: color.textTertiary, cursor: 'pointer', fontSize: 16, alignSelf: 'flex-start' }}>
          ×
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" disabled={ctx.busy} onClick={() => ctx.decide(e.item.id, 'confirm')} style={BTN_ACC}>
          Подтвердить
        </button>
        <button type="button" onClick={() => openInQueue(e, ctx.dismissToast)} style={BTN_GHOST}>
          В очереди
        </button>
      </div>
    </div>
  );
}

// Strip above the queue: how many bookings wait, with a bulk confirm.
export function PendingBanner({ onShow }: { onShow?: (e: PendingEntry) => void }) {
  const ctx = usePendingBookings();
  if (!ctx || !ctx.canDecide || ctx.pending.length === 0) return null;
  const first = ctx.pending[0];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '12px 14px',
        borderRadius: radius.lg,
        background: 'rgba(242,209,75,.08)',
        border: '1px solid rgba(242,209,75,.45)',
      }}
    >
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ color: color.warn, fontSize: 13.5, fontWeight: 700 }}>{pendingCountText(ctx.pending.length)}</div>
        <div style={{ color: color.textTertiary, fontSize: 12, marginTop: 2 }}>
          Клиенты видят «Ожидайте подтверждения». Ближайшая: {first.item.ticket} · {whenLabel(first.day, fmtTime(first.item.scheduled_start_at))}
        </div>
        {ctx.error && <div style={{ color: color.bad, fontSize: 12.5, marginTop: 4 }}>{ctx.error}</div>}
      </div>
      {onShow && (
        <button type="button" onClick={() => onShow(first)} style={BTN_GHOST}>
          Показать
        </button>
      )}
      <button type="button" disabled={ctx.busy} onClick={ctx.confirmAll} style={BTN_ACC}>
        Подтвердить все
      </button>
    </div>
  );
}
