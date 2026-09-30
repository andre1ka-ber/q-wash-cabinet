import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type QueueDayItem, type User } from 'q-wash-shared';
import { HistoryPage } from './HistoryPage';
import { addDays } from './historyModel';

const listQueueDay = vi.fn();

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: fakeUser }),
    listQueueDay: (...a: unknown[]) => listQueueDay(...a),
  };
});

const fakeUser: User = { id: 'u1', phone_number: null, name: 'Staff', role: 'staff', washing_point_id: 'wp-1', last_login_at: null };

// Same key the component derives "today" from (Asia/Dushanbe) — computed
// fresh, not hardcoded, so the suite stays correct whenever it's run
// (same convention as QueuePage.test.tsx's own `buildDays(new Date())`).
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dushanbe' });
const TODAY_START = `${TODAY}T05:00:00Z`;
const TODAY_END = `${TODAY}T05:30:00Z`;

function item(overrides: Partial<QueueDayItem>): QueueDayItem {
  return {
    id: 'q1',
    status: 'ready',
    ticket: 'A1',
    box_number: 1,
    scheduled_start_at: TODAY_START,
    scheduled_end_at: TODAY_END,
    source: 'app',
    car_name: 'Toyota Camry',
    client_phone: '+992900000001',
    client_name: 'Азиз',
    service_name: 'Комплексная мойка',
    price_option_name: 'Седан',
    price_cents: 12000,
    ...overrides,
  };
}

function onlyToday(items: QueueDayItem[]) {
  return (_wp: string, date: string) => Promise.resolve({ items: date === TODAY ? items : [] });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HistoryPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('HistoryPage', () => {
  it('defaults to the "7 дней" period, firing one request per day and merging the results', async () => {
    listQueueDay.mockResolvedValue({ items: [] });
    renderPage();

    await waitFor(() => expect(listQueueDay).toHaveBeenCalledTimes(7));
    expect(listQueueDay.mock.calls.every((c) => c[0] === 'wp-1')).toBe(true);
    expect(listQueueDay.mock.calls.map((c) => c[1]).sort()).toEqual(
      Array.from({ length: 7 }, (_, i) => addDays(TODAY, -i)).sort(),
    );
  });

  it('lists bookings and shows a per-day group header with a count', async () => {
    listQueueDay.mockImplementation(onlyToday([item({})]));
    renderPage();

    expect(await screen.findByText('Азиз')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText(/Сегодня,/)).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', async () => {
    listQueueDay.mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();
  });

  it('shows an error message when a day fails to load', async () => {
    listQueueDay.mockRejectedValue(new ApiError('internal_error', 'oops', 500));
    renderPage();
    expect(await screen.findByText('Не удалось загрузить историю')).toBeInTheDocument();
  });

  it('switching to "30 дней" fetches the additional days beyond the default 7-day window', async () => {
    listQueueDay.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(listQueueDay).toHaveBeenCalledTimes(7));

    await user.click(screen.getByRole('button', { name: '30 дней' }));

    // The 7 days already cached aren't refetched — only the 23 new ones.
    await waitFor(() => expect(listQueueDay).toHaveBeenCalledTimes(30));
    const requestedDates = new Set(listQueueDay.mock.calls.map((c) => c[1]));
    expect(requestedDates).toEqual(new Set(Array.from({ length: 30 }, (_, i) => addDays(TODAY, -i))));
  });

  it('filters by free-text search across car/plate/ticket', async () => {
    listQueueDay.mockImplementation(onlyToday([item({ id: 'a', car_name: 'Toyota Camry' }), item({ id: 'b', car_name: 'Kia Rio', ticket: 'B2' })]));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Toyota Camry');

    await user.type(screen.getByPlaceholderText('Авто, госномер или талон'), 'Rio');

    expect(screen.queryByText('Toyota Camry')).not.toBeInTheDocument();
    expect(screen.getByText('Kia Rio')).toBeInTheDocument();
  });

  it('resets filters via the "Сбросить фильтры" button', async () => {
    listQueueDay.mockImplementation(onlyToday([item({})]));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Toyota Camry');

    await user.type(screen.getByPlaceholderText('Авто, госномер или талон'), 'nonexistent');
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    expect(await screen.findByText('Toyota Camry')).toBeInTheDocument();
  });

  it('opens the detail drawer on row click, with an always-empty photo section', async () => {
    listQueueDay.mockImplementation(onlyToday([item({})]));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Toyota Camry');

    await user.click(screen.getByText('Азиз'));

    expect(await screen.findByText('Мастер не добавил фото')).toBeInTheDocument();
    const drawer = screen.getByText('Мастер не добавил фото').closest('[style*="position: fixed"]')!;
    expect(within(drawer as HTMLElement).getByText('A1')).toBeInTheDocument();
    expect(within(drawer as HTMLElement).getByText('+992900000001')).toBeInTheDocument();
  });
});
