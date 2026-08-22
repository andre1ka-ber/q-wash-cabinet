import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  color,
  radius,
  listServices,
  updateService,
  DataTable,
  DataTableHeaderRow,
  DataTableRow,
  PrimaryButton,
  Toggle,
  type Service,
} from 'q-wash-shared';
import { useMyWashingPointId } from '../../shared/useMyWashingPoint';
import { pluralRu } from '../../shared/pluralRu';
import { formatSomoni } from '../../shared/format';
import { ServiceDrawer } from './ServiceDrawer';

const TABLE_COLUMNS = '2.4fr 1fr 2.4fr 0.6fr';

function ActiveToggleCell({ service }: { service: Service }) {
  const washingPointId = useMyWashingPointId();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (next: boolean) => updateService(service.id, { is_active: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cabinet', 'services', washingPointId] }),
  });
  return (
    <div title={mutation.isError ? 'Не удалось сохранить, попробуйте ещё раз' : undefined}>
      <Toggle
        checked={mutation.isPending ? !service.is_active : service.is_active}
        onChange={(next) => mutation.mutate(next)}
        disabled={mutation.isPending}
      />
    </div>
  );
}

export function ServicesPage() {
  const washingPointId = useMyWashingPointId();
  const [drawerService, setDrawerService] = useState<Service | 'new' | null>(null);

  const servicesQuery = useQuery({
    queryKey: ['cabinet', 'services', washingPointId],
    queryFn: () => listServices(washingPointId),
  });

  const services = servicesQuery.data?.items ?? [];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 700 }}>Услуги</div>
          <div style={{ color: color.textFaint, fontSize: 12 }}>
            {servicesQuery.data ? `${services.length} ${pluralRu(services.length, ['услуга', 'услуги', 'услуг'])}` : ' '}
          </div>
        </div>
        <PrimaryButton onClick={() => setDrawerService('new')}>+ Добавить услугу</PrimaryButton>
      </div>

      {servicesQuery.isError && (
        <div style={{ color: color.bad, fontSize: 13, marginBottom: 14 }}>Не удалось загрузить список услуг</div>
      )}

      <DataTable>
        <DataTableHeaderRow
          gridTemplateColumns={TABLE_COLUMNS}
          columns={['Услуга', 'Длительность', 'Цены', 'Активна']}
        />
        {servicesQuery.isLoading ? (
          <div style={{ padding: 20, color: color.textFaint, fontSize: 13 }}>Загрузка…</div>
        ) : services.length === 0 ? (
          <div style={{ padding: 20, color: color.textFaint, fontSize: 13 }}>Пока нет ни одной услуги</div>
        ) : (
          services.map((s, i) => (
            <DataTableRow key={s.id} gridTemplateColumns={TABLE_COLUMNS} isLast={i === services.length - 1}>
              <div onClick={() => setDrawerService(s)} style={{ cursor: 'pointer', minWidth: 0 }}>
                <div style={{ color: color.textPrimaryAlt, fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                {s.description && (
                  <div
                    style={{
                      color: color.textFaint,
                      fontSize: 12,
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.description}
                  </div>
                )}
              </div>
              <div style={{ color: color.textTertiary, fontSize: 13 }}>{s.duration_minutes} мин</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {s.price_options.map((p) => (
                  <span
                    key={p.id}
                    style={{
                      padding: '4px 9px',
                      borderRadius: radius.sm,
                      background: p.is_default ? color.warnBg : color.muteBg,
                      color: p.is_default ? color.warn : color.textTertiary,
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.name}: {formatSomoni(p.price_cents)}
                  </span>
                ))}
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <ActiveToggleCell service={s} />
              </div>
            </DataTableRow>
          ))
        )}
      </DataTable>

      {drawerService && (
        <ServiceDrawer
          service={drawerService === 'new' ? undefined : drawerService}
          onClose={() => setDrawerService(null)}
        />
      )}
    </>
  );
}
