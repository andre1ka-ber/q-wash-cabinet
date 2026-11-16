import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { ApiError, confirmBooking, listQueueDay, rejectBooking, subscribeToBoardEvents, useAuth, type QueueDayItem } from 'q-wash-shared';
import { useMyWashingPointId } from '../../shared/useMyWashingPoint';
import { buildDays, dayInfoFor } from '../queue/queueModel';
import { queueDayKey } from '../queue/useQueueDay';

// A booking waiting for staff confirmation, with the calendar day it is on.
export interface PendingEntry {
  day: string;
  item: QueueDayItem;
}

export interface PendingBookings {
  pending: PendingEntry[];
  // Ids not yet seen in the bell panel (new since it was last opened).
  unreadIds: Set<string>;
  // Set when a new pending booking shows up after the first load — the toast.
  toast: PendingEntry | null;
  dismissToast: () => void;
  markAllRead: () => void;
  // False for worker accounts: confirm/reject are staff/admin only.
  canDecide: boolean;
  decide: (id: string, kind: 'confirm' | 'reject') => void;
  confirmAll: () => void;
  busy: boolean;
  error: string | null;
}

const PendingContext = createContext<PendingBookings | null>(null);

// null outside <PendingBookingsProvider> (e.g. isolated component tests):
// consumers render nothing instead of crashing.
export function usePendingBookings(): PendingBookings | null {
  return useContext(PendingContext);
}

const POLL_MS = 30_000;
const TOAST_MS = 8000;

const storageKey = (washingPointId: string) => `qw-cabinet-seen-pending:${washingPointId}`;

function readSeen(washingPointId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(washingPointId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeen(washingPointId: string, ids: Set<string>) {
  try {
    localStorage.setItem(storageKey(washingPointId), JSON.stringify([...ids].slice(-200)));
  } catch {
    // Private mode / blocked storage: unread badges just reset on reload.
  }
}

// Loads every pending booking from today through the next six days (the
// cabinet day strip's range) by reading each day's queue — the same cache
// entries the queue page uses — and tracks which ones the owner has seen.
export function PendingBookingsProvider({ children }: { children: ReactNode }) {
  const washingPointId = useMyWashingPointId();
  const { user } = useAuth();
  const canDecide = user?.role !== 'worker';
  const queryClient = useQueryClient();

  const dayKeys = useMemo(() => buildDays(new Date()).map((d) => d.key), []);
  const results = useQueries({
    queries: dayKeys.map((key) => ({
      queryKey: queueDayKey(washingPointId, key),
      queryFn: () => listQueueDay(washingPointId, key),
      refetchInterval: POLL_MS,
      enabled: canDecide,
    })),
  });

  // The queue page already subscribes while open; this keeps the bell live on
  // every other tab of the cabinet.
  useEffect(() => {
    if (!canDecide) return;
    return subscribeToBoardEvents(washingPointId, () => {
      void queryClient.invalidateQueries({ queryKey: queueDayKey(washingPointId) });
    });
  }, [washingPointId, queryClient, canDecide]);

  const pending = useMemo<PendingEntry[]>(() => {
    const out: PendingEntry[] = [];
    results.forEach((r, i) => {
      for (const item of r.data?.items ?? []) if (item.status === 'pending') out.push({ day: dayKeys[i], item });
    });
    return out.sort((a, b) => a.item.scheduled_start_at.localeCompare(b.item.scheduled_start_at));
    // results is a new array every render; its data identities are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKeys, ...results.map((r) => r.data)]);

  const loaded = results.every((r) => r.isSuccess || r.isError);

  const [seen, setSeen] = useState(() => readSeen(washingPointId));
  const unreadIds = useMemo(() => new Set(pending.map((p) => p.item.id).filter((id) => !seen.has(id))), [pending, seen]);

  const markAllRead = useCallback(() => {
    setSeen((prev) => {
      const next = new Set([...prev, ...pending.map((p) => p.item.id)]);
      writeSeen(washingPointId, next);
      return next;
    });
  }, [pending, washingPointId]);

  // Toast only for bookings that appear after the first complete load, so
  // opening the cabinet with old pending bookings doesn't pop one per row.
  const known = useRef<Set<string> | null>(null);
  const [toast, setToast] = useState<PendingEntry | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (known.current === null) {
      known.current = new Set(pending.map((p) => p.item.id));
      return;
    }
    const fresh = pending.filter((p) => !known.current!.has(p.item.id));
    for (const p of pending) known.current.add(p.item.id);
    if (fresh.length) setToast(fresh[0]);
  }, [pending, loaded]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'confirm' | 'reject' }) => (kind === 'confirm' ? confirmBooking(id) : rejectBooking(id)),
    onSuccess: () => setError(null),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось изменить запись'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queueDayKey(washingPointId) }),
  });

  const decide = useCallback(
    (id: string, kind: 'confirm' | 'reject') => {
      setToast((t) => (t?.item.id === id ? null : t));
      mutation.mutate({ id, kind });
    },
    [mutation],
  );

  const [bulkBusy, setBulkBusy] = useState(false);
  const confirmAll = useCallback(() => {
    if (bulkBusy) return;
    setBulkBusy(true);
    setToast(null);
    // One call per booking (no bulk endpoint); a failure on one (e.g. the
    // customer canceled meanwhile) must not stop the rest.
    void Promise.allSettled(pending.map((p) => confirmBooking(p.item.id))).then((rs) => {
      const failed = rs.filter((r) => r.status === 'rejected').length;
      setError(failed ? `Не удалось подтвердить: ${failed}` : null);
      setBulkBusy(false);
      void queryClient.invalidateQueries({ queryKey: queueDayKey(washingPointId) });
    });
  }, [pending, bulkBusy, queryClient, washingPointId]);

  const value = useMemo<PendingBookings>(
    () => ({
      pending,
      unreadIds,
      toast,
      dismissToast: () => setToast(null),
      markAllRead,
      canDecide,
      decide,
      confirmAll,
      busy: mutation.isPending || bulkBusy,
      error,
    }),
    [pending, unreadIds, toast, markAllRead, canDecide, decide, confirmAll, mutation.isPending, bulkBusy, error],
  );

  return <PendingContext.Provider value={value}>{children}</PendingContext.Provider>;
}

// "Сегодня, 14:30" / "Завтра, 09:00" / "18 ноября, 09:00" for a pending entry.
export function whenLabel(day: string, startTime: string): string {
  const info = dayInfoFor(day, new Date());
  const base = info.relLabel ? info.relLabel[0].toUpperCase() + info.relLabel.slice(1) : info.label;
  return `${base}, ${startTime}`;
}

export function pendingCountText(n: number): string {
  const word = n % 10 === 1 && n % 100 !== 11 ? 'запись ждёт' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'записи ждут' : 'записей ждут';
  return `${n} ${word} вашего подтверждения`;
}
