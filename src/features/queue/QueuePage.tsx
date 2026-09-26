import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, cancelBooking, color, getSchedule, listBoxes, PrimaryButton, updateBookingStatus, useIsMobile, type QueueDayItem } from 'q-wash-shared';
import { useMyWashingPointId } from '../../shared/useMyWashingPoint';
import { MobileList } from './MobileList';
import { BookingDetails, BottomSheet, DayStrip, ManualForm, Toast } from './QueueParts';
import { Timeline } from './Timeline';
import {
  buildDays,
  dateKey,
  dayInfoFor,
  fmtTime,
  firstFree,
  minutesOfDay,
  summaryText,
  timelineRange,
  type BookingAction,
} from './queueModel';
import { queueDayKey, useQueueDay } from './useQueueDay';

interface FormState {
  box?: number;
  time?: number;
}

export function QueuePage() {
  const washingPointId = useMyWashingPointId();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const days = useMemo(() => buildDays(now), [now]);
  const [dayKey, setDayKey] = useState(() => dateKey(new Date()));
  const day = dayInfoFor(dayKey, now);
  const isToday = day.rel === 'today';
  const nowMin = isToday ? minutesOfDay(now) : null;

  const dayQuery = useQueueDay(washingPointId, dayKey);
  const boxesQuery = useQuery({ queryKey: ['cabinet', 'boxes', washingPointId], queryFn: () => listBoxes(washingPointId) });
  const scheduleQuery = useQuery({ queryKey: ['cabinet', 'schedule', washingPointId], queryFn: () => getSchedule(washingPointId) });

  const items = useMemo(() => dayQuery.data?.items ?? [], [dayQuery.data]);
  const boxes = useMemo(() => (boxesQuery.data?.items ?? []).slice().sort((a, b) => a.number - b.number), [boxesQuery.data]);
  const scheduleRow = scheduleQuery.data?.items.find((r) => r.weekday === day.weekday);
  const { openMin, closeMin } = timelineRange(scheduleRow, items);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [boxFilter, setBoxFilter] = useState<number | 'all'>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const selected = items.find((e) => e.id === selectedId) ?? null;

  const actionMutation = useMutation({
    mutationFn: (v: { id: string; action: BookingAction }) =>
      v.action.run.type === 'cancel' ? cancelBooking(v.id) : updateBookingStatus(v.id, v.action.run.status),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: queueDayKey(washingPointId) });
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Не удалось изменить запись'),
  });

  function pickDay(key: string) {
    setDayKey(key);
    setSelectedId(null);
    setForm(null);
    setActionError(null);
  }

  function select(id: string) {
    setSelectedId(id);
    setForm(null);
    setActionError(null);
  }

  function closeSelection() {
    setSelectedId(null);
    setActionError(null);
  }

  function onCreated(created: QueueDayItem) {
    setForm(null);
    setSelectedId(created.id);
    setToast(`Добавлено · ${created.ticket} · ${fmtTime(created.scheduled_start_at)} · Бокс ${created.box_number}`);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  const canAdd = day.rel !== 'past' && boxes.some((b) => b.is_open);
  const summary = summaryText(items, day.rel, firstFree(items, boxes, openMin, closeMin, nowMin));

  const details = selected && (
    <BookingDetails
      item={selected}
      rel={day.rel}
      pending={actionMutation.isPending}
      error={actionError}
      onAction={(action) => actionMutation.mutate({ id: selected.id, action })}
      onClose={closeSelection}
      padding={isMobile ? '4px 20px 30px' : '18px'}
    />
  );

  const formNode = form && (
    <ManualForm
      washingPointId={washingPointId}
      day={day}
      boxes={boxes}
      items={items}
      initialBox={form.box}
      initialTime={form.time}
      nowMin={minutesOfDay(now)}
      onClose={() => setForm(null)}
      onCreated={onCreated}
      mobile={isMobile}
    />
  );

  const header = (
    <div style={{ display: 'flex', alignItems: isMobile ? 'baseline' : 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: isMobile ? 0 : 220 }}>
        <div style={{ color: color.textPrimary, fontSize: 17, fontWeight: isMobile ? 600 : 700 }}>
          {isMobile ? 'Очередь' : `Очередь · ${day.label}${day.relLabel ? ` · ${day.relLabel}` : ''}`}
        </div>
        {!isMobile && <div style={{ color: color.textTertiary, fontSize: 12.5 }}>{summary}</div>}
      </div>
      {isMobile && (
        <div style={{ color: color.textTertiary, fontSize: 12 }}>
          {day.label}
          {day.relLabel ? ` · ${day.relLabel}` : ''}
        </div>
      )}
    </div>
  );

  const loadError = dayQuery.isError && (
    <div style={{ color: color.bad, fontSize: 13 }}>Не удалось загрузить очередь</div>
  );

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {header}
        <DayStrip days={days} selected={dayKey} onPick={pickDay} compact />
        {loadError}
        <div style={{ color: color.textTertiary, fontSize: 12, lineHeight: 1.5 }}>{summary}</div>
        {dayQuery.isLoading ? (
          <div style={{ padding: 20, color: color.textFaint, fontSize: 13 }}>Загрузка…</div>
        ) : (
          <MobileList boxes={boxes} items={items} boxFilter={boxFilter} onBoxFilter={setBoxFilter} nowMin={nowMin} selectedId={selectedId} onSelect={select} />
        )}
        {canAdd && (
          <PrimaryButton
            type="button"
            onClick={() => {
              setSelectedId(null);
              setForm({});
            }}
            style={{ padding: 16, borderRadius: 15, fontSize: 15 }}
          >
            + Добавить в очередь
          </PrimaryButton>
        )}
        {selected && !form && <BottomSheet label="Запись" onClose={closeSelection}>{details}</BottomSheet>}
        {form && <BottomSheet label="Добавить в очередь" onClose={() => setForm(null)}>{formNode}</BottomSheet>}
        {toast && <Toast text={toast} mobile />}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        {header}
        <DayStrip days={days} selected={dayKey} onPick={pickDay} />
        {canAdd && (
          <PrimaryButton
            type="button"
            onClick={() => {
              setSelectedId(null);
              setForm({});
            }}
            style={{ marginLeft: 'auto', padding: '12px 18px', borderRadius: 12, fontSize: 13.5 }}
          >
            + Добавить вручную
          </PrimaryButton>
        )}
      </div>
      {loadError}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        {dayQuery.isLoading || boxesQuery.isLoading ? (
          <div style={{ flex: 1, padding: 20, color: color.textFaint, fontSize: 13 }}>Загрузка…</div>
        ) : (
          <Timeline
            boxes={boxes}
            items={items}
            openMin={openMin}
            closeMin={closeMin}
            nowMin={nowMin}
            selectedId={selectedId}
            canAdd={canAdd}
            onSelect={select}
            onAddAt={(box, time) => {
              setSelectedId(null);
              setForm({ box, time });
            }}
          />
        )}
        <div style={{ width: 340, flex: '0 0 340px', position: 'sticky', top: 0, maxHeight: 720, overflowY: 'auto', borderRadius: 18, background: color.panel, border: `1px solid ${color.borderAlt}`, display: 'flex', flexDirection: 'column' }}>
          {form ? (
            formNode
          ) : selected ? (
            details
          ) : (
            <div style={{ padding: '40px 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
              <div style={{ color: color.textPrimary, fontSize: 15, fontWeight: 600 }}>Выберите запись</div>
              <div style={{ color: color.textTertiary, fontSize: 12.5, lineHeight: 1.55 }}>
                Нажмите на карточку, чтобы управлять ей, или на пустое время в колонке бокса — чтобы добавить клиента вручную.
              </div>
            </div>
          )}
        </div>
      </div>
      {toast && <Toast text={toast} mobile={false} />}
    </div>
  );
}
