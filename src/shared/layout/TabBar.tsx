import { NavLink } from 'react-router-dom';
import { color, useIsMobile } from 'q-wash-shared';

interface TabItem {
  key: string;
  label: string;
  to?: string;
}

const TABS: TabItem[] = [
  { key: 'queue', label: 'Очередь', to: '/' },
  { key: 'services', label: 'Услуги', to: '/services' },
  { key: 'boxes', label: 'Боксы', to: '/boxes' },
  { key: 'hours', label: 'Часы работы', to: '/hours' },
  { key: 'photos', label: 'Фото и описание', to: '/photos' },
  { key: 'reports', label: 'Отчёты', to: '/reports' },
  { key: 'qrCode', label: 'QR-код', to: '/qr-code' },
];

export function TabBar() {
  // All four labels overflow the viewport well before 375px (padding + gaps
  // alone exceed a phone's content width), so mobile needs a horizontally
  // scrollable strip instead of the desktop's fixed-width flex row.
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: isMobile ? '0 18px' : '0 32px',
        borderBottom: `1px solid ${color.borderAlt}`,
        overflowX: isMobile ? 'auto' : undefined,
      }}
    >
      {TABS.map((tab) =>
        tab.to ? (
          <NavLink
            key={tab.key}
            to={tab.to}
            end
            style={({ isActive }) => ({
              padding: '16px 18px',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              color: isActive ? color.textPrimary : color.textMuted,
              borderBottom: `2px solid ${isActive ? color.gold : 'transparent'}`,
              marginBottom: -1,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            })}
          >
            {tab.label}
          </NavLink>
        ) : (
          <div
            key={tab.key}
            style={{
              padding: '16px 18px',
              fontSize: 14,
              fontWeight: 600,
              color: color.textDim,
              cursor: 'default',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </div>
        ),
      )}
    </div>
  );
}
