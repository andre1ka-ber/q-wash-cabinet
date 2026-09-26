import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listQueueDay, subscribeToBoardEvents } from 'q-wash-shared';

export const queueDayKey = (washingPointId: string, date?: string) =>
  date ? ['cabinet', 'queue-day', washingPointId, date] : ['cabinet', 'queue-day', washingPointId];

const FALLBACK_POLL_MS = 15_000;

// The per-point board SSE stream fires on every booking change at this point
// (see q-wash-api eventbus) — used here purely as an "something changed"
// signal to refetch the day view, with a slow poll as the fallback if the
// stream is down (same shape as q-wash-display).
export function useQueueDay(washingPointId: string, date: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    return subscribeToBoardEvents(washingPointId, () => {
      void queryClient.invalidateQueries({ queryKey: queueDayKey(washingPointId) });
    });
  }, [washingPointId, queryClient]);

  return useQuery({
    queryKey: queueDayKey(washingPointId, date),
    queryFn: () => listQueueDay(washingPointId, date),
    refetchInterval: FALLBACK_POLL_MS,
  });
}
