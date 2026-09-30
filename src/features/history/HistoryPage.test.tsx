import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type QueueDayItem, type User } from 'q-wash-shared';
import { HistoryPage } from './HistoryPage';

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

function item(overrides: Partial<QueueDayItem>): QueueDayItem {
  return {
    id: 'q1',
    status: 'ready',
    ticket: 'A1',
    box_number: 1,
    scheduled_start_at: '2026-09-20T05:00:00Z',
    scheduled_end_at: '2026-09-20T05:30:00Z',
    source: 'app',
    car_name: 'Toyota Camry',
    client_phone: '+992000000001',
    service_name: 'Комплексная мойка',
    price_option_name: 'Седан',
    price_cents: 12000,
    ...overrides,
  };
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
  it('loads the default (yesterday) date and lists bookings sorted by time', async () => {
    listQueueDay.mockResolvedValue({
      items: [
        item({ id: 'q2', scheduled_start_at: '2026-09-20T08:00:00Z', client_phone: '+992000000002', car_name: 'Kia Rio' }),
        item({ id: 'q1', scheduled_start_at: '2026-09-20T05:00:00Z' }),
      ],
    });
    renderPage();

    expect(await screen.findByText('+992000000001')).toBeInTheDocument();
    expect(screen.getByText('+992000000002')).toBeInTheDocument();
    expect(listQueueDay).toHaveBeenCalledTimes(1);
    expect(listQueueDay.mock.calls[0]![0]).toBe('wp-1');
  });

  it('shows an empty state when the day has no bookings', async () => {
    listQueueDay.mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByText('Нет записей за этот день')).toBeInTheDocument();
  });

  it('shows an error message when loading fails', async () => {
    listQueueDay.mockRejectedValue(new ApiError('internal_error', 'oops', 500));
    renderPage();
    expect(await screen.findByText('Не удалось загрузить историю')).toBeInTheDocument();
  });

  it('refetches for the newly picked date', async () => {
    listQueueDay.mockResolvedValue({ items: [] });
    renderPage();
    await screen.findByText('Нет записей за этот день');

    fireEvent.change(screen.getByLabelText('Дата'), { target: { value: '2026-01-15' } });

    await waitFor(() => expect(listQueueDay.mock.calls.at(-1)![1]).toBe('2026-01-15'));
  });

  it('ignores a transient, not-yet-complete value from typing into the date input', async () => {
    listQueueDay.mockResolvedValue({ items: [] });
    renderPage();
    await screen.findByText('Нет записей за этот день');
    const callsBefore = listQueueDay.mock.calls.length;

    fireEvent.change(screen.getByLabelText('Дата'), { target: { value: '0026-10-12' } });

    expect(listQueueDay.mock.calls.length).toBe(callsBefore);
  });
});
