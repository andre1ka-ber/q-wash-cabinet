import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User, WashingPoint } from 'q-wash-shared';
import { MobileHeader } from './MobileHeader';

const updateWashingPoint = vi.fn();
const listQueueDay = vi.fn();

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: fakeUser }),
    subscribeToBoardEvents: () => () => {},
    updateWashingPoint: (...a: unknown[]) => updateWashingPoint(...a),
    listQueueDay: (...a: unknown[]) => listQueueDay(...a),
  };
});

const fakeUser: User = { id: 'u1', phone_number: '+992000000000', name: 'Farrukh', role: 'staff', washing_point_id: 'wp-1', last_login_at: null };
const point = (status: WashingPoint['status']): WashingPoint =>
  ({ id: 'wp-1', name: 'Pegasus Detailing', address: 'ул. Рудаки, 84', status }) as WashingPoint;

function renderHeader(p: WashingPoint | undefined, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <MobileHeader point={p} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  updateWashingPoint.mockResolvedValue({});
  listQueueDay.mockResolvedValue({
    items: [{ status: 'queue' }, { status: 'waiting' }, { status: 'washing' }, { status: 'ready' }, { status: 'canceled' }],
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MobileHeader', () => {
  it('shows the current page title over the point name', () => {
    renderHeader(point('active'), '/services');
    expect(screen.getByText('Услуги и цены')).toBeInTheDocument();
    expect(screen.getByText('Pegasus Detailing')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('the pill pauses an active point, and resumes a paused one', async () => {
    const user = userEvent.setup();
    renderHeader(point('active'));
    await user.click(screen.getByText('● Приём'));
    expect(updateWashingPoint).toHaveBeenCalledWith('wp-1', { status: 'paused' });

    cleanup();
    renderHeader(point('paused'));
    await user.click(screen.getByText('○ Стоп'));
    expect(updateWashingPoint).toHaveBeenLastCalledWith('wp-1', { status: 'active' });
  });

  it('a point under review cannot be toggled', () => {
    renderHeader(point('pending_review'));
    expect(screen.getByText('На проверке')).toBeInTheDocument();
    expect(screen.queryByText('● Приём')).not.toBeInTheDocument();
    expect(screen.queryByText('○ Стоп')).not.toBeInTheDocument();
  });

  it('the drawer lists the sections with today\'s not-yet-started count on Очередь, and closes on navigation', async () => {
    const user = userEvent.setup();
    renderHeader(point('active'));

    await user.click(screen.getByLabelText('Меню'));
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveTextContent('Очередь');
    expect(nav).toHaveTextContent('Услуги и цены');
    expect(nav).toHaveTextContent('QR-код');
    expect(screen.getByText('Профиль · Farrukh')).toBeInTheDocument();
    // queue + waiting only: washing/ready/canceled are already past "not started"
    await waitFor(() => expect(nav).toHaveTextContent('Очередь2'));

    await user.click(screen.getByText('Боксы'));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByText('Боксы')).toBeInTheDocument();
  });

  it('logging out from the drawer asks for confirmation first', async () => {
    const user = userEvent.setup();
    renderHeader(point('active'));
    await user.click(screen.getByLabelText('Меню'));
    await user.click(screen.getByText('Выйти'));
    expect(screen.getByText('Выйти из аккаунта?')).toBeInTheDocument();
  });
});
