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
  useIsMobile,
  type Photo,
} from 'q-wash-shared';
import { useMyWashingPoint, useMyWashingPointId } from '../../shared/useMyWashingPoint';
import { StickyBar, StickyButton } from '../../shared/layout/StickyBar';

// Suggested tags from the mock ("Car Wash Web Apps.dc.html") — amenities is
// a free-text Postgres array on the backend (PLAN_WEB_APPS.md), not a
// lookup table, so staff can also add their own via the input below.
const SUGGESTED_AMENITIES = ['Зона ожидания', 'Кофе', 'Wi-Fi', 'Кулер с водой', 'Детская зона', 'Оплата картой'];

function usePhotoMutations(photo: Photo, washingPointId: string, onError: (message: string) => void) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cabinet', 'photos', washingPointId] });

  const coverMutation = useMutation({
    mutationFn: () => updatePhoto(washingPointId, photo.id, { is_cover: true }),
    onSuccess: invalidate,
    onError: (err) => onError(err instanceof ApiError ? err.message : 'Не удалось сделать фото обложкой'),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deletePhoto(washingPointId, photo.id),
    onSuccess: invalidate,
    onError: (err) => onError(err instanceof ApiError ? err.message : 'Не удалось удалить фото'),
  });
  return { coverMutation, deleteMutation };
}

const cornerButton = {
  width: 24,
  height: 24,
  padding: 0,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(18,18,17,.82)',
  color: color.textPrimaryAlt,
  fontSize: 13,
  lineHeight: '24px',
  textAlign: 'center' as const,
  cursor: 'pointer',
};

// Mobile tile (design: a big cover plus a 3-column grid of square photos).
// Cover/delete live as small corner buttons instead of a button row.
function MobilePhotoTile({
  photo,
  washingPointId,
  hero,
  onError,
}: {
  photo: Photo;
  washingPointId: string;
  hero: boolean;
  onError: (message: string) => void;
}) {
  const { coverMutation, deleteMutation } = usePhotoMutations(photo, washingPointId, onError);
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: hero ? 18 : 14,
        border: `1px solid ${color.borderAlt}`,
        background: color.input,
        ...(hero ? { height: 180 } : { aspectRatio: '1' }),
      }}
    >
      <img src={resolveApiAssetUrl(photo.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {hero && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            padding: '5px 10px',
            borderRadius: 9,
            background: color.gold,
            color: color.goldOnLight,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          обложка
        </div>
      )}
      <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 6 }}>
        {!photo.is_cover && (
          <button
            type="button"
            aria-label="Сделать обложкой"
            disabled={coverMutation.isPending}
            onClick={() => coverMutation.mutate()}
            style={cornerButton}
          >
            ★
          </button>
        )}
        <button
          type="button"
          aria-label="Удалить фото"
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
          style={cornerButton}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function PhotoTile({
  photo,
  washingPointId,
  onError,
}: {
  photo: Photo;
  washingPointId: string;
  onError: (message: string) => void;
}) {
  const { coverMutation, deleteMutation } = usePhotoMutations(photo, washingPointId, onError);

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
  const isMobile = useIsMobile();
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

  const cover = photos.find((p) => p.is_cover) ?? photos[0];
  const gridPhotos = photos.filter((p) => p !== cover);

  const addInput = (
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
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 32 }}>
      <div>
        {!isMobile && <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 700, marginBottom: 14 }}>Фото</div>}
        {photosQuery.isError && (
          <div style={{ color: color.bad, fontSize: 13, marginBottom: 10 }}>Не удалось загрузить фотографии</div>
        )}
        {error && <div style={{ color: color.bad, fontSize: 13, marginBottom: 10 }}>{error}</div>}
        {photosQuery.isLoading ? (
          <div style={{ padding: 20, color: color.textFaint, fontSize: 13 }}>Загрузка…</div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {cover ? (
              <MobilePhotoTile photo={cover} washingPointId={washingPointId} hero onError={setError} />
            ) : (
              <div style={{ color: color.textFaint, fontSize: 13 }}>Пока нет ни одной фотографии</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {gridPhotos.map((photo) => (
                <MobilePhotoTile key={photo.id} photo={photo} washingPointId={washingPointId} hero={false} onError={setError} />
              ))}
              <div
                role="button"
                aria-label="Добавить фото"
                onClick={() => !uploadMutation.isPending && fileInputRef.current?.click()}
                style={{
                  aspectRatio: '1',
                  borderRadius: 14,
                  border: `1px dashed ${color.borderDashed}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: color.textTertiary,
                  fontSize: uploadMutation.isPending ? 11 : 20,
                  cursor: uploadMutation.isPending ? 'default' : 'pointer',
                  opacity: uploadMutation.isPending ? 0.6 : 1,
                }}
              >
                {uploadMutation.isPending ? 'Загрузка…' : '+'}
              </div>
            </div>
            {addInput}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {photos.length === 0 && (
              <div style={{ gridColumn: '1 / -1', color: color.textFaint, fontSize: 13 }}>Пока нет ни одной фотографии</div>
            )}
            {photos.map((photo) => (
              <PhotoTile key={photo.id} photo={photo} washingPointId={washingPointId} onError={setError} />
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
            {addInput}
          </div>
        )}
      </div>

      <div style={{ maxWidth: isMobile ? undefined : 760, display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 20 }}>
        {isMobile ? (
          <div style={{ color: color.textTertiary, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' as const }}>
            Описание
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 700 }}>Описание</div>
            <PrimaryButton onClick={() => saveMutation.mutate()} disabled={description === null || saveMutation.isPending}>
              {saveMutation.isPending ? 'Сохраняем…' : 'Сохранить'}
            </PrimaryButton>
          </div>
        )}

        <textarea
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Расскажите о мойке: чем вы отличаетесь, какое оборудование используете"
          style={{
            padding: isMobile ? '13px 14px' : '14px 16px',
            borderRadius: isMobile ? 14 : radius.lg,
            background: color.input,
            border: `1px solid ${color.borderStrong}`,
            color: color.textSecondary,
            fontSize: isMobile ? 13.5 : 14,
            lineHeight: isMobile ? 1.6 : undefined,
            fontFamily: 'inherit',
            outline: 'none',
            resize: 'vertical',
            minHeight: 110,
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              color: isMobile ? color.textTertiary : color.textMuted,
              fontSize: isMobile ? 11 : 12,
              letterSpacing: '.08em',
              textTransform: 'uppercase' as const,
            }}
          >
            Удобства
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 7 : 8 }}>
            {[...SUGGESTED_AMENITIES, ...customAmenities].map((tag) => {
              const selected = (amenities ?? []).includes(tag);
              return (
                <div
                  key={tag}
                  onClick={() => toggleAmenity(tag)}
                  style={
                    isMobile
                      ? {
                          padding: '8px 12px',
                          borderRadius: 11,
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: selected ? 'rgba(242,209,75,.14)' : color.input,
                          border: `1px solid ${selected ? 'rgba(242,209,75,.2)' : color.borderStrong}`,
                          color: selected ? color.gold : color.textTertiary,
                        }
                      : {
                          padding: '7px 14px',
                          borderRadius: radius.pill,
                          border: `1px solid ${selected ? color.gold : color.borderStrong}`,
                          background: selected ? color.warnBg : 'transparent',
                          color: selected ? color.warn : color.textMuted,
                          fontSize: 13,
                          cursor: 'pointer',
                        }
                  }
                >
                  {tag}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
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

      {isMobile && (
        <StickyBar>
          <StickyButton onClick={() => saveMutation.mutate()} disabled={description === null || saveMutation.isPending}>
            {saveMutation.isPending ? 'Сохраняем…' : 'Сохранить изменения'}
          </StickyButton>
        </StickyBar>
      )}
    </div>
  );
}
