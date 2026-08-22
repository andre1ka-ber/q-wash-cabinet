import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authStore, color, font, radius, updateWashingPoint, type WashingPoint } from 'q-wash-shared';
import { useMyWashingPointId } from '../useMyWashingPoint';

export interface HeaderProps {
  point: WashingPoint | undefined;
}

// "Принимаем записи" (accepting bookings) is a direct read/write of
// WashingPoint.status — toggling it fires an instant PATCH, per this
// app's "default to instant/per-section saves" decision (PLAN.md).
export function Header({ point }: HeaderProps) {
  const washingPointId = useMyWashingPointId();
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: (nextStatus: 'active' | 'paused') => updateWashingPoint(washingPointId, { status: nextStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabinet', 'washing-point', washingPointId] });
    },
  });

  const isActive = point?.status === 'active';

  return (
    <div
      style={{
        padding: '20px 32px',
        borderBottom: `1px solid ${color.borderAlt}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div
          style={{
            width: 40,
            height: 40,
            flex: '0 0 auto',
            borderRadius: 11,
            border: '1px solid rgba(217,178,106,.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: font.display,
            color: color.gold,
            fontSize: 18,
          }}
        >
          К
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: font.display,
              color: color.textPrimary,
              fontSize: 18,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {point?.name ?? '…'}
          </div>
          <div style={{ color: color.textFaint, fontSize: 12 }}>{point?.address ?? ''}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
        {point && point.status !== 'pending_review' && (
          <div
            onClick={() => !toggleMutation.isPending && toggleMutation.mutate(isActive ? 'paused' : 'active')}
            title={isActive ? 'Нажмите, чтобы приостановить приём записей' : 'Нажмите, чтобы возобновить приём записей'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: radius.pill,
              cursor: toggleMutation.isPending ? 'default' : 'pointer',
              background: isActive ? color.okBg : color.muteBg,
              color: isActive ? color.ok : color.mute,
              fontSize: 12,
              fontWeight: 700,
              opacity: toggleMutation.isPending ? 0.6 : 1,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'currentColor',
              }}
            />
            {isActive ? 'Принимаем записи' : 'Записи приостановлены'}
          </div>
        )}
        {point?.status === 'pending_review' && (
          <div
            style={{
              padding: '8px 14px',
              borderRadius: radius.pill,
              background: color.warnBg,
              color: color.warn,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            На проверке
          </div>
        )}
        <div
          onClick={() => void authStore.logout()}
          title="Выйти"
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.sm,
            border: `1px solid ${color.borderStrong}`,
            color: color.textMuted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 15,
          }}
        >
          ⎋
        </div>
      </div>
    </div>
  );
}
