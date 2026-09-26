import { NavLink } from 'react-router-dom';
import { color } from 'q-wash-shared';
import { NAV_ITEMS } from './navItems';

// Desktop only — on mobile the same items live in MobileHeader's drawer.
export function TabBar() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '0 32px', borderBottom: `1px solid ${color.borderAlt}` }}>
      {NAV_ITEMS.map((tab) => (
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
      ))}
    </div>
  );
}
