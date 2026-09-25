import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Reports, User, WashingPoint } from 'q-wash-shared';
import { ReportsPage } from './ReportsPage';

const getReports = vi.fn();
const getWashingPoint = vi.fn();

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: fakeUser }),
    getReports: (...args: unknown[]) => getReports(...args),
    getWashingPoint: (...args: unknown[]) => getWashingPoint(...args),
  };
});

const fakeUser: User = {
  id: 'user-1',
  phone_number: '+992000000000',
  name: 'Owner',
  role: 'staff',
  washing_point_id: 'wp-1',
  last_login_at: null,
};

const fakePoint: WashingPoint = {
  id: 'wp-1',
  owner_id: null,
  name: 'Pegasus Detailing',
  address: 'ул. Рудаки, 84',
  latitude: 0,
  longitude: 0,
  boxes_count: 2,
  open_time: '09:00',
  close_time: '21:00',
  status: 'active',
};

const fakeReport: Reports = {
  period: 'week',
  range_label: '19 – 25 сентября 2026',
  kpis: {
    revenue_cents: 1234500,
    revenue_delta_pct: 12,
    cars: 87,
    cars_delta: 9,
    avg_receipt_cents: 14189,
    avg_receipt_delta_pct: -2,
    box_utilization_pct: 68,
    box_utilization_delta_pp: -1,
  },
  bars: Array.from({ length: 7 }, (_, i) => ({
    timestamp: `2026-09-${19 + i}T00:00:00+05:00`,
    revenue_cents: 100000 + i * 1000,
    highlighted: i === 6,
  })),
  services: [
    { service_id: 'svc-1', name: 'Ароматическая мойка', count: 12, revenue_cents: 153600, share_pct: 40 },
    { service_id: 'svc-2', name: 'Детейлинг мойка', count: 4, revenue_cents: 79200, share_pct: 60 },
  ],
  boxes: [
    { number: 1, label: 'Бокс 1', cars: 34, revenue_cents: 462000, load_pct: 78 },
    { number: 2, label: 'Бокс 2', cars: 12, revenue_cents: 154000, load_pct: 41 },
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReportsPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  // Explicit cleanup (not just vi.clearAllMocks()) — this file's test 1
  // renders with a query that never resolves, so relying on RTL's
  // automatic afterEach cleanup left stale DOM across tests in practice.
  cleanup();
  vi.clearAllMocks();
});

describe('ReportsPage', () => {
  it('shows a loading indicator while the report is being fetched', () => {
    getReports.mockReturnValue(new Promise(() => {}));
    getWashingPoint.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
  });

  it('renders KPIs, deltas, services, and boxes once loaded', async () => {
    getReports.mockResolvedValue(fakeReport);
    getWashingPoint.mockResolvedValue(fakePoint);
    renderPage();

    expect(await screen.findByText('19 – 25 сентября 2026')).toBeInTheDocument();
    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('-2%')).toBeInTheDocument();
    expect(screen.getByText('-1 п.п.')).toBeInTheDocument();
    expect(screen.getByText('Ароматическая мойка')).toBeInTheDocument();
    expect(screen.getByText('Бокс 1')).toBeInTheDocument();
  });

  it('switching period refetches with the new period', async () => {
    getReports.mockResolvedValue(fakeReport);
    getWashingPoint.mockResolvedValue(fakePoint);
    renderPage();

    await screen.findByText('19 – 25 сентября 2026');
    expect(getReports).toHaveBeenCalledWith('wp-1', 'week');

    await userEvent.click(screen.getByText('Сегодня'));
    await waitFor(() => expect(getReports).toHaveBeenCalledWith('wp-1', 'today'));
  });

  it('shows an error state when the report fails to load', async () => {
    getReports.mockRejectedValue(new Error('network error'));
    getWashingPoint.mockResolvedValue(fakePoint);
    renderPage();
    expect(await screen.findByText('Не удалось загрузить отчёт')).toBeInTheDocument();
  });
});
