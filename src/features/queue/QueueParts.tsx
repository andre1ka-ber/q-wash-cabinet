import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  color,
  createManualBooking,
  DangerButton,
  font,
  GhostButton,
  getAvailability,
  listServices,
  PrimaryButton,
  StatusPill,
  type Box,
  type QueueDayItem,
  type Service,
} from 'q-wash-shared';
import { formatSomoni } from '../../shared/format';
import { pluralRu } from '../../shared/pluralRu';
import {
  actionsFor,
  fmtMin,
  fmtTime,
  isValidPhone,
  minutesOfDay,
  SOURCE_LABEL,
  STATUS_META,
  toIsoAt,
  type BookingAction,
  type DayInfo,
} from './queueModel';
import { queueDayKey } from './useQueueDay';

const LABEL: CSSProperties = {
  color: color.textTertiary,
  fontSize: 11,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
};

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Закрыть"
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        flex: '0 0 34px',
        borderRadius: 11,
        border: `1px solid ${color.borderStrong}`,
        background: 'transparent',
        color: color.textTertiary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}

export function DayStrip({
  days,
  selected,
  onPick,
  compact,
}: {
  days: DayInfo[];
  selected: string;
  onPick: (key: string) => void;
  compact?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: compact ? 'auto' : undefined, flex: '0 0 auto' }}>
      {days.map((d) => {
        const on = d.key === selected;
        return (
          <button
            key={d.key}
            type="button"
            aria-pressed={on}
            aria-label={`${d.label}${d.relLabel ? `, ${d.relLabel}` : ''}`}
            onClick={() => onPick(d.key)}
            style={{
              flex: '0 0 auto',
              width: 52,
              padding: '8px 0',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: on ? color.gold : color.panel,
              color: on ? color.goldOnLight : color.textSecondary,
              border: `1px solid ${on ? color.gold : d.rel === 'today' ? 'rgba(242,209,75,.45)' : color.borderAlt}`,
            }}
          >
            <span style={{ fontSize: compact ? 10.5 : 11, fontWeight: 600, opacity: 0.8 }}>{d.dow}</span>
            <span style={{ fontSize: compact ? 15 : 16, fontWeight: 700 }}>{d.num}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Toast({ text, mobile }: { text: string; mobile: boolean }) {
  return (
    <div
      role="status"
      style={{
        position: mobile ? 'fixed' : 'absolute',
        ...(mobile ? { left: 16, right: 16, top: 16 } : { right: 30, bottom: 30 }),
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: mobile ? '13px 16px' : '14px 18px',
        borderRadius: mobile ? 16 : 14,
        background: '#212120',
        border: '1px solid rgba(143,203,134,.35)',
        boxShadow: '0 14px 40px rgba(0,0,0,.5)',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          flex: '0 0 28px',
          borderRadius: '50%',
          background: 'rgba(143,203,134,.16)',
          color: color.ok,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        ✓
      </div>
      <div style={{ color: color.textPrimary, fontSize: 13, fontWeight: 600 }}>{text}</div>
    </div>
  );
}

export function BottomSheet({
  onClose,
  children,
  label,
}: {
  onClose: () => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,8,7,.6)', zIndex: 30 }} />
      <div
        role="dialog"
        aria-label={label}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 31,
          maxHeight: '90%',
          overflowY: 'auto',
          borderRadius: '28px 28px 0 0',
          background: '#171714',
          borderTop: '1px solid #31312B',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 40, height: 5, borderRadius: 3, background: color.borderDashed }} />
        </div>
        {children}
      </div>
    </>
  );
}

const ACTION_BUTTON = { acc: PrimaryButton, bad: DangerButton, ghost: GhostButton } as const;

function actionStyle(disabled: boolean): CSSProperties {
  return {
    textAlign: 'center',
    padding: 13,
    borderRadius: 13,
    fontSize: 13.5,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

export function BookingDetails({
  item,
  rel,
  pending,
  error,
  onAction,
  onClose,
  padding,
}: {
  item: QueueDayItem;
  rel: DayInfo['rel'];
  pending: boolean;
  error: string | null;
  onAction: (a: BookingAction) => void;
  onClose: () => void;
  padding: string;
}) {
  const meta = STATUS_META[item.status];
  const actions = actionsFor(item.status, rel);
  const rows: [string, string][] = [
    ['Авто', item.car_name || '—'],
    ['Госномер', item.plate || '—'],
    ['Клиент', item.client_name || (item.source === 'manual' ? 'Клиент на месте' : '—')],
    ['Телефон', item.client_phone || '—'],
    ...(item.items.length > 1
      ? item.items.map((l): [string, string] => [l.service_name, `${l.price_option_name} · ${formatSomoni(l.price_cents)}`])
      : ([
          ['Услуга', item.service_name],
          ['Класс', item.price_option_name],
        ] as [string, string][])),
    ['Стоимость', formatSomoni(item.price_cents)],
    ['Источник', SOURCE_LABEL[item.source]],
  ];
  return (
    <div style={{ padding, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ color: color.gold, fontSize: 32, fontWeight: 700, letterSpacing: '-.04em', lineHeight: 1 }}>{item.ticket}</div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div>
            <StatusPill kind={meta.pill}>{meta.label}</StatusPill>
          </div>
          <div style={{ color: color.textTertiary, fontSize: 12 }}>
            {fmtTime(item.scheduled_start_at)}–{fmtTime(item.scheduled_end_at)} · Бокс {item.box_number}
          </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 14,
          background: color.panelAlt,
          border: `1px solid ${color.borderAlt}`,
          padding: '4px 14px',
        }}
      >
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid #1F1F1C' }}>
            <span style={{ color: color.textTertiary, fontSize: 12.5 }}>{k}</span>
            <span style={{ color: color.textPrimaryAlt, fontSize: 12.5, fontWeight: 600, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
      {error && <div style={{ color: color.bad, fontSize: 12.5 }}>{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {actions.map((a) => {
          const ActionButton = ACTION_BUTTON[a.kind];
          return (
            <ActionButton key={a.label} type="button" disabled={pending} onClick={() => onAction(a)} style={actionStyle(pending)}>
              {a.label}
            </ActionButton>
          );
        })}
        {actions.length === 0 && (
          <div style={{ padding: 12, borderRadius: 12, background: color.panelAlt, color: color.textTertiary, fontSize: 12.5, textAlign: 'center' }}>
            {rel === 'past' ? 'Прошедший день — только просмотр' : 'Запись завершена'}
          </div>
        )}
      </div>
    </div>
  );
}

function chip(on: boolean, extra?: CSSProperties): CSSProperties {
  return {
    textAlign: 'center',
    borderRadius: 11,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: on ? color.gold : color.input,
    color: on ? color.goldOnLight : color.textSecondary,
    border: `1px solid ${on ? color.gold : '#282823'}`,
    ...extra,
  };
}

const INPUT: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: 12,
  background: color.input,
  border: '1px solid #282823',
  color: color.textPrimaryAlt,
  fontFamily: font.body,
  fontSize: 14,
  outline: 'none',
};

const WIZARD_STEPS = ['Бокс', 'Услуга', 'Время', 'Клиент'] as const;
const WIZARD_TITLES = ['Выберите бокс', 'Выберите услугу', 'Выберите время', 'Данные клиента'] as const;
const LAST_STEP = WIZARD_STEPS.length - 1;

export interface ManualFormProps {
  washingPointId: string;
  day: DayInfo;
  boxes: Box[];
  items: QueueDayItem[];
  initialBox?: number;
  initialTime?: number;
  nowMin: number;
  onClose: () => void;
  onCreated: (item: QueueDayItem) => void;
  mobile: boolean;
}

export function ManualForm({ washingPointId, day, boxes, items, initialBox, initialTime, nowMin, onClose, onCreated, mobile }: ManualFormProps) {
  const queryClient = useQueryClient();
  const openBoxes = boxes.filter((b) => b.is_open);
  const [box, setBox] = useState<number | null>(initialBox ?? openBoxes[0]?.number ?? null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [className, setClassName] = useState<string | null>(null);
  const [time, setTime] = useState<number | null>(initialTime ?? null);
  const [car, setCar] = useState('');
  const [plate, setPlate] = useState('');
  const [phone, setPhone] = useState('');
  const [touchedPhone, setTouchedPhone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const servicesQuery = useQuery({
    queryKey: ['cabinet', 'services', washingPointId],
    queryFn: () => listServices(washingPointId),
  });
  const services = useMemo(() => (servicesQuery.data?.items ?? []).filter((s) => s.is_active), [servicesQuery.data]);
  const selected = useMemo(() => services.filter((s) => serviceIds.includes(s.id)), [services, serviceIds]);
  // The car class is chosen once for the whole booking: each service takes its
  // price option of that name, else its default one.
  const classNames = useMemo(() => Array.from(new Set((selected.length ? selected : services).flatMap((s) => s.price_options.map((o) => o.name)))), [selected, services]);
  const optionFor = (s: Service) => s.price_options.find((o) => o.name === className) ?? s.price_options.find((o) => o.is_default) ?? s.price_options[0];
  const picks = selected.map((s) => ({ service: s, option: optionFor(s) }));
  const totalCents = picks.reduce((sum, p) => sum + (p.option?.price_cents ?? 0), 0);
  // Before anything is picked, size the box cards' "nearest window" for the first service.
  const availServiceIds = selected.length ? selected.map((s) => s.id) : services[0] ? [services[0].id] : [];

  const isPast = day.rel === 'past';
  const availQuery = useQuery({
    queryKey: ['cabinet', 'availability', washingPointId, availServiceIds.join(','), day.key, items.length],
    queryFn: () => getAvailability(washingPointId, availServiceIds, day.key),
    enabled: availServiceIds.length > 0 && !isPast,
  });

  const slotsByBox = useMemo(() => {
    const byBox = new Map<number, number[]>();
    if (!availQuery.data) return byBox;
    for (const b of boxes.filter((x) => x.is_open)) {
      byBox.set(
        b.number,
        availQuery.data.items
          .filter((s) => s.available_boxes.includes(b.number))
          .map((s) => minutesOfDay(new Date(s.start)))
          .filter((m) => day.rel !== 'today' || m > nowMin),
      );
    }
    return byBox;
  }, [availQuery.data, boxes, day.rel, nowMin]);
  const slots = box != null ? (slotsByBox.get(box) ?? []) : [];

  const chosen = slots.includes(time ?? -1) ? time : time != null ? (slots.find((t) => t >= time) ?? slots[0]) : slots[0];

  const mutation = useMutation({
    mutationFn: () =>
      createManualBooking(washingPointId, {
        items: picks.map((p) => ({ service_id: p.service.id, price_option_id: p.option!.id })),
        box_number: box!,
        scheduled_start_at: toIsoAt(day.key, chosen!),
        car_name: car.trim() || undefined,
        plate: plate.trim() || undefined,
        client_phone: phone.trim(),
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: queueDayKey(washingPointId) });
      onCreated(created);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось добавить запись'),
  });

  useEffect(() => setError(null), [box, serviceIds, className, time]);

  const phoneOk = isValidPhone(phone);
  const hasServices = picks.length > 0 && picks.every((p) => !!p.option);
  const canSubmit = hasServices && box != null && chosen != null && phoneOk && !mutation.isPending && !isPast;
  const durMin = picks.reduce((sum, p) => sum + (p.service.queue_minutes ?? p.service.duration_minutes), 0);

  const reachable = (i: number) => {
    if (i <= step) return true;
    if (box == null || !hasServices) return false;
    return i === 2 || chosen != null;
  };
  const canNext = step === 0 ? box != null : step === 1 ? hasServices : step === 2 ? chosen != null : canSubmit;

  const next = () => {
    if (step < LAST_STEP) {
      if (canNext) setStep(step + 1);
      return;
    }
    setTouchedPhone(true);
    if (canSubmit) mutation.mutate();
  };

  const cta =
    step < LAST_STEP
      ? step === 2 && chosen == null
        ? 'Нет свободного времени'
        : step === 1 && !hasServices
          ? 'Выберите услугу'
          : 'Далее'
      : 'Добавить в очередь';

  const reviewRows: [string, string][] = [
    ['Бокс', box != null ? `Бокс ${box}` : '—'],
    ...(picks.length
      ? picks.map((p): [string, string] => [p.service.name, p.option ? formatSomoni(p.option.price_cents) : '—'])
      : [['Услуга', '—'] as [string, string]]),
    ['Время', chosen != null ? `${fmtMin(chosen)}–${fmtMin(chosen + durMin)}` : '—'],
    ['Стоимость', hasServices ? formatSomoni(totalCents) : '—'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: mobile ? '10px 20px 8px' : '18px 18px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ color: color.textPrimary, fontSize: 18, fontWeight: 600, letterSpacing: '-.02em' }}>Добавить в очередь</div>
          <div style={{ color: color.textTertiary, fontSize: 12 }}>
            Вручную · {day.label}
            {day.relLabel ? ` · ${day.relLabel}` : ''}
          </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div style={{ padding: mobile ? '2px 20px 12px' : '2px 18px 12px', display: 'grid', gridTemplateColumns: `repeat(${WIZARD_STEPS.length},1fr)`, gap: 6 }}>
        {WIZARD_STEPS.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-current={i === step ? 'step' : undefined}
            disabled={!reachable(i)}
            onClick={() => setStep(i)}
            style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: 0, border: 'none', background: 'transparent', fontFamily: 'inherit', cursor: reachable(i) ? 'pointer' : 'default', minWidth: 0 }}
          >
            <div style={{ height: 4, borderRadius: 2, background: i < step ? '#8A8778' : i === step ? color.gold : '#2B2B26' }} />
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                textAlign: 'left',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: i === step ? color.textPrimary : i < step ? '#A5A39B' : '#5A5A52',
              }}
            >
              {name}
            </div>
          </button>
        ))}
      </div>
      <div style={{ padding: mobile ? '8px 20px 16px' : '8px 18px 16px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: mobile ? 'auto' : undefined }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ color: color.textTertiary, fontSize: 12 }}>
            Шаг {step + 1} из {WIZARD_STEPS.length}
          </div>
          <div style={{ color: color.textPrimary, fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>{WIZARD_TITLES[step]}</div>
        </div>
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {openBoxes.map((b) => {
              const on = box === b.number;
              const nextFree = slotsByBox.get(b.number)?.[0];
              return (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setBox(b.number);
                    setTime(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 14,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    background: on ? 'rgba(242,209,75,.1)' : color.input,
                    border: `1px solid ${on ? color.gold : '#282823'}`,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ color: color.textPrimary, fontSize: 15, fontWeight: 600 }}>Бокс {b.number}</span>
                    <span style={{ color: color.textTertiary, fontSize: 12.5 }}>
                      {availQuery.isLoading ? 'Загрузка…' : nextFree != null ? `Ближайшее окно · ${fmtMin(nextFree)}` : isPast ? '—' : 'Нет свободных окон'}
                    </span>
                  </span>
                  <span style={{ flex: '0 0 20px', width: 20, height: 20, boxSizing: 'border-box', borderRadius: '50%', border: on ? `6px solid ${color.gold}` : '1.5px solid #4E4E47' }} />
                </button>
              );
            })}
            {openBoxes.length === 0 && <div style={{ color: color.bad, fontSize: 12.5 }}>Нет открытых боксов</div>}
          </div>
        )}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {classNames.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={LABEL}>Класс авто</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {classNames.map((name) => {
                    const on = (className ?? picks[0]?.option?.name ?? classNames[0]) === name;
                    return (
                      <button key={name} type="button" aria-pressed={on} onClick={() => setClassName(name)} style={chip(on, { flex: 1, padding: '10px 8px', fontSize: 12.5 })}>
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={LABEL}>Услуги · можно несколько</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {services.map((svc) => {
                  const on = serviceIds.includes(svc.id);
                  const price = optionFor(svc)?.price_cents;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setServiceIds(on ? serviceIds.filter((id) => id !== svc.id) : [...serviceIds, svc.id]);
                        setTime(null);
                      }}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        minWidth: 0,
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        background: on ? 'rgba(242,209,75,.1)' : color.input,
                        border: `1px solid ${on ? color.gold : '#282823'}`,
                      }}
                    >
                      <span
                        style={{
                          flex: '0 0 20px',
                          width: 20,
                          height: 20,
                          boxSizing: 'border-box',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 800,
                          ...(on ? { background: color.gold, color: color.goldOnLight } : { border: '1.5px solid #4E4E47', color: 'transparent' }),
                        }}
                      >
                        ✓
                      </span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ color: color.textPrimaryAlt, fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{svc.name}</span>
                        <span style={{ color: color.textTertiary, fontSize: 12 }}>{svc.queue_minutes ?? svc.duration_minutes} мин</span>
                      </span>
                      {price != null && <span style={{ color: color.gold, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{formatSomoni(price)}</span>}
                    </button>
                  );
                })}
                {servicesQuery.isLoading && <div style={{ color: color.textFaint, fontSize: 12.5 }}>Загрузка…</div>}
                {servicesQuery.isSuccess && services.length === 0 && <div style={{ color: color.bad, fontSize: 12.5 }}>Нет активных услуг</div>}
              </div>
              <div style={{ color: color.textTertiary, fontSize: 12 }}>
                {picks.length ? `${picks.length} ${pluralRu(picks.length, ['услуга', 'услуги', 'услуг'])} · ${durMin} мин · ${formatSomoni(totalCents)}` : 'Выберите одну или несколько услуг'}
              </div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={LABEL}>
              Свободные окна · Бокс {box} · {durMin} мин
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {slots.map((t) => (
                <button key={t} type="button" aria-pressed={t === chosen} onClick={() => setTime(t)} style={chip(t === chosen, { padding: '10px 0' })}>
                  {fmtMin(t)}
                </button>
              ))}
            </div>
            {availQuery.isLoading && <div style={{ color: color.textFaint, fontSize: 12.5 }}>Загрузка…</div>}
            {!availQuery.isLoading && slots.length === 0 && (
              <div style={{ padding: 12, borderRadius: 12, background: 'rgba(208,138,122,.1)', color: color.bad, fontSize: 12.5, lineHeight: 1.5 }}>
                {isPast ? 'Нельзя добавить запись в прошедший день' : 'В этом боксе нет свободного окна под услугу — выберите другой бокс'}
              </div>
            )}
          </div>
        )}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={LABEL}>Телефон клиента</div>
              <input
                aria-label="Телефон"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setTouchedPhone(true)}
                placeholder="Например 90 123 45 67"
                style={{ ...INPUT, borderColor: touchedPhone && !phoneOk ? color.bad : '#282823' }}
              />
              {touchedPhone && !phoneOk && <div style={{ color: color.bad, fontSize: 12 }}>Минимум 9 цифр</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={LABEL}>Автомобиль · необязательно</div>
              <input aria-label="Марка и модель" value={car} onChange={(e) => setCar(e.target.value)} placeholder="Марка и модель" maxLength={255} style={INPUT} />
              <input aria-label="Госномер" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="Госномер" maxLength={32} style={INPUT} />
            </div>
            <div style={{ borderRadius: 14, background: color.input, border: '1px solid #282823', padding: '4px 14px' }}>
              {reviewRows.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: `1px solid ${color.borderAlt}` }}>
                  <span style={{ color: color.textTertiary, fontSize: 12.5 }}>{k}</span>
                  <span style={{ color: color.textPrimaryAlt, fontSize: 12.5, fontWeight: 600, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {error && <div style={{ color: color.bad, fontSize: 12.5 }}>{error}</div>}
      </div>
      <div style={{ padding: mobile ? '14px 20px 30px' : '14px 18px 18px', borderTop: `1px solid ${color.borderAlt}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: color.textTertiary, fontSize: 12.5 }}>Итог</span>
          <span style={{ color: color.textPrimary, fontSize: 12.5, fontWeight: 700 }}>
            {chosen != null && box != null && hasServices ? `${fmtMin(chosen)}–${fmtMin(chosen + durMin)} · Бокс ${box} · ${formatSomoni(totalCents)}` : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <GhostButton type="button" onClick={() => (step === 0 ? onClose() : setStep(step - 1))} style={{ flex: 1, padding: 14, borderRadius: 13, fontSize: 14, fontWeight: 600 }}>
            {step === 0 ? 'Отмена' : 'Назад'}
          </GhostButton>
          <PrimaryButton
            type="button"
            onClick={next}
            disabled={mutation.isPending}
            style={{
              flex: 2,
              padding: 14,
              borderRadius: 13,
              fontSize: 14,
              cursor: canNext ? 'pointer' : 'default',
              ...(canNext || step === LAST_STEP ? {} : { background: color.muteBg, borderColor: color.muteBg, color: color.textTertiary }),
            }}
          >
            {cta}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
