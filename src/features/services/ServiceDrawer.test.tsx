import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Service, type User } from 'q-wash-shared';
import { ServiceDrawer } from './ServiceDrawer';

const createService = vi.fn();
const updateService = vi.fn();
const createPriceOption = vi.fn();
const updatePriceOption = vi.fn();
const deletePriceOption = vi.fn();

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: fakeUser }),
    createService: (...a: unknown[]) => createService(...a),
    updateService: (...a: unknown[]) => updateService(...a),
    createPriceOption: (...a: unknown[]) => createPriceOption(...a),
    updatePriceOption: (...a: unknown[]) => updatePriceOption(...a),
    deletePriceOption: (...a: unknown[]) => deletePriceOption(...a),
  };
});

const fakeUser: User = { id: 'u1', phone_number: '+992000000000', name: 'Staff', role: 'staff', washing_point_id: 'wp-1', last_login_at: null };

const SERVICE: Service = {
  id: 'svc-1',
  washing_point_id: 'wp-1',
  name: 'Экспресс',
  description: 'Быстрая мойка',
  duration_minutes: 30,
  picture_url: null,
  is_active: true,
  price_options: [
    { id: 'po-sedan', name: 'Седан', price_cents: 10000, is_default: true },
    { id: 'po-suv', name: 'Внедорожник', price_cents: 15000, is_default: false },
  ],
};

function renderDrawer(service?: Service, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ServiceDrawer service={service} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

function resolveAll() {
  createService.mockResolvedValue({});
  updateService.mockResolvedValue({});
  createPriceOption.mockResolvedValue({});
  updatePriceOption.mockResolvedValue({});
  deletePriceOption.mockResolvedValue(undefined);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ServiceDrawer — creating', () => {
  it('sends the service with prices converted from whole сомони to cents', async () => {
    resolveAll();
    const user = userEvent.setup();
    const { onClose } = renderDrawer();
    await user.type(screen.getByPlaceholderText('Например, Комплексная мойка'), '  Детейлинг  ');
    await user.type(screen.getByPlaceholderText('Что входит в услугу'), 'Полная мойка');
    const duration = screen.getByDisplayValue('30');
    await user.clear(duration);
    await user.type(duration, '90');
    await user.type(screen.getByPlaceholderText('Седан'), 'Седан');
    await user.type(screen.getByPlaceholderText('смн.'), '198.5');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(createService).toHaveBeenCalledTimes(1));
    expect(createService).toHaveBeenCalledWith('wp-1', {
      name: 'Детейлинг',
      description: 'Полная мойка',
      duration_minutes: 90,
      price_options: [{ name: 'Седан', price_cents: 19850, is_default: true }],
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('adds price rows, and the default follows the radio (removing the default promotes the first row)', async () => {
    resolveAll();
    const user = userEvent.setup();
    renderDrawer();
    await user.type(screen.getByPlaceholderText('Например, Комплексная мойка'), 'S');
    await user.type(screen.getByPlaceholderText('Седан'), 'A');
    await user.type(screen.getByPlaceholderText('смн.'), '1');

    await user.click(screen.getByRole('button', { name: '+ Добавить вариант' }));
    const names = screen.getAllByPlaceholderText('Седан');
    const prices = screen.getAllByPlaceholderText('смн.');
    await user.type(names[1]!, 'B');
    await user.type(prices[1]!, '2');
    await user.click(screen.getAllByTitle('Вариант по умолчанию')[1]!); // B becomes default

    await user.click(screen.getByRole('button', { name: 'Добавить' }));
    await waitFor(() => expect(createService).toHaveBeenCalled());
    expect(createService.mock.calls[0]![1].price_options).toEqual([
      { name: 'A', price_cents: 100, is_default: false },
      { name: 'B', price_cents: 200, is_default: true },
    ]);
  });

  it('removing the default row hands the default to the first remaining one; the last row cannot be removed', async () => {
    resolveAll();
    const user = userEvent.setup();
    renderDrawer();
    await user.type(screen.getByPlaceholderText('Например, Комплексная мойка'), 'S');
    await user.click(screen.getByRole('button', { name: '+ Добавить вариант' }));
    const [n0, n1] = screen.getAllByPlaceholderText('Седан');
    const [p0, p1] = screen.getAllByPlaceholderText('смн.');
    await user.type(n0!, 'A');
    await user.type(p0!, '1');
    await user.type(n1!, 'B');
    await user.type(p1!, '2');

    // header close is the first ✕, then one per price row
    await user.click(screen.getAllByText('✕')[1]!); // remove row A (the default)
    expect(screen.getAllByPlaceholderText('Седан')).toHaveLength(1);
    await user.click(screen.getAllByText('✕')[1]!); // the last row: ignored
    expect(screen.getAllByPlaceholderText('Седан')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Добавить' }));
    await waitFor(() => expect(createService).toHaveBeenCalled());
    expect(createService.mock.calls[0]![1].price_options).toEqual([{ name: 'B', price_cents: 200, is_default: true }]);
  });

  it('requires a name and a price for every variant before sending', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.type(screen.getByPlaceholderText('Например, Комплексная мойка'), 'S');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(await screen.findByText('Заполните название и цену для каждого варианта')).toBeInTheDocument();
    expect(createService).not.toHaveBeenCalled();
  });

  it('shows the API error and stays open', async () => {
    createService.mockRejectedValue(new ApiError('invalid_name', 'Название слишком длинное', 400));
    const user = userEvent.setup();
    const { onClose } = renderDrawer();
    await user.type(screen.getByPlaceholderText('Например, Комплексная мойка'), 'S');
    await user.type(screen.getByPlaceholderText('Седан'), 'A');
    await user.type(screen.getByPlaceholderText('смн.'), '1');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(await screen.findByText('Название слишком длинное')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ServiceDrawer — editing', () => {
  it('starts from the service, and saving an unchanged form only updates the service itself', async () => {
    resolveAll();
    const user = userEvent.setup();
    renderDrawer(SERVICE);
    expect(screen.getByDisplayValue('Экспресс')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Седан')).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument(); // 10000 cents shown as whole сомони
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updateService).toHaveBeenCalledTimes(1));
    expect(updateService).toHaveBeenCalledWith('svc-1', { name: 'Экспресс', description: 'Быстрая мойка', duration_minutes: 30, is_active: true });
    expect(createPriceOption).not.toHaveBeenCalled();
    expect(updatePriceOption).not.toHaveBeenCalled();
    expect(deletePriceOption).not.toHaveBeenCalled();
  });

  it('patches only the price options that changed', async () => {
    resolveAll();
    const user = userEvent.setup();
    renderDrawer(SERVICE);
    const price = screen.getByDisplayValue('150');
    await user.clear(price);
    await user.type(price, '175');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updatePriceOption).toHaveBeenCalledTimes(1));
    expect(updatePriceOption).toHaveBeenCalledWith('po-suv', { price_cents: 17500 });
    expect(deletePriceOption).not.toHaveBeenCalled();
  });

  it('making another row the default sends is_default:true for it, and never false for the old one', async () => {
    resolveAll();
    const user = userEvent.setup();
    renderDrawer(SERVICE);
    await user.click(screen.getAllByTitle('Вариант по умолчанию')[1]!);
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(updatePriceOption).toHaveBeenCalledTimes(1));
    expect(updatePriceOption).toHaveBeenCalledWith('po-suv', { is_default: true });
  });

  it('deletes removed options before creating new ones, so the "last option" rule is never hit', async () => {
    const order: string[] = [];
    resolveAll();
    deletePriceOption.mockImplementation(async (id: string) => void order.push(`delete ${id}`));
    createPriceOption.mockImplementation(async (_s: string, body: { name: string }) => void order.push(`create ${body.name}`));

    const user = userEvent.setup();
    renderDrawer({ ...SERVICE, price_options: [SERVICE.price_options[0]!] });
    // replace the only option: add "Минивэн" then remove "Седан"
    await user.click(screen.getByRole('button', { name: '+ Добавить вариант' }));
    const [, nameNew] = screen.getAllByPlaceholderText('Седан');
    const [, priceNew] = screen.getAllByPlaceholderText('смн.');
    await user.type(nameNew!, 'Минивэн');
    await user.type(priceNew!, '300');
    await user.click(screen.getAllByText('✕')[1]!); // remove the original (first price row)
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(order).toHaveLength(2));
    expect(order).toEqual(['delete po-sedan', 'create Минивэн']);
    expect(createPriceOption).toHaveBeenCalledWith('svc-1', { name: 'Минивэн', price_cents: 30000, is_default: true });
  });

  it('can deactivate the service', async () => {
    resolveAll();
    const user = userEvent.setup();
    renderDrawer(SERVICE);
    await user.click(screen.getByText('Услуга активна'));
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(updateService).toHaveBeenCalled());
    expect(updateService.mock.calls[0]![1].is_active).toBe(false);
  });

  it('stops at the first failing call and shows its message', async () => {
    resolveAll();
    deletePriceOption.mockRejectedValue(new ApiError('price_option_in_use', 'Вариант уже используется в записях', 409));
    const user = userEvent.setup();
    const { onClose } = renderDrawer(SERVICE);
    await user.click(screen.getAllByText('✕')[2]!); // remove Внедорожник
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Вариант уже используется в записях')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
