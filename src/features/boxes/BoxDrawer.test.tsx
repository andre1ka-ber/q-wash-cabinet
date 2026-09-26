import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Box, type User } from 'q-wash-shared';
import { BoxDrawer } from './BoxDrawer';

const createBox = vi.fn();
const updateBox = vi.fn();

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: fakeUser }),
    createBox: (...a: unknown[]) => createBox(...a),
    updateBox: (...a: unknown[]) => updateBox(...a),
  };
});

const fakeUser: User = { id: 'u1', phone_number: '+992000000000', name: 'Staff', role: 'staff', washing_point_id: 'wp-1', last_login_at: null };
const BOX: Box = { id: 'box-1', number: 2, label: 'Подъёмник', is_open: true };

function renderDrawer(box?: Box, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BoxDrawer box={box} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BoxDrawer', () => {
  it('creates a box with a trimmed label', async () => {
    createBox.mockResolvedValue({});
    const user = userEvent.setup();
    const { onClose } = renderDrawer();
    await user.type(screen.getByPlaceholderText('Например, Детейлинг · подъёмник'), '  Детейлинг  ');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(createBox).toHaveBeenCalledWith('wp-1', { label: 'Детейлинг' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('a box can be created without any label', async () => {
    createBox.mockResolvedValue({});
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByRole('button', { name: 'Добавить' }));
    await waitFor(() => expect(createBox).toHaveBeenCalledWith('wp-1', { label: undefined }));
  });

  it('edits only the label of an existing box', async () => {
    updateBox.mockResolvedValue({});
    const user = userEvent.setup();
    renderDrawer(BOX);
    const input = screen.getByDisplayValue('Подъёмник');
    await user.clear(input);
    await user.type(input, 'Новый');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateBox).toHaveBeenCalledWith('wp-1', 'box-1', { label: 'Новый' }));
    expect(createBox).not.toHaveBeenCalled();
  });

  it('shows the API error and stays open', async () => {
    updateBox.mockRejectedValue(new ApiError('invalid_label', 'Слишком длинное название', 400));
    const user = userEvent.setup();
    const { onClose } = renderDrawer(BOX);
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Слишком длинное название')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancel closes without saving', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer(BOX);
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onClose).toHaveBeenCalled();
    expect(updateBox).not.toHaveBeenCalled();
  });
});
