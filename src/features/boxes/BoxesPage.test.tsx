import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Box, User } from 'q-wash-shared';
import { BoxesPage } from './BoxesPage';

const listBoxes = vi.fn();
const updateBox = vi.fn();

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: fakeUser }),
    listBoxes: (...args: unknown[]) => listBoxes(...args),
    updateBox: (...args: unknown[]) => updateBox(...args),
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

const fakeBox: Box = { id: 'box-1', number: 1, label: null, is_open: true };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BoxesPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('BoxesPage', () => {
  it('shows an empty-state message when there are no boxes', async () => {
    listBoxes.mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByText('Пока нет ни одного бокса')).toBeInTheDocument();
  });

  it('surfaces the API error message when toggling a box fails', async () => {
    const { ApiError } = await import('q-wash-shared');
    listBoxes.mockResolvedValue({ items: [fakeBox] });
    updateBox.mockRejectedValue(new ApiError('box_not_found', 'Бокс не найден', 404));

    renderPage();
    const closeButton = await screen.findByText('Закрыть');
    await userEvent.click(closeButton);

    await waitFor(() => expect(screen.getByText('Бокс не найден')).toBeInTheDocument());
  });
});
