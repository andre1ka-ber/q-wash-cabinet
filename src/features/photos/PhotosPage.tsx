import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  color,
  radius,
  ApiError,
  resolveApiAssetUrl,
  listPhotos,
  uploadPhoto,
  updatePhoto,
  deletePhoto,
  updateWashingPoint,
  GhostButton,
  PrimaryButton,
  type Photo,
} from 'q-wash-shared';
import { useMyWashingPoint, useMyWashingPointId } from '../../shared/useMyWashingPoint';

// Suggested tags from the mock ("Car Wash Web Apps.dc.html") — amenities is
// a free-text Postgres array on the backend (PLAN_WEB_APPS.md), not a
// lookup table, so staff can also add their own via the input below.
const SUGGESTED_AMENITIES = ['Зона ожидания', 'Кофе', 'Wi-Fi', 'Кулер с водой', 'Детская зона', 'Оплата картой'];

function PhotoTile({ photo, washingPointId }: { photo: Photo; washingPointId: string }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cabinet', 'photos', washingPointId] });

  const coverMutation = useMutation({
    mutationFn: () => updatePhoto(washingPointId, photo.id, { is_cover: true }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deletePhoto(washingPointId, photo.id),
    onSuccess: invalidate,
  });

  return (
    <div
      style={{
        borderRadius: radius.lg,
        overflow: 'hidden',
        border: `1px solid ${photo.is_cover ? color.gold : color.border}`,
        background: color.panel,
      }}
    >
      <div style={{ aspectRatio: '4 / 3', background: color.input, position: 'relative' }}>
        <img
          src={resolveApiAssetUrl(photo.url)}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {photo.is_cover && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              padding: '3px 8px',
              borderRadius: radius.sm,
              background: color.gold,
              color: color.goldOnLight,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Обложка
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: 8 }}>
        {!photo.is_cover && (
          <GhostButton
            type="button"
            onClick={() => coverMutation.mutate()}
            disabled={coverMutation.isPending}
            style={{ flex: 1, padding: '7px 8px', fontSize: 11 }}
          >
            Сделать обложкой
          </GhostButton>
        )}
        <GhostButton
          type="button"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          style={{ flex: photo.is_cover ? 1 : undefined, padding: '7px 8px', fontSize: 11, color: color.bad }}
        >
          Удалить
        </GhostButton>
      </div>
    </div>
  );
}

export function PhotosPage() {
  const washingPointId = useMyWashingPointId();
  const pointQuery = useMyWashingPoint();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photosQuery = useQuery({
    queryKey: ['cabinet', 'photos', washingPointId],
    queryFn: () => listPhotos(washingPointId),
  });

  const [description, setDescription] = useState<string | null>(null);
  const [amenities, setAmenities] = useState<string[] | null>(null);
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pointQuery.data && description === null && amenities === null) {
      setDescription(pointQuery.data.description ?? '');
      setAmenities(pointQuery.data.amenities ?? []);
    }
  }, [pointQuery.data, description, amenities]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadPhoto(washingPointId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cabinet', 'photos', washingPointId] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить фото'),
  });

  const saveMutation = useMutation({
    mutationFn: () => updateWashingPoint(washingPointId, { description: description ?? '', amenities: amenities ?? [] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cabinet', 'washing-point', washingPointId] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось сохранить'),
  });

  function toggleAmenity(tag: string) {
    setAmenities((prev) => {
      const list = prev ?? [];
      return list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag];
    });
  }

  function addCustomTag() {
    const tag = newTag.trim();
    if (!tag) return;
    setAmenities((prev) => (prev && !prev.includes(tag) ? [...prev, tag] : prev));
    setNewTag('');
  }

  const photos = photosQuery.data?.items ?? [];
  const customAmenities = (amenities ?? []).filter((a) => !SUGGESTED_AMENITIES.includes(a));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 700, marginBottom: 14 }}>Фото</div>
        {photosQuery.isError && (
          <div style={{ color: color.bad, fontSize: 13, marginBottom: 10 }}>Не удалось загрузить фотографии</div>
        )}
        {error && <div style={{ color: color.bad, fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {photos.map((photo) => (
            <PhotoTile key={photo.id} photo={photo} washingPointId={washingPointId} />
          ))}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              aspectRatio: '4 / 3',
              borderRadius: radius.lg,
              border: `1px dashed ${color.borderDashed}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 6,
              cursor: uploadMutation.isPending ? 'default' : 'pointer',
              color: color.textFaint,
              fontSize: 13,
              opacity: uploadMutation.isPending ? 0.6 : 1,
            }}
          >
            <span style={{ fontSize: 22 }}>+</span>
            {uploadMutation.isPending ? 'Загружаем…' : 'Ещё фото'}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) {
                setError(null);
                uploadMutation.mutate(file);
              }
            }}
          />
        </div>
      </div>

      <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 700 }}>Описание</div>
          <PrimaryButton onClick={() => saveMutation.mutate()} disabled={description === null || saveMutation.isPending}>
            {saveMutation.isPending ? 'Сохраняем…' : 'Сохранить'}
          </PrimaryButton>
        </div>

        <textarea
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Расскажите о мойке: чем вы отличаетесь, какое оборудование используете"
          style={{
            padding: '14px 16px',
            borderRadius: radius.lg,
            background: color.input,
            border: `1px solid ${color.borderStrong}`,
            color: color.textSecondary,
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            resize: 'vertical',
            minHeight: 110,
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: color.textMuted, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' as const }}>
            Удобства
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[...SUGGESTED_AMENITIES, ...customAmenities].map((tag) => {
              const selected = (amenities ?? []).includes(tag);
              return (
                <div
                  key={tag}
                  onClick={() => toggleAmenity(tag)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: radius.pill,
                    border: `1px solid ${selected ? color.gold : color.borderStrong}`,
                    background: selected ? color.warnBg : 'transparent',
                    color: selected ? color.warn : color.textMuted,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {tag}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder="Своё удобство"
              style={{
                padding: '9px 12px',
                borderRadius: radius.md,
                background: color.input,
                border: `1px solid ${color.borderStrong}`,
                color: color.textSecondary,
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                width: 200,
              }}
            />
            <GhostButton type="button" onClick={addCustomTag} style={{ padding: '9px 16px', fontSize: 13 }}>
              Добавить
            </GhostButton>
          </div>
        </div>
      </div>
    </div>
  );
}
