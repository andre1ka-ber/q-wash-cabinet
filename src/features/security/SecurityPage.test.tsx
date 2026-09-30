import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type User } from 'q-wash-shared';
import { SecurityPage } from './SecurityPage';

const getWashingPointCredentials = vi.fn();
const resetWashingPointCredentials = vi.fn();

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: fakeUser }),
    getWashingPointCredentials: (...a: unknown[]) => getWashingPointCredentials(...a),
    resetWashingPointCredentials: (...a: unknown[]) => resetWashingPointCredentials(...a),
  };
});

const fakeUser: User = { id: 'u1', phone_number: null, name: 'Staff', role: 'staff', washing_point_id: 'wp-1', last_login_at: null };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SecurityPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SecurityPage', () => {
  it('shows the staff and worker usernames', async () => {
    getWashingPointCredentials.mockResolvedValue({ staff: { username: 'pegasus' }, worker: { username: 'pegasus-worker' } });
    renderPage();

    expect(await screen.findByText('pegasus')).toBeInTheDocument();
    expect(screen.getByText('pegasus-worker')).toBeInTheDocument();
    expect(getWashingPointCredentials).toHaveBeenCalledWith('wp-1');
  });

  it('resetting a role reveals the new password once and does not touch the other row', async () => {
    getWashingPointCredentials.mockResolvedValue({ staff: { username: 'pegasus' }, worker: { username: 'pegasus-worker' } });
    resetWashingPointCredentials.mockResolvedValue({ username: 'pegasus-worker', password: 'nEwPass789' });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('pegasus-worker');

    await user.click(screen.getAllByRole('button', { name: 'Сбросить пароль' })[1]!);

    await waitFor(() => expect(resetWashingPointCredentials).toHaveBeenCalledWith('wp-1', 'worker'));
    expect(await screen.findByText('nEwPass789')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Я сохранил(а) данные' }));
    expect(screen.queryByText('nEwPass789')).not.toBeInTheDocument();
  });

  it('shows an error if loading credentials fails', async () => {
    getWashingPointCredentials.mockRejectedValue(new ApiError('internal_error', 'oops', 500));
    renderPage();
    expect(await screen.findByText('Не удалось загрузить учётные данные')).toBeInTheDocument();
  });

  it('shows the API message if a reset fails', async () => {
    getWashingPointCredentials.mockResolvedValue({ staff: { username: 'pegasus' }, worker: { username: 'pegasus-worker' } });
    resetWashingPointCredentials.mockRejectedValue(new ApiError('user_not_found', 'нет аккаунта', 404));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('pegasus');

    await user.click(screen.getAllByRole('button', { name: 'Сбросить пароль' })[0]!);

    expect(await screen.findByText('нет аккаунта')).toBeInTheDocument();
  });
});
