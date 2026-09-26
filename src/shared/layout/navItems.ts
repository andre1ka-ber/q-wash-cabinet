export interface NavItem {
  key: string;
  to: string;
  // Desktop tab strip label.
  label: string;
  // Mobile drawer entry and header title (the design spells these out longer).
  mobileLabel: string;
  // SVG path data, 24x24 viewBox, stroked.
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'queue', to: '/', label: 'Очередь', mobileLabel: 'Очередь', icon: 'M4 6h16M4 12h16M4 18h9' },
  { key: 'services', to: '/services', label: 'Услуги', mobileLabel: 'Услуги и цены', icon: 'M7 4h10l3 4-8 12L4 8l3-4ZM4 8h16' },
  { key: 'boxes', to: '/boxes', label: 'Боксы', mobileLabel: 'Боксы', icon: 'M3 20V9l9-5 9 5v11M7 20v-7h10v7' },
  { key: 'hours', to: '/hours', label: 'Часы работы', mobileLabel: 'Часы работы', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7.5V12l3 2' },
  {
    key: 'photos',
    to: '/photos',
    label: 'Фото и описание',
    mobileLabel: 'Фото и описание',
    icon: 'M4 7h3l2-2h6l2 2h3v12H4V7ZM12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  },
  { key: 'reports', to: '/reports', label: 'Отчёты', mobileLabel: 'Отчёты', icon: 'M5 20V11M12 20V5M19 20v-6' },
  { key: 'qrCode', to: '/qr-code', label: 'QR-код', mobileLabel: 'QR-код', icon: 'M4 4h6v6H4V4ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6ZM14 14h3v3h-3v-3ZM20 14v6h-3' },
];

export function navItemForPath(pathname: string): NavItem {
  return NAV_ITEMS.find((i) => i.to !== '/' && pathname.startsWith(i.to)) ?? NAV_ITEMS[0]!;
}
