import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, color, GhostButton, Toggle, updateWashingPoint, useAuth } from 'q-wash-shared';
import { pendingCountText, usePendingBookings } from '../booking-confirm/usePendingBookings';
import { useMyWashingPoint, useMyWashingPointId } from '../../shared/useMyWashingPoint';

const NOTE = {
  on: {
    toggle:
      'Запись из приложения появляется в очереди со статусом «Ждёт подтверждения». Клиент видит «Ожидайте подтверждения», пока вы не подтвердите.',
    client: '«Запись отправлена — ожидайте подтверждения мойки»',
    cabinet: 'Уведомление с кнопками «Подтвердить» / «Отклонить», карточка в очереди со штриховкой',
  },
  off: {
    toggle: 'Запись из приложения сразу подтверждается и занимает время. Вы получаете уведомление о новой записи.',
    client: '«Вы записаны» — талон и место в очереди сразу',
    cabinet: 'Карточка в очереди как обычная',
  },
} as const;

const CARD = {
  padding: '14px 16px',
  borderRadius: 14,
  background: color.panelAlt,
  border: `1px solid ${color.borderAlt}`,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
} as const;

const CAPTION = { color: color.textTertiary, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' } as const;

// "Настройки → Онлайн-запись": whether online bookings wait for manual
// confirmation (washing point's require_confirmation). Saves instantly, like
// the header's "Принимаем записи" pill.
export function SettingsPage() {
  const washingPointId = useMyWashingPointId();
  const pointQuery = useMyWashingPoint();
  const { user } = useAuth();
  const canEdit = user?.role !== 'worker';
  const queryClient = useQueryClient();
  const pendingCtx = usePendingBookings();

  const mutation = useMutation({
    mutationFn: (next: boolean) => updateWashingPoint(washingPointId, { require_confirmation: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cabinet', 'washing-point', washingPointId] }),
  });

  const confirm = pointQuery.data?.require_confirmation ?? false;
  const note = confirm ? NOTE.on : NOTE.off;
  const leftover = !confirm && pendingCtx && pendingCtx.canDecide ? pendingCtx.pending.length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 980 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ color: color.textPrimary, fontSize: 17, fontWeight: 700 }}>Настройки</div>
        <div style={{ color: color.textTertiary, fontSize: 13 }}>Как мойка принимает онлайн-записи</div>
      </div>

      <div style={{ padding: 20, borderRadius: 18, background: color.panel, border: `1px solid ${color.borderAlt}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span style={CAPTION}>Онлайн-запись</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ color: color.textPrimaryAlt, fontSize: 15, fontWeight: 600 }}>Подтверждать записи вручную</span>
            <span style={{ color: color.textMuted, fontSize: 12.5, lineHeight: 1.55, maxWidth: 640 }}>{note.toggle}</span>
          </div>
          <Toggle checked={confirm} disabled={!canEdit || !pointQuery.data || mutation.isPending} onChange={(next) => mutation.mutate(next)} />
        </div>
        {mutation.isError && (
          <div style={{ color: color.bad, fontSize: 12.5 }}>
            {mutation.error instanceof ApiError ? mutation.error.message : 'Не удалось сохранить настройку'}
          </div>
        )}
        {!canEdit && <div style={{ color: color.textTertiary, fontSize: 12.5 }}>Настройку может менять только администратор мойки.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <div style={CARD}>
            <span style={CAPTION}>Клиент в приложении видит</span>
            <span style={{ color: color.textPrimaryAlt, fontSize: 13.5, lineHeight: 1.5 }}>{note.client}</span>
          </div>
          <div style={CARD}>
            <span style={CAPTION}>Кабинет получает</span>
            <span style={{ color: color.textPrimaryAlt, fontSize: 13.5, lineHeight: 1.5 }}>{note.cabinet}</span>
          </div>
        </div>
        {leftover > 0 && pendingCtx && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              padding: '12px 14px',
              borderRadius: 13,
              background: 'rgba(242,209,75,.08)',
              border: '1px solid rgba(242,209,75,.35)',
            }}
          >
            <span style={{ flex: 1, minWidth: 200, color: color.warn, fontSize: 12.5, lineHeight: 1.5 }}>
              {pendingCountText(leftover).replace(' вашего подтверждения', ' подтверждения')} — они были созданы до переключения.
            </span>
            <GhostButton type="button" disabled={pendingCtx.busy} onClick={pendingCtx.confirmAll} style={{ padding: '8px 12px', fontSize: 12.5 }}>
              Подтвердить все
            </GhostButton>
          </div>
        )}
      </div>
    </div>
  );
}
