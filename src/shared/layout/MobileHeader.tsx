import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { authStore, color, ConfirmDialog, font, radius, useAuth, type WashingPoint } from 'q-wash-shared';
import { dateKey } from '../../features/queue/queueModel';
import { useQueueDay } from '../../features/queue/useQueueDay';
import { useMyWashingPointId } from '../useMyWashingPoint';
import { NAV_ITEMS, navItemForPath } from './navItems';
import { useAcceptingToggle } from './useAcceptingToggle';

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

// Mobile replacement for Header + TabBar (design: hamburger, page title over
// the point name, accepting pill; nav lives in a left drawer).
export function MobileHeader({ point }: { point: WashingPoint | undefined }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const current = navItemForPath(pathname);
  const accepting = useAcceptingToggle(point);

  return (
    <>
      <div style={{ padding: '18px 18px 14px', background: color.surfaceAlt, borderBottom: `1px solid ${color.borderAlt}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            role="button"
            aria-label="Меню"
            onClick={() => setMenuOpen(true)}
            style={{
              width: 44,
              height: 44,
              flex: '0 0 44px',
              borderRadius: radius.lg,
              background: color.panel,
              border: '1px solid #282823',
              color: color.textPrimaryAlt,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="20" height="20" {...ICON_PROPS} strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 19, fontWeight: 600, letterSpacing: '-.03em' }}>
              {current.mobileLabel}
            </div>
            <div style={{ color: color.textFaint, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {point?.name ?? '…'}
            </div>
          </div>
          {accepting.canToggle && (
            <div
              onClick={accepting.toggle}
              style={{
                flex: '0 0 auto',
                padding: '8px 12px',
                borderRadius: radius.md - 1,
                fontSize: 12,
                fontWeight: 700,
                cursor: accepting.isSaving ? 'default' : 'pointer',
                opacity: accepting.isSaving ? 0.6 : 1,
                background: accepting.isActive ? color.okBg : color.badBg,
                color: accepting.isActive ? color.ok : color.bad,
              }}
            >
              {accepting.isActive ? '● Приём' : '○ Стоп'}
            </div>
          )}
          {accepting.isPendingReview && (
            <div style={{ padding: '8px 12px', borderRadius: 11, background: color.warnBg, color: color.warn, fontSize: 12, fontWeight: 700 }}>
              На проверке
            </div>
          )}
        </div>
      </div>
      {menuOpen && <Drawer point={point} accepting={accepting} onClose={() => setMenuOpen(false)} />}
    </>
  );
}

function Drawer({
  point,
  accepting,
  onClose,
}: {
  point: WashingPoint | undefined;
  accepting: ReturnType<typeof useAcceptingToggle>;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const washingPointId = useMyWashingPointId();
  // Same query key as the Очередь tab's default (today) view, so this is
  // normally a cache hit rather than an extra request.
  const todayQuery = useQueueDay(washingPointId, dateKey(new Date()));
  const notStarted = (todayQuery.data?.items ?? []).filter((b) => b.status === 'queue' || b.status === 'waiting').length;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,8,7,.62)', zIndex: 35 }} />
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: 304,
          maxWidth: '86vw',
          zIndex: 36,
          background: color.panelAlt,
          borderRight: '1px solid #282823',
          borderRadius: '0 26px 26px 0',
          display: 'flex',
          flexDirection: 'column',
          padding: '28px 16px 30px',
          boxSizing: 'border-box',
          gap: 18,
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0 6px' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ color: color.textPrimary, fontFamily: font.display, fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>
              {point?.name ?? '…'}
            </div>
            <div style={{ color: color.textFaint, fontSize: 12 }}>{point?.address ? `${point.address} · кабинет` : 'кабинет'}</div>
          </div>
          <div
            role="button"
            aria-label="Закрыть меню"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              flex: '0 0 36px',
              borderRadius: radius.md,
              border: `1px solid ${color.borderStrong}`,
              color: color.textFaint,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" {...ICON_PROPS} strokeWidth="2.2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </div>
        </div>

        {accepting.canToggle && (
          <div
            onClick={accepting.toggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '13px 14px',
              borderRadius: 15,
              background: color.input,
              border: '1px solid #282823',
              cursor: accepting.isSaving ? 'default' : 'pointer',
              opacity: accepting.isSaving ? 0.6 : 1,
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ color: color.textPrimaryAlt, fontSize: 13.5, fontWeight: 600 }}>Приём записей</span>
              <span style={{ color: color.textFaint, fontSize: 11.5 }}>
                {accepting.isActive ? 'клиенты видят свободное время' : 'новые записи закрыты'}
              </span>
            </div>
            <div
              role="switch"
              aria-checked={accepting.isActive}
              style={{
                width: 44,
                height: 24,
                flex: '0 0 44px',
                borderRadius: 14,
                padding: 3,
                boxSizing: 'border-box',
                display: 'flex',
                transition: 'background .18s',
                background: accepting.isActive ? color.ok : color.borderStrong,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  transition: 'margin-left .18s',
                  background: accepting.isActive ? color.goldOnLight : color.textFaint,
                  marginLeft: accepting.isActive ? 20 : 0,
                }}
              />
            </div>
          </div>
        )}

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '13px 14px',
                borderRadius: 13,
                fontSize: 14.5,
                fontWeight: 600,
                textDecoration: 'none',
                background: isActive ? color.gold : 'transparent',
                color: isActive ? color.goldOnLight : color.textPrimaryAlt,
              })}
            >
              {({ isActive }) => (
                <>
                  <svg width="20" height="20" {...ICON_PROPS} strokeWidth="1.7">
                    <path d={item.icon} />
                  </svg>
                  <span style={{ flex: 1 }}>{item.mobileLabel}</span>
                  {item.key === 'queue' && notStarted > 0 && (
                    <span
                      style={{
                        minWidth: 22,
                        padding: '2px 7px',
                        boxSizing: 'border-box',
                        borderRadius: 10,
                        textAlign: 'center',
                        fontSize: 11.5,
                        fontWeight: 700,
                        background: isActive ? color.goldOnLight : '#282825',
                        color: isActive ? color.gold : color.textSecondary,
                      }}
                    >
                      {notStarted}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            paddingTop: 14,
            borderTop: `1px solid ${color.borderAlt}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 13, color: color.textSecondary, fontSize: 14, fontWeight: 600 }}>
            <svg width="20" height="20" {...ICON_PROPS} strokeWidth="1.7">
              <circle cx="12" cy="8.4" r="3.6" />
              <path d="M5.2 19.2a6.9 6.9 0 0 1 13.6 0" />
            </svg>
            <span>{user?.name ? `Профиль · ${user.name}` : 'Профиль'}</span>
          </div>
          <div
            role="button"
            onClick={() => setLogoutConfirmOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 13, color: color.bad, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            <svg width="20" height="20" {...ICON_PROPS} strokeWidth="1.7">
              <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9" />
            </svg>
            <span>Выйти</span>
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
