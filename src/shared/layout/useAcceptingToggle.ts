import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateWashingPoint, type WashingPoint } from 'q-wash-shared';
import { useMyWashingPointId } from '../useMyWashingPoint';

// "Принимаем записи" (accepting bookings) is a direct read/write of
// WashingPoint.status — toggling it fires an instant PATCH, per this
// app's "default to instant/per-section saves" decision (PLAN.md).
// Shared by the desktop header pill and the mobile header/drawer.
export function useAcceptingToggle(point: WashingPoint | undefined) {
  const washingPointId = useMyWashingPointId();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (nextStatus: 'active' | 'paused') => updateWashingPoint(washingPointId, { status: nextStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabinet', 'washing-point', washingPointId] });
    },
  });

  const isActive = point?.status === 'active';

  return {
    isActive,
    isPendingReview: point?.status === 'pending_review',
    canToggle: !!point && point.status !== 'pending_review',
    isSaving: mutation.isPending,
    toggle: () => !mutation.isPending && mutation.mutate(isActive ? 'paused' : 'active'),
  };
}
