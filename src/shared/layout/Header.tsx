import { useState } from 'react';
import {
  authStore,
  color,
  font,
  radius,
  type WashingPoint,
  ConfirmDialog,
} from 'q-wash-shared';
import { useAcceptingToggle } from './useAcceptingToggle';

export interface HeaderProps {
  point: WashingPoint | undefined;
}

export function Header({ point }: HeaderProps) {
  const { isActive, canToggle, isPendingReview, isSaving, toggle } = useAcceptingToggle(point);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  return (
    <>
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
          {canToggle && (
            <div
              onClick={toggle}
              title={isActive ? 'Нажмите, чтобы приостановить приём записей' : 'Нажмите, чтобы возобновить приём записей'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: radius.pill,
                cursor: isSaving ? 'default' : 'pointer',
                background: isActive ? color.okBg : color.muteBg,
                color: isActive ? color.ok : color.mute,
                fontSize: 12,
                fontWeight: 700,
                opacity: isSaving ? 0.6 : 1,
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
          {isPendingReview && (
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
            onClick={() => setLogoutConfirmOpen(true)}
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
      {logoutConfirmOpen && (
        <ConfirmDialog
          title="Выйти из аккаунта?"
          message="Понадобится снова ввести логин и пароль, чтобы продолжить работу."
          confirmLabel="Выйти"
          onConfirm={() => void authStore.logout()}
          onCancel={() => setLogoutConfirmOpen(false)}
        />
      )}
    </>
  );
}
