import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { color, radius, ApiError, getSchedule, replaceSchedule, PrimaryButton, Toggle, type ScheduleRow } from 'q-wash-shared';
import { useMyWashingPointId } from '../../shared/useMyWashingPoint';

const WEEKDAY_LABELS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

const timeInputStyle = {
  padding: '9px 10px',
  borderRadius: radius.sm,
  background: color.input,
  border: `1px solid ${color.borderStrong}`,
  color: color.textSecondary,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  colorScheme: 'dark' as const,
  width: 110,
};

function sortedByWeekday(items: ScheduleRow[]): ScheduleRow[] {
  return [...items].sort((a, b) => a.weekday - b.weekday);
}

function rowHasBreak(row: ScheduleRow): boolean {
  return Boolean(row.break_start && row.break_end);
}

export function HoursPage() {
  const washingPointId = useMyWashingPointId();
  const queryClient = useQueryClient();
  const scheduleQuery = useQuery({
    queryKey: ['cabinet', 'schedule', washingPointId],
    queryFn: () => getSchedule(washingPointId),
  });

  const [rows, setRows] = useState<ScheduleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Draft-until-saved (per this app's "Save model" decision, PLAN.md) —
  // seed the local draft once from the server, then leave it alone so a
  // background refetch never clobbers an in-progress edit.
  useEffect(() => {
    if (scheduleQuery.data && rows === null) setRows(sortedByWeekday(scheduleQuery.data.items));
  }, [scheduleQuery.data, rows]);

  const mutation = useMutation({
    mutationFn: () => replaceSchedule(washingPointId, rows!),
    onSuccess: (data) => {
      setRows(sortedByWeekday(data.items));
      queryClient.invalidateQueries({ queryKey: ['cabinet', 'schedule', washingPointId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось выполнить запрос'),
  });

  function updateRow(weekday: number, patch: Partial<ScheduleRow>) {
    setRows((prev) => prev && prev.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)));
  }

  function toggleOpen(weekday: number, isOpen: boolean) {
    updateRow(weekday, isOpen ? { is_open: true, open_time: '08:00', close_time: '20:00' } : { is_open: false });
  }

  function toggleBreak(weekday: number, hasBreak: boolean) {
    updateRow(weekday, hasBreak ? { break_start: '13:00', break_end: '14:00' } : { break_start: null, break_end: null });
  }

  function handleSave() {
    setError(null);
    if (!rows) return;
    for (const row of rows) {
      if (row.is_open && (!row.open_time || !row.close_time || row.open_time >= row.close_time)) {
        setError(`${WEEKDAY_LABELS[row.weekday]}: время закрытия должно быть позже времени открытия`);
        return;
      }
      if (rowHasBreak(row) && row.is_open) {
        if (row.break_start! >= row.break_end!) {
          setError(`${WEEKDAY_LABELS[row.weekday]}: конец перерыва должен быть позже начала`);
          return;
        }
        if (row.break_start! < row.open_time! || row.break_end! > row.close_time!) {
          setError(`${WEEKDAY_LABELS[row.weekday]}: перерыв должен быть внутри рабочих часов`);
          return;
        }
      }
    }
    mutation.mutate();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 700 }}>Часы работы</div>
        <PrimaryButton onClick={handleSave} disabled={!rows || mutation.isPending}>
          {mutation.isPending ? 'Сохраняем…' : 'Сохранить'}
        </PrimaryButton>
      </div>

      {scheduleQuery.isError && (
        <div style={{ color: color.bad, fontSize: 13 }}>Не удалось загрузить расписание</div>
      )}
      {error && <div style={{ color: color.bad, fontSize: 13 }}>{error}</div>}

      {!rows ? (
        <div style={{ color: color.textFaint, fontSize: 13 }}>Загрузка…</div>
      ) : (
        <div
          style={{
            borderRadius: radius.xxxl,
            background: color.panel,
            border: `1px solid ${color.border}`,
            overflow: 'hidden',
          }}
        >
          {rows.map((row, i) => (
            <div
              key={row.weekday}
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 44px 260px 1fr',
                alignItems: 'center',
                gap: 18,
                padding: '16px 20px',
                borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${color.rowBorder}`,
              }}
            >
              <div style={{ color: color.textPrimaryAlt, fontSize: 14, fontWeight: 600 }}>
                {WEEKDAY_LABELS[row.weekday]}
              </div>
              <Toggle checked={row.is_open} onChange={(next) => toggleOpen(row.weekday, next)} />
              {row.is_open ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="time"
                      style={timeInputStyle}
                      value={row.open_time ?? '08:00'}
                      onChange={(e) => updateRow(row.weekday, { open_time: e.target.value })}
                    />
                    <span style={{ color: color.textFaint, fontSize: 13 }}>—</span>
                    <input
                      type="time"
                      style={timeInputStyle}
                      value={row.close_time ?? '20:00'}
                      onChange={(e) => updateRow(row.weekday, { close_time: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      onClick={() => toggleBreak(row.weekday, !rowHasBreak(row))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        cursor: 'pointer',
                        color: color.textMuted,
                        fontSize: 12,
                        flex: '0 0 auto',
                      }}
                    >
                      <div
                        style={{
                          width: 15,
                          height: 15,
                          borderRadius: 4,
                          border: `1px solid ${rowHasBreak(row) ? color.gold : color.borderStrong}`,
                          background: rowHasBreak(row) ? color.gold : 'transparent',
                        }}
                      />
                      Перерыв
                    </div>
                    {rowHasBreak(row) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="time"
                          style={timeInputStyle}
                          value={row.break_start ?? '13:00'}
                          onChange={(e) => updateRow(row.weekday, { break_start: e.target.value })}
                        />
                        <span style={{ color: color.textFaint, fontSize: 13 }}>—</span>
                        <input
                          type="time"
                          style={timeInputStyle}
                          value={row.break_end ?? '14:00'}
                          onChange={(e) => updateRow(row.weekday, { break_end: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ color: color.textDim, fontSize: 13 }}>Выходной</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
