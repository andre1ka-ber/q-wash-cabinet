import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User, WashingPoint } from 'q-wash-shared';
import { SettingsPage } from './SettingsPage';

const getWashingPoint = vi.fn();
const updateWashingPoint = vi.fn();
let userRole: User['role'] = 'staff';

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: { ...fakeUser, role: userRole } }),
    getWashingPoint: (...a: unknown[]) => getWashingPoint(...a),
    updateWashingPoint: (...a: unknown[]) => updateWashingPoint(...a),
  };
});

const fakeUser: User = { id: 'u1', phone_number: '+992000000000', name: 'Staff', role: 'staff', washing_point_id: 'wp-1', last_login_at: null };
const point = (require_confirmation: boolean) => ({ id: 'wp-1', name: 'Pegasus', status: 'active', require_confirmation }) as WashingPoint;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  userRole = 'staff';
  getWashingPoint.mockResolvedValue(point(false));
  updateWashingPoint.mockResolvedValue(point(true));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SettingsPage', () => {
  it('shows the instant-confirmation copy and turns manual confirmation on', async () => {
    renderPage();
    const toggle = await screen.findByRole('switch');
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText(/«Вы записаны» — талон и место в очереди сразу/)).toBeInTheDocument();
    await userEvent.click(toggle);
    await waitFor(() => expect(updateWashingPoint).toHaveBeenCalledWith('wp-1', { require_confirmation: true }));
  });

  it('reflects an enabled setting', async () => {
    getWashingPoint.mockResolvedValue(point(true));
    renderPage();
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByText(/ожидайте подтверждения мойки/)).toBeInTheDocument();
  });

  it('is read-only for a worker', async () => {
    userRole = 'worker';
    renderPage();
    await screen.findByText(/Настройку может менять только администратор мойки/);
    await userEvent.click(screen.getByRole('switch'));
    expect(updateWashingPoint).not.toHaveBeenCalled();
  });
});
