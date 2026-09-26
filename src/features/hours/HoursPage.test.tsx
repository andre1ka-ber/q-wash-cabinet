import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ScheduleRow, type User } from 'q-wash-shared';
import { HoursPage } from './HoursPage';

const getSchedule = vi.fn();
const replaceSchedule = vi.fn();
let mobile = false;

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: fakeUser }),
    useIsMobile: () => mobile,
    getSchedule: (...a: unknown[]) => getSchedule(...a),
    replaceSchedule: (...a: unknown[]) => replaceSchedule(...a),
  };
});

const fakeUser: User = { id: 'u1', phone_number: '+992000000000', name: 'Staff', role: 'staff', washing_point_id: 'wp-1', last_login_at: null };

// Mon-Fri 09:00-18:00, Saturday 10:00-14:00 with a 12:00-12:30 break, Sunday closed.
function week(): ScheduleRow[] {
  return [
    ...[0, 1, 2, 3, 4].map((weekday) => ({ weekday, is_open: true, open_time: '09:00', close_time: '18:00' })),
    { weekday: 5, is_open: true, open_time: '10:00', close_time: '14:00', break_start: '12:00', break_end: '12:30' },
    { weekday: 6, is_open: false },
  ];
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HoursPage />
    </QueryClientProvider>,
  );
}

// Desktop layout: the label sits directly inside its day's grid row.
const dayRow = (label: string) => screen.getByText(label).parentElement!;

beforeEach(() => {
  mobile = false;
  getSchedule.mockResolvedValue({ items: week() });
  replaceSchedule.mockImplementation((_id: string, rows: ScheduleRow[]) => Promise.resolve({ items: rows }));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function loaded() {
  await screen.findByText('Понедельник');
}

describe('HoursPage', () => {
  it('shows every weekday, with closed days marked as days off', async () => {
    renderPage();
    await loaded();
    for (const d of ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']) {
      expect(screen.getByText(d)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Выходной')).toHaveLength(1);
    expect(screen.getAllByRole('switch').map((s) => s.getAttribute('aria-checked'))).toEqual(['true', 'true', 'true', 'true', 'true', 'true', 'false']);
  });

  it('rows arrive in weekday order even if the API returns them shuffled', async () => {
    getSchedule.mockResolvedValue({ items: [...week()].reverse() });
    renderPage();
    await loaded();
    const labels = screen.getAllByText(/^(Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье)$/).map((e) => e.textContent);
    expect(labels[0]).toBe('Понедельник');
    expect(labels[6]).toBe('Воскресенье');
  });

  it('opening a closed day gives it the default 08:00-20:00, and closing one turns it into a day off', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    const switches = screen.getAllByRole('switch');

    await user.click(switches[6]!); // Sunday on
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(replaceSchedule).toHaveBeenCalled());
    const sent = replaceSchedule.mock.calls[0]![1] as ScheduleRow[];
    expect(sent[6]).toMatchObject({ weekday: 6, is_open: true, open_time: '08:00', close_time: '20:00' });

    await user.click(switches[0]!); // Monday off
    expect(screen.getAllByText('Выходной')).toHaveLength(1);
  });

  it('saves the edited draft for the whole week in one request', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    const monday = screen.getAllByRole('combobox').slice(0, 4);
    await user.selectOptions(monday[0]!, '08'); // open hour 09 -> 08
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(replaceSchedule).toHaveBeenCalledTimes(1));
    const [pointId, rows] = replaceSchedule.mock.calls[0] as [string, ScheduleRow[]];
    expect(pointId).toBe('wp-1');
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({ weekday: 0, open_time: '08:00', close_time: '18:00' });
    expect(rows[5]).toMatchObject({ break_start: '12:00', break_end: '12:30' });
  });

  it('adds and removes a break for a day', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    const mondayBreak = within(dayRow('Понедельник')).getByText('Перерыв');
    await user.click(mondayBreak);
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(replaceSchedule).toHaveBeenCalledTimes(1));
    expect((replaceSchedule.mock.calls[0]![1] as ScheduleRow[])[0]).toMatchObject({ break_start: '13:00', break_end: '14:00' });

    await user.click(within(dayRow('Суббота')).getByText('Перерыв')); // remove Saturday's break
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(replaceSchedule).toHaveBeenCalledTimes(2));
    expect((replaceSchedule.mock.calls[1]![1] as ScheduleRow[])[5]).toMatchObject({ break_start: null, break_end: null });
  });

  describe('validation happens before anything is sent', () => {
    it('closing time must be after opening time', async () => {
      const user = userEvent.setup();
      renderPage();
      await loaded();
      const monday = screen.getAllByRole('combobox').slice(0, 4);
      await user.selectOptions(monday[2]!, '08'); // close hour 18 -> 08 (before the 09:00 open)
      await user.click(screen.getByRole('button', { name: 'Сохранить' }));

      expect(await screen.findByText('Понедельник: время закрытия должно быть позже времени открытия')).toBeInTheDocument();
      expect(replaceSchedule).not.toHaveBeenCalled();
    });

    it('a break must end after it starts', async () => {
      const user = userEvent.setup();
      renderPage();
      await loaded();
      const saturday = within(dayRow('Суббота')).getAllByRole('combobox'); // open h/m, close h/m, break h/m x2
      await user.selectOptions(saturday[4]!, '13'); // break start 13:00 > break end 12:30
      await user.click(screen.getByRole('button', { name: 'Сохранить' }));

      expect(await screen.findByText('Суббота: конец перерыва должен быть позже начала')).toBeInTheDocument();
      expect(replaceSchedule).not.toHaveBeenCalled();
    });

    it('a break must sit inside the working hours', async () => {
      const user = userEvent.setup();
      renderPage();
      await loaded();
      const saturday = within(dayRow('Суббота')).getAllByRole('combobox');
      await user.selectOptions(saturday[6]!, '15'); // break end 15:30 after the 14:00 close
      await user.click(screen.getByRole('button', { name: 'Сохранить' }));

      expect(await screen.findByText('Суббота: перерыв должен быть внутри рабочих часов')).toBeInTheDocument();
      expect(replaceSchedule).not.toHaveBeenCalled();
    });
  });

  it('shows the API message when saving fails, and can save again afterwards', async () => {
    replaceSchedule.mockRejectedValueOnce(new ApiError('invalid_break', 'Некорректный перерыв', 400));
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Некорректный перерыв')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(replaceSchedule).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('Некорректный перерыв')).not.toBeInTheDocument());
  });

  it('shows an error when the schedule cannot be loaded, and Save stays disabled', async () => {
    getSchedule.mockRejectedValue(new ApiError('boom', 'down', 500));
    renderPage();
    expect(await screen.findByText('Не удалось загрузить расписание')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  });

  it('lays out one card per day on mobile', async () => {
    mobile = true;
    renderPage();
    await loaded();
    expect(screen.getAllByRole('switch')).toHaveLength(7);
    expect(screen.getAllByText('Выходной')).toHaveLength(1);
  });
});
