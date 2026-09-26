import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from 'q-wash-shared';
import { LoginPage } from './LoginPage';

const login = vi.fn();

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return { ...actual, authStore: { ...actual.authStore, login: (...a: unknown[]) => login(...a) } };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fill(username: string, password: string) {
  const [user, pass] = [document.querySelector('input[autocomplete="username"]')!, document.querySelector('input[type="password"]')!];
  fireEvent.change(user, { target: { value: username } });
  fireEvent.change(pass, { target: { value: password } });
}

describe('LoginPage', () => {
  it('signs in with the typed username and password', async () => {
    login.mockResolvedValue(undefined);
    render(<LoginPage />);
    fill('staff1', 'secret');
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('staff1', 'secret'));
  });

  it('disables the button and shows progress while signing in', async () => {
    let finish: () => void = () => {};
    login.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    render(<LoginPage />);
    fill('a', 'b');
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    const busy = await screen.findByRole('button', { name: 'Входим…' });
    expect(busy).toBeDisabled();
    finish();
    await screen.findByRole('button', { name: 'Войти' });
  });

  it('shows the API error message, and a generic one for other failures', async () => {
    login.mockRejectedValueOnce(new ApiError('invalid_credentials', 'Неверный логин или пароль', 401));
    render(<LoginPage />);
    fill('a', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Неверный логин или пароль')).toBeInTheDocument();

    login.mockRejectedValueOnce(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Не удалось выполнить запрос')).toBeInTheDocument();
    expect(screen.queryByText('Неверный логин или пароль')).not.toBeInTheDocument();
  });

  it('requires both fields', () => {
    render(<LoginPage />);
    expect(document.querySelector('input[autocomplete="username"]')).toBeRequired();
    expect(document.querySelector('input[type="password"]')).toBeRequired();
  });

  it('names the app', () => {
    render(<LoginPage />);
    expect(screen.getByText('Кабинет мойки')).toBeInTheDocument();
  });
});
