import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QrCode, User } from 'q-wash-shared';
import { QrCodePage } from './QrCodePage';

const getMyQrCode = vi.fn();
const requestQrCodeReplacement = vi.fn();

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: fakeUser }),
    getMyQrCode: (...args: unknown[]) => getMyQrCode(...args),
    requestQrCodeReplacement: (...args: unknown[]) => requestQrCodeReplacement(...args),
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

const fakeCode: QrCode = {
  id: 'qr-1',
  code: 'QW-0031',
  token: 'abc123',
  status: 'assigned',
  batch_label: 'Партия #2 · 12 авг',
  washing_point_id: 'wp-1',
  washing_point_name: 'Pegasus Detailing',
  assigned_at: '2026-08-12T10:00:00Z',
  disabled_at: null,
  replacement_requested_at: null,
  created_at: '2026-08-10T10:00:00Z',
  stats: {
    scans_today: 38,
    scans_7d: 214,
    bookings_via_qr: 61,
    scans_by_day: [
      { date: '2026-09-18', count: 22 },
      { date: '2026-09-19', count: 28 },
      { date: '2026-09-20', count: 19 },
      { date: '2026-09-21', count: 34 },
      { date: '2026-09-22', count: 41 },
      { date: '2026-09-23', count: 52 },
      { date: '2026-09-24', count: 38 },
    ],
  },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QrCodePage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('QrCodePage', () => {
  it('shows a loading indicator while the code is being fetched', () => {
    getMyQrCode.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
  });

  it('renders the sticker and real stats once loaded', async () => {
    getMyQrCode.mockResolvedValue(fakeCode);
    renderPage();
    expect(await screen.findByText('QW-0031')).toBeInTheDocument();
    expect(screen.getByText('38')).toBeInTheDocument();
    expect(screen.getByText('214')).toBeInTheDocument();
    expect(screen.getByText('61')).toBeInTheDocument();
  });

  it('shows an empty state when no code is assigned yet', async () => {
    const { ApiError } = await import('q-wash-shared');
    getMyQrCode.mockRejectedValue(new ApiError('qr_code_not_found', 'no qr code assigned', 404));
    renderPage();
    expect(await screen.findByText(/ещё не привязал QR-код/)).toBeInTheDocument();
  });

  it('requesting a replacement flips the button to the sent state', async () => {
    getMyQrCode.mockResolvedValue(fakeCode);
    requestQrCodeReplacement.mockResolvedValue({ ...fakeCode, replacement_requested_at: '2026-09-24T12:00:00Z' });
    renderPage();

    const button = await screen.findByText('Запросить замену');
    await userEvent.click(button);

    await waitFor(() => expect(screen.getByText(/Запрос отправлен администратору/)).toBeInTheDocument());
  });
});
