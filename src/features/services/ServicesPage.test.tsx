import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Service, User } from 'q-wash-shared';
import { ServicesPage } from './ServicesPage';

const listServices = vi.fn();
const updateService = vi.fn();
let mobile = false;

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useIsMobile: () => mobile,
    useAuth: () => ({ status: 'authenticated', user: fakeUser }),
    listServices: (...args: unknown[]) => listServices(...args),
    updateService: (...args: unknown[]) => updateService(...args),
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

const fakeService: Service = {
  id: 'service-1',
  washing_point_id: 'wp-1',
  name: 'Мойка кузова',
  description: null,
  duration_minutes: 30,
  queue_minutes: null,
  picture_url: null,
  is_active: true,
  price_options: [],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ServicesPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  mobile = false;
  vi.clearAllMocks();
});

describe('ServicesPage — mobile', () => {
  it('shows price tiles per service and a dashed add button instead of the page header', async () => {
    mobile = true;
    listServices.mockResolvedValue({
      items: [
        {
          ...fakeService,
          price_options: [
            { id: 'p1', name: 'Седан', price_cents: 12800, is_default: true },
            { id: 'p2', name: 'SUV', price_cents: 15800, is_default: false },
          ],
        },
      ],
    });
    renderPage();

    expect(await screen.findByText('Мойка кузова')).toBeInTheDocument();
    expect(screen.getByText('Седан')).toBeInTheDocument();
    expect(screen.getByText('SUV')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Добавить услугу' })).toBeInTheDocument();
    expect(screen.queryByText('Изменить')).not.toBeInTheDocument();
  });

  it('tapping a card opens the editor', async () => {
    mobile = true;
    listServices.mockResolvedValue({ items: [fakeService] });
    renderPage();
    await userEvent.click(await screen.findByText('Мойка кузова'));
    expect(await screen.findByRole('button', { name: /Сохранить|Создать/ })).toBeInTheDocument();
  });
});

describe('ServicesPage', () => {
  it('shows an empty-state message when there are no services', async () => {
    listServices.mockResolvedValue({ items: [] });
    renderPage();
    expect(await screen.findByText('Пока нет ни одной услуги')).toBeInTheDocument();
  });

  it('surfaces the API error message when toggling a service fails', async () => {
    const { ApiError } = await import('q-wash-shared');
    listServices.mockResolvedValue({ items: [fakeService] });
    updateService.mockRejectedValue(new ApiError('forbidden', 'Недостаточно прав для этого действия', 403));

    renderPage();
    const toggle = await screen.findByRole('switch');
    await userEvent.click(toggle);

    await waitFor(() => expect(screen.getByText('Недостаточно прав для этого действия')).toBeInTheDocument());
  });
});
