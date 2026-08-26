import { NavLink } from 'react-router-dom';
import { color } from 'q-wash-shared';

interface TabItem {
  key: string;
  label: string;
  to?: string;
}

const TABS: TabItem[] = [
  { key: 'services', label: 'Услуги', to: '/' },
  { key: 'boxes', label: 'Боксы', to: '/boxes' },
  { key: 'hours', label: 'Часы работы', to: '/hours' },
  { key: 'photos', label: 'Фото и описание', to: '/photos' },
];

export function TabBar() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: '0 32px',
        borderBottom: `1px solid ${color.borderAlt}`,
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
            }}
          >
            {tab.label}
          </div>
        ),
      )}
    </div>
  );
}
