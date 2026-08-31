import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Photo, User, WashingPoint } from 'q-wash-shared';
import { PhotosPage } from './PhotosPage';

const listPhotos = vi.fn();
const deletePhoto = vi.fn();
const updatePhoto = vi.fn();
const uploadPhoto = vi.fn();
const updateWashingPoint = vi.fn();
const getWashingPoint = vi.fn();

vi.mock('q-wash-shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('q-wash-shared')>();
  return {
    ...actual,
    useAuth: () => ({ status: 'authenticated', user: fakeUser }),
    listPhotos: (...args: unknown[]) => listPhotos(...args),
    deletePhoto: (...args: unknown[]) => deletePhoto(...args),
    updatePhoto: (...args: unknown[]) => updatePhoto(...args),
    uploadPhoto: (...args: unknown[]) => uploadPhoto(...args),
    updateWashingPoint: (...args: unknown[]) => updateWashingPoint(...args),
    getWashingPoint: (...args: unknown[]) => getWashingPoint(...args),
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

const fakePoint: WashingPoint = {
  id: 'wp-1',
  owner_id: 'owner-1',
  name: 'Test Point',
  address: 'Test Address',
  latitude: 0,
  longitude: 0,
  boxes_count: 1,
  open_time: '08:00',
  close_time: '20:00',
  status: 'active',
};

const fakePhoto: Photo = { id: 'photo-1', url: '/photos/photo-1.jpg', is_cover: false, sort_order: 0 };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PhotosPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('PhotosPage', () => {
  it('shows a loading indicator while photos are being fetched', async () => {
    listPhotos.mockReturnValue(new Promise(() => {}));
    getWashingPoint.mockResolvedValue(fakePoint);
    renderPage();
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no photos', async () => {
    listPhotos.mockResolvedValue({ items: [] });
    getWashingPoint.mockResolvedValue(fakePoint);
    renderPage();
    expect(await screen.findByText('Пока нет ни одной фотографии')).toBeInTheDocument();
  });

  it('surfaces the API error message when deleting a photo fails', async () => {
    const { ApiError } = await import('q-wash-shared');
    listPhotos.mockResolvedValue({ items: [fakePhoto] });
    getWashingPoint.mockResolvedValue(fakePoint);
    deletePhoto.mockRejectedValue(new ApiError('photo_not_found', 'Фото не найдено', 404));

    renderPage();
    const deleteButton = await screen.findByText('Удалить');
    await userEvent.click(deleteButton);

    await waitFor(() => expect(screen.getByText('Фото не найдено')).toBeInTheDocument());
  });
});
