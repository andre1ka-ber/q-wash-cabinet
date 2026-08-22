import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  color,
  font,
  radius,
  ApiError,
  GhostButton,
  PrimaryButton,
  createService,
  updateService,
  createPriceOption,
  updatePriceOption,
  deletePriceOption,
  type Service,
} from 'q-wash-shared';
import { useMyWashingPointId } from '../../shared/useMyWashingPoint';

export interface ServiceDrawerProps {
  service?: Service;
  onClose: () => void;
}

interface PriceOptionRow {
  id?: string;
  name: string;
  priceRub: string; // edited as whole сомони in the form, converted to cents on submit
  isDefault: boolean;
}

function toRow(id: string | undefined, name: string, priceCents: number, isDefault: boolean): PriceOptionRow {
  return { id, name, priceRub: (priceCents / 100).toString(), isDefault };
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

export function ServiceDrawer({ service, onClose }: ServiceDrawerProps) {
  const isEdit = Boolean(service);
  const washingPointId = useMyWashingPointId();
  const queryClient = useQueryClient();

  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [duration, setDuration] = useState(service ? String(service.duration_minutes) : '30');
  const [isActive, setIsActive] = useState(service?.is_active ?? true);
  const [priceOptions, setPriceOptions] = useState<PriceOptionRow[]>(
    service && service.price_options.length > 0
      ? service.price_options.map((p) => toRow(p.id, p.name, p.price_cents, p.is_default))
      : [{ name: '', priceRub: '', isDefault: true }],
  );
  const [error, setError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<PriceOptionRow>) {
    setPriceOptions((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function setDefault(index: number) {
    setPriceOptions((rows) => rows.map((row, i) => ({ ...row, isDefault: i === index })));
  }

  function addRow() {
    setPriceOptions((rows) => [...rows, { name: '', priceRub: '', isDefault: false }]);
  }

  function removeRow(index: number) {
    setPriceOptions((rows) => {
      const next = rows.filter((_, i) => i !== index);
      if (rows[index].isDefault && next.length > 0 && !next.some((r) => r.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      const durationMinutes = Number(duration);
      const cleanRows = priceOptions.map((row) => ({
        ...row,
        name: row.name.trim(),
        priceCents: Math.round(Number(row.priceRub) * 100),
      }));

      if (!isEdit) {
        return createService(washingPointId, {
          name: trimmedName,
          description: description.trim() || undefined,
          duration_minutes: durationMinutes,
          price_options: cleanRows.map((row) => ({
            name: row.name,
            price_cents: row.priceCents,
            is_default: row.isDefault,
          })),
        });
      }

      await updateService(service!.id, {
        name: trimmedName,
        description: description.trim() || undefined,
        duration_minutes: durationMinutes,
        is_active: isActive,
      });

      const originalById = new Map(service!.price_options.map((p) => [p.id, p]));
      const keptIds = new Set(cleanRows.filter((r) => r.id).map((r) => r.id));

      // Deletes first, so removing a row and adding a differently-named
      // one in its place never trips the "at least one option" 409.
      for (const original of service!.price_options) {
        if (!keptIds.has(original.id)) {
          await deletePriceOption(original.id);
        }
      }

      for (const row of cleanRows) {
        if (!row.id) {
          await createPriceOption(service!.id, { name: row.name, price_cents: row.priceCents, is_default: row.isDefault });
          continue;
        }
        const original = originalById.get(row.id);
        if (!original) continue;
        const patch: { name?: string; price_cents?: number; is_default?: boolean } = {};
        if (original.name !== row.name) patch.name = row.name;
        if (original.price_cents !== row.priceCents) patch.price_cents = row.priceCents;
        // Never send is_default:false explicitly — the API rejects
        // unsetting the current sole default; setting a *different* row's
        // is_default:true is what unsets the old one server-side.
        if (row.isDefault && !original.is_default) patch.is_default = true;
        if (Object.keys(patch).length > 0) await updatePriceOption(row.id, patch);
      }

      return service!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabinet', 'services', washingPointId] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось выполнить запрос'),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (priceOptions.some((r) => !r.name.trim() || r.priceRub.trim() === '' || Number.isNaN(Number(r.priceRub)))) {
      setError('Заполните название и цену для каждого варианта');
      return;
    }
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
          width: 560,
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
            {isEdit ? 'Услуга' : 'Новая услуга'}
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
            <div style={labelStyle}>Название</div>
            <input
              style={inputStyle}
              placeholder="Например, Комплексная мойка"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={labelStyle}>Описание</div>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 70, fontFamily: 'inherit' }}
              placeholder="Что входит в услугу"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 160 }}>
            <div style={labelStyle}>Длительность, мин</div>
            <input
              style={inputStyle}
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
          </div>

          {isEdit && (
            <div
              onClick={() => setIsActive((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                color: color.textSecondary,
                fontSize: 13,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  border: `1px solid ${isActive ? color.gold : color.borderStrong}`,
                  background: isActive ? color.gold : 'transparent',
                }}
              />
              Услуга активна
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={labelStyle}>Цены по классам авто</div>
            {priceOptions.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div
                  onClick={() => setDefault(i)}
                  title="Вариант по умолчанию"
                  style={{
                    width: 18,
                    height: 18,
                    flex: '0 0 auto',
                    borderRadius: '50%',
                    border: `1px solid ${row.isDefault ? color.gold : color.borderStrong}`,
                    background: row.isDefault ? color.gold : 'transparent',
                    cursor: 'pointer',
                  }}
                />
                <input
                  style={{ ...inputStyle, flex: 2, minWidth: 0 }}
                  placeholder="Седан"
                  value={row.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                />
                <input
                  style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="смн."
                  value={row.priceRub}
                  onChange={(e) => updateRow(i, { priceRub: e.target.value })}
                />
                <div
                  onClick={() => priceOptions.length > 1 && removeRow(i)}
                  style={{
                    width: 34,
                    height: 34,
                    flex: '0 0 auto',
                    borderRadius: radius.sm,
                    border: `1px solid ${color.borderStrong}`,
                    color: priceOptions.length > 1 ? color.textMuted : color.textDim,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: priceOptions.length > 1 ? 'pointer' : 'default',
                  }}
                >
                  ✕
                </div>
              </div>
            ))}
            <GhostButton type="button" onClick={addRow} style={{ alignSelf: 'flex-start', padding: '9px 14px', fontSize: 12 }}>
              + Добавить вариант
            </GhostButton>
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
