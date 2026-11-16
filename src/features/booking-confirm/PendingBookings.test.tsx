import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueDayItem, User } from 'q-wash-shared';
import { buildDays, toIsoAt } from '../queue/queueModel';
import { PendingBanner, PendingBell, PendingToast } from './PendingParts';
import { PendingBookingsProvider } from './usePendingBookings';

const listQueueDay = vi.fn();
const confirmBooking = vi.fn();
const rejectBooking = vi.fn();
let boardListener: (() => void) | null = null;
let userRole: User['role'] = 'staff';

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: { ...fakeUser, role: userRole } }),
    subscribeToBoardEvents: (_id: string, cb: () => void) => {
      boardListener = cb;
      return () => {};
    },
    listQueueDay: (...a: unknown[]) => listQueueDay(...a),
    confirmBooking: (...a: unknown[]) => confirmBooking(...a),
    rejectBooking: (...a: unknown[]) => rejectBooking(...a),
  };
});

const fakeUser: User = { id: 'u1', phone_number: '+992000000000', name: 'Staff', role: 'staff', washing_point_id: 'wp-1', last_login_at: null };
const today = buildDays(new Date())[0].key;

function pendingItem(id: string, ticket: string): QueueDayItem {
  return {
    id,
    status: 'pending',
    ticket,
    box_number: 1,
    scheduled_start_at: toIsoAt(today, 15 * 60),
    scheduled_end_at: toIsoAt(today, 15 * 60 + 30),
    source: 'app',
    car_name: 'Toyota Camry',
    plate: '1 AB 01',
    client_name: 'Далер',
    client_phone: '+992900000001',
    service_name: 'Экспресс',
    price_option_name: 'Седан',
    price_cents: 12800,
    items: [],
  };
}

function renderAll() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PendingBookingsProvider>
          <PendingBell />
          <PendingToast />
          <PendingBanner />
        </PendingBookingsProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  userRole = 'staff';
  boardListener = null;
  localStorage.clear();
  confirmBooking.mockResolvedValue({});
  rejectBooking.mockResolvedValue({});
  listQueueDay.mockImplementation(async (_wp: string, date: string) => ({ items: date === today ? [pendingItem('b1', 'A-11')] : [] }));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('pending bookings', () => {
  it('shows the unread badge, lists the booking in the bell and confirms it', async () => {
    renderAll();
    const bell = await screen.findByRole('button', { name: 'Уведомления: 1 новых' });
    await userEvent.click(bell);
    expect(await screen.findByText('A-11 · Toyota Camry · Экспресс')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Подтвердить' })[0]);
    await waitFor(() => expect(confirmBooking).toHaveBeenCalledWith('b1'));
  });

  it('rejects from the bell, and closing it marks everything as read', async () => {
    renderAll();
    await userEvent.click(await screen.findByRole('button', { name: 'Уведомления: 1 новых' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отклонить' }));
    await waitFor(() => expect(rejectBooking).toHaveBeenCalledWith('b1'));
    await userEvent.click(screen.getByRole('button', { name: /Уведомления/ }));
    expect(await screen.findByRole('button', { name: 'Уведомления' })).toBeInTheDocument();
  });

  it('does not toast bookings that were already pending at load, but toasts a new one', async () => {
    renderAll();
    await screen.findByRole('button', { name: 'Уведомления: 1 новых' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    listQueueDay.mockImplementation(async (_wp: string, date: string) => ({
      items: date === today ? [pendingItem('b1', 'A-11'), pendingItem('b2', 'A-12')] : [],
    }));
    boardListener?.();
    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Новая запись ждёт подтверждения');
    expect(toast).toHaveTextContent('A-12');
  });

  it('renders nothing for a worker and never loads the days', async () => {
    userRole = 'worker';
    renderAll();
    expect(screen.queryByRole('button', { name: /Уведомления/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/ждут вашего подтверждения|ждёт вашего подтверждения/)).not.toBeInTheDocument();
    expect(listQueueDay).not.toHaveBeenCalled();
  });
});
