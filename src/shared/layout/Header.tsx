import { useState } from 'react';
import {
  authStore,
  color,
  font,
  radius,
  type WashingPoint,
  ConfirmDialog,
  LogoMark,
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
          height: 74,
          flex: '0 0 74px',
          boxSizing: 'border-box',
          background: color.surfaceAlt,
          padding: '0 30px',
          borderBottom: `1px solid ${color.borderAlt}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <LogoMark size={34} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: font.display,
                color: color.textPrimary,
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-.02em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {point?.name ?? '…'}
            </div>
            <div style={{ color: color.textFaint, fontSize: 12 }}>{point?.address ? `${point.address} · кабинет мойки` : 'кабинет мойки'}</div>
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
                padding: '9px 14px',
                borderRadius: radius.md,
                cursor: isSaving ? 'default' : 'pointer',
                background: isActive ? 'rgba(143,203,134,.12)' : color.muteBg,
                color: isActive ? color.ok : color.mute,
                fontSize: 13,
                fontWeight: 600,
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              <span aria-hidden>●</span>
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
