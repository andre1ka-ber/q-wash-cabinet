import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { color, font, radius, ApiError, GhostButton, PrimaryButton, createBox, updateBox, type Box } from 'q-wash-shared';
import { useMyWashingPointId } from '../../shared/useMyWashingPoint';

export interface BoxDrawerProps {
  box?: Box;
  onClose: () => void;
}

const inputStyle = {
  padding: '14px 16px',
  borderRadius: radius.lg,
  background: color.input,
  border: `1px solid ${color.borderStrong}`,
  color: color.textSecondary,
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
};

const labelStyle = {
  color: color.textMuted,
  fontSize: 12,
  letterSpacing: '.08em',
  textTransform: 'uppercase' as const,
};

// Настроить only edits the label — number is always server-assigned and
// is_open has its own quick-toggle button on the card (see BoxesPage), so
// this drawer stays deliberately narrow to what the Box API actually lets
// staff mutate.
export function BoxDrawer({ box, onClose }: BoxDrawerProps) {
  const isEdit = Boolean(box);
  const washingPointId = useMyWashingPointId();
  const queryClient = useQueryClient();

  const [label, setLabel] = useState(box?.label ?? '');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const trimmed = label.trim();
      return isEdit
        ? updateBox(washingPointId, box!.id, { label: trimmed })
        : createBox(washingPointId, { label: trimmed || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabinet', 'boxes', washingPointId] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось выполнить запрос'),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8,6,8,.62)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 30,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 420,
          maxWidth: '100%',
          height: '100%',
          background: color.panelAlt,
          borderLeft: `1px solid ${color.borderStrong}`,
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '24px 28px',
            borderBottom: `1px solid ${color.borderAlt}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontFamily: font.display, color: color.textPrimary, fontSize: 20 }}>
            {isEdit ? `Бокс ${box!.number}` : 'Новый бокс'}
          </div>
          <div
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.sm,
              border: `1px solid ${color.borderStrong}`,
              color: color.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            ✕
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={labelStyle}>Название / тип</div>
            <input
              style={inputStyle}
              placeholder="Например, Детейлинг · подъёмник"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
          </div>

          {error && <div style={{ color: color.bad, fontSize: 13 }}>{error}</div>}
        </div>

        <div style={{ padding: '20px 28px', borderTop: `1px solid ${color.borderAlt}`, display: 'flex', gap: 10 }}>
          <GhostButton type="button" onClick={onClose} style={{ flex: 1, textAlign: 'center', padding: 14, fontSize: 14 }}>
            Отмена
          </GhostButton>
          <PrimaryButton
            type="submit"
            disabled={mutation.isPending}
            style={{ flex: 2, textAlign: 'center', padding: 14, fontSize: 14 }}
          >
            {mutation.isPending ? 'Сохраняем…' : isEdit ? 'Сохранить' : 'Добавить'}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
