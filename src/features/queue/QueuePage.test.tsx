import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueDayItem, User } from 'q-wash-shared';
import { QueuePage } from './QueuePage';
import { buildDays, toIsoAt } from './queueModel';

const listQueueDay = vi.fn();
const listBoxes = vi.fn();
const getSchedule = vi.fn();
const listServices = vi.fn();
const getAvailability = vi.fn();
const createManualBooking = vi.fn();
const updateBookingStatus = vi.fn();
const cancelBooking = vi.fn();
let mobile = false;

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: fakeUser }),
    useIsMobile: () => mobile,
    subscribeToBoardEvents: () => () => {},
    listQueueDay: (...a: unknown[]) => listQueueDay(...a),
    listBoxes: (...a: unknown[]) => listBoxes(...a),
    getSchedule: (...a: unknown[]) => getSchedule(...a),
    listServices: (...a: unknown[]) => listServices(...a),
    getAvailability: (...a: unknown[]) => getAvailability(...a),
    createManualBooking: (...a: unknown[]) => createManualBooking(...a),
    updateBookingStatus: (...a: unknown[]) => updateBookingStatus(...a),
    cancelBooking: (...a: unknown[]) => cancelBooking(...a),
  };
});

const fakeUser: User = { id: 'u1', phone_number: '+992000000000', name: 'Staff', role: 'staff', washing_point_id: 'wp-1', last_login_at: null };
const days = buildDays(new Date());
const today = days[0].key;
const tomorrow = days[1].key;

function item(over: Partial<QueueDayItem> = {}): QueueDayItem {
  return {
    id: 'b1',
    status: 'queue',
    ticket: 'A-11',
    box_number: 1,
    scheduled_start_at: toIsoAt(today, 10 * 60),
    scheduled_end_at: toIsoAt(today, 10 * 60 + 30),
    source: 'app',
    car_name: 'Toyota Camry',
    plate: '4321 AB 01',
    client_name: 'Далер Р.',
    client_phone: '+992900000001',
    service_name: 'Экспресс',
    price_option_name: 'Седан',
    price_cents: 12800,
    ...over,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QueuePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mobile = false;
  listQueueDay.mockResolvedValue({ items: [item()] });
  listBoxes.mockResolvedValue({
    items: [
      { id: 'bx1', number: 1, label: 'детейлинг', is_open: true },
      { id: 'bx2', number: 2, label: null, is_open: true },
    ],
  });
  getSchedule.mockResolvedValue({ items: [] });
  listServices.mockResolvedValue({
    items: [
      {
        id: 's1',
        washing_point_id: 'wp-1',
        name: 'Экспресс',
        description: null,
        duration_minutes: 30,
        picture_url: null,
        is_active: true,
        price_options: [
          { id: 'p1', name: 'Седан', price_cents: 12800, is_default: true },
          { id: 'p2', name: 'Внедорожник', price_cents: 15800, is_default: false },
        ],
      },
    ],
  });
  getAvailability.mockResolvedValue({
    items: [
      { start: toIsoAt(tomorrow, 10 * 60), end: toIsoAt(tomorrow, 10 * 60 + 30), available_boxes: [1, 2] },
      { start: toIsoAt(tomorrow, 10 * 60 + 15), end: toIsoAt(tomorrow, 10 * 60 + 45), available_boxes: [2] },
    ],
  });
  updateBookingStatus.mockResolvedValue({});
  cancelBooking.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('QueuePage (desktop)', () => {
  it("shows today's bookings per box and opens details on click", async () => {
    renderPage();
    const card = await screen.findByRole('button', { name: 'A-11 Toyota Camry' });
    expect(listQueueDay).toHaveBeenCalledWith('wp-1', today);
    expect(screen.getByText('Бокс 2')).toBeInTheDocument();
    expect(screen.getByText('Выберите запись')).toBeInTheDocument();

    await userEvent.click(card);
    expect(screen.getByText('4321 AB 01')).toBeInTheDocument();
    expect(screen.getByText('128 смн.')).toBeInTheDocument();
    expect(screen.getByText('Записан')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отметить приезд' })).toBeInTheDocument();
  });

  it('marks arrival via the status endpoint', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'A-11 Toyota Camry' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отметить приезд' }));
    await waitFor(() => expect(updateBookingStatus).toHaveBeenCalledWith('b1', 'waiting'));
  });

  it('cancels via the cancel endpoint and restores a no-show to the queue', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'A-11 Toyota Camry' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отменить запись' }));
    await waitFor(() => expect(cancelBooking).toHaveBeenCalledWith('b1'));
  });

  it('offers "Вернуть в очередь" for a no-show', async () => {
    listQueueDay.mockResolvedValue({ items: [item({ status: 'no_show' })] });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'A-11 Toyota Camry' }));
    await userEvent.click(screen.getByRole('button', { name: 'Вернуть в очередь' }));
    await waitFor(() => expect(updateBookingStatus).toHaveBeenCalledWith('b1', 'queue'));
  });

  it('switching to tomorrow refetches that date and drops the arrival action', async () => {
    listQueueDay.mockImplementation(async (_wp: string, date: string) => ({
      items: [item({ scheduled_start_at: toIsoAt(date, 10 * 60), scheduled_end_at: toIsoAt(date, 10 * 60 + 30) })],
    }));
    renderPage();
    await screen.findByRole('button', { name: 'A-11 Toyota Camry' });
    await userEvent.click(screen.getByRole('button', { name: /завтра/ }));
    await waitFor(() => expect(listQueueDay).toHaveBeenCalledWith('wp-1', tomorrow));
    await userEvent.click(await screen.findByRole('button', { name: 'A-11 Toyota Camry' }));
    expect(screen.queryByRole('button', { name: 'Отметить приезд' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отменить запись' })).toBeInTheDocument();
  });

  it('creates a manual booking after validating the phone, then toasts', async () => {
    listQueueDay.mockResolvedValue({ items: [] });
    createManualBooking.mockResolvedValue(item({ id: 'm1', ticket: 'B-11', box_number: 2, source: 'manual' }));
    renderPage();
    await screen.findByText('Выберите запись');
    await userEvent.click(screen.getByRole('button', { name: /завтра/ }));
    await userEvent.click(screen.getByRole('button', { name: '+ Добавить вручную' }));

    await userEvent.click(screen.getByRole('button', { name: 'Бокс 2' }));
    await userEvent.click(await screen.findByRole('button', { name: '10:15' }));
    await userEvent.type(screen.getByLabelText('Марка и модель'), 'Kia K5');
    await userEvent.type(screen.getByLabelText('Госномер'), '5510 AC 01');
    await userEvent.type(screen.getByLabelText('Телефон'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в очередь' }));
    expect(createManualBooking).not.toHaveBeenCalled();
    expect(screen.getByText(/Введите телефон, например/)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Телефон'));
    await userEvent.type(screen.getByLabelText('Телефон'), '90 123 45 67');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в очередь' }));

    await waitFor(() => expect(createManualBooking).toHaveBeenCalledTimes(1));
    expect(createManualBooking).toHaveBeenCalledWith('wp-1', {
      service_id: 's1',
      price_option_id: 'p1',
      box_number: 2,
      scheduled_start_at: toIsoAt(tomorrow, 10 * 60 + 15),
      car_name: 'Kia K5',
      plate: '5510 AC 01',
      client_phone: '90 123 45 67',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Добавлено · B-11');
  });

  it('needs only a phone: car fields are optional and omitted from the request', async () => {
    listQueueDay.mockResolvedValue({ items: [] });
    createManualBooking.mockResolvedValue(item({ id: 'm2', ticket: 'A-12', source: 'manual', car_name: '' }));
    renderPage();
    await screen.findByText('Выберите запись');
    await userEvent.click(screen.getByRole('button', { name: /завтра/ }));
    await userEvent.click(screen.getByRole('button', { name: '+ Добавить вручную' }));
    await userEvent.click(screen.getByRole('button', { name: 'Бокс 2' }));
    await userEvent.click(await screen.findByRole('button', { name: '10:15' }));
    await userEvent.type(screen.getByLabelText('Телефон'), '901234567');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в очередь' }));

    await waitFor(() => expect(createManualBooking).toHaveBeenCalledTimes(1));
    const body = createManualBooking.mock.calls[0][1];
    expect(body.client_phone).toBe('901234567');
    expect(body.car_name).toBeUndefined();
    expect(body.plate).toBeUndefined();
  });

  it('shows the API error when the slot was taken', async () => {
    const { ApiError } = await import('q-wash-shared');
    listQueueDay.mockResolvedValue({ items: [] });
    createManualBooking.mockRejectedValue(new ApiError('slot_unavailable', 'Это время уже занято — выберите другое', 409));
    renderPage();
    await screen.findByText('Выберите запись');
    await userEvent.click(screen.getByRole('button', { name: /завтра/ }));
    await userEvent.click(screen.getByRole('button', { name: '+ Добавить вручную' }));
    await screen.findByRole('button', { name: '10:00' });
    await userEvent.type(screen.getByLabelText('Марка и модель'), 'Kia K5');
    await userEvent.type(screen.getByLabelText('Телефон'), '+992901234567');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить в очередь' }));
    expect(await screen.findByText('Это время уже занято — выберите другое')).toBeInTheDocument();
  });

  it('is view-only and has no add button on a past day', async () => {
    listQueueDay.mockResolvedValue({ items: [item({ status: 'ready' })] });
    renderPage();
    await screen.findByRole('button', { name: 'A-11 Toyota Camry' });
    await userEvent.click(screen.getByRole('button', { name: 'A-11 Toyota Camry' }));
    expect(screen.getByText('Запись завершена')).toBeInTheDocument();
  });
});

describe('QueuePage (mobile)', () => {
  beforeEach(() => {
    mobile = true;
  });

  it('renders the list, filters by box and opens a bottom sheet', async () => {
    listQueueDay.mockResolvedValue({
      items: [item(), item({ id: 'b2', ticket: 'B-11', box_number: 2, car_name: 'Kia K5', scheduled_start_at: toIsoAt(today, 11 * 60), scheduled_end_at: toIsoAt(today, 11 * 60 + 30) })],
    });
    renderPage();
    expect(await screen.findByRole('button', { name: 'A-11 Toyota Camry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B-11 Kia K5' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Бокс 2' }));
    expect(screen.queryByRole('button', { name: 'A-11 Toyota Camry' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'B-11 Kia K5' }));
    const sheet = screen.getByRole('dialog', { name: 'Запись' });
    expect(within(sheet).getByRole('button', { name: 'Отметить приезд' })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the manual form as a sheet from the bottom button', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'A-11 Toyota Camry' });
    await userEvent.click(screen.getByRole('button', { name: '+ Добавить в очередь' }));
    expect(screen.getByRole('dialog', { name: 'Добавить в очередь' })).toBeInTheDocument();
  });
});
