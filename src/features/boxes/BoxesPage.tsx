import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  color,
  radius,
  ApiError,
  listBoxes,
  updateBox,
  GhostButton,
  PrimaryButton,
  StatusPill,
  type Box,
} from 'q-wash-shared';
import { useMyWashingPointId } from '../../shared/useMyWashingPoint';
import { pluralRu } from '../../shared/pluralRu';
import { BoxDrawer } from './BoxDrawer';

function BoxCard({
  box,
  onConfigure,
  onError,
}: {
  box: Box;
  onConfigure: () => void;
  onError: (message: string) => void;
}) {
  const washingPointId = useMyWashingPointId();
  const queryClient = useQueryClient();
  const toggleMutation = useMutation({
    mutationFn: (nextOpen: boolean) => updateBox(washingPointId, box.id, { is_open: nextOpen }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cabinet', 'boxes', washingPointId] }),
    onError: (err) => onError(err instanceof ApiError ? err.message : 'Не удалось изменить статус бокса'),
  });

  return (
    <div
      style={{
        borderRadius: radius.lg,
        border: `1px solid ${color.border}`,
        background: color.panel,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ color: color.textPrimaryAlt, fontSize: 15, fontWeight: 700 }}>Бокс {box.number}</div>
          <div style={{ color: color.textFaint, fontSize: 12 }}>{box.label || 'Без описания'}</div>
        </div>
        <StatusPill kind={box.is_open ? 'ok' : 'bad'}>{box.is_open ? 'Открыт' : 'Закрыт'}</StatusPill>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <GhostButton
          type="button"
          onClick={onConfigure}
          style={{ flex: 1, padding: '9px 10px', fontSize: 12, textAlign: 'center' }}
        >
          Настроить
        </GhostButton>
        <GhostButton
          type="button"
          onClick={() => toggleMutation.mutate(!box.is_open)}
          disabled={toggleMutation.isPending}
          style={{
            flex: 1,
            padding: '9px 10px',
            fontSize: 12,
            textAlign: 'center',
            color: box.is_open ? color.bad : color.ok,
          }}
        >
          {box.is_open ? 'Закрыть' : 'Открыть'}
        </GhostButton>
      </div>
    </div>
  );
}

export function BoxesPage() {
  const washingPointId = useMyWashingPointId();
  const [drawerBox, setDrawerBox] = useState<Box | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const boxesQuery = useQuery({
    queryKey: ['cabinet', 'boxes', washingPointId],
    queryFn: () => listBoxes(washingPointId),
  });

  const boxes = boxesQuery.data?.items ?? [];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 700 }}>Боксы</div>
          <div style={{ color: color.textFaint, fontSize: 12 }}>
            {boxesQuery.data ? `${boxes.length} ${pluralRu(boxes.length, ['бокс', 'бокса', 'боксов'])}` : ' '}
          </div>
        </div>
        <PrimaryButton onClick={() => setDrawerBox('new')}>+ Добавить бокс</PrimaryButton>
      </div>

      {boxesQuery.isError && (
        <div style={{ color: color.bad, fontSize: 13, marginBottom: 14 }}>Не удалось загрузить список боксов</div>
      )}
      {error && <div style={{ color: color.bad, fontSize: 13, marginBottom: 14 }}>{error}</div>}

      {boxesQuery.isLoading ? (
        <div style={{ padding: 20, color: color.textFaint, fontSize: 13 }}>Загрузка…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {boxes.length === 0 && (
            <div style={{ gridColumn: '1 / -1', color: color.textFaint, fontSize: 13 }}>Пока нет ни одного бокса</div>
          )}
          {boxes.map((box) => (
            <BoxCard key={box.id} box={box} onConfigure={() => setDrawerBox(box)} onError={setError} />
          ))}
          <div
            onClick={() => setDrawerBox('new')}
            style={{
              borderRadius: radius.lg,
              border: `1px dashed ${color.borderDashed}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 6,
              cursor: 'pointer',
              color: color.textFaint,
              fontSize: 13,
              minHeight: 112,
            }}
          >
            <span style={{ fontSize: 22 }}>+</span>
            Добавить бокс
          </div>
        </div>
      )}

      {drawerBox && <BoxDrawer box={drawerBox === 'new' ? undefined : drawerBox} onClose={() => setDrawerBox(null)} />}
    </>
  );
}
