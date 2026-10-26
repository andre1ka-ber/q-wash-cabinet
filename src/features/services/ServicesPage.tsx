import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  color,
  radius,
  ApiError,
  listServices,
  updateService,
  DataTable,
  DataTableHeaderRow,
  DataTableRow,
  GhostButton,
  PrimaryButton,
  Toggle,
  useIsMobile,
  type Service,
} from 'q-wash-shared';
import { useMyWashingPointId } from '../../shared/useMyWashingPoint';
import { pluralRu } from '../../shared/pluralRu';
import { formatSomoni } from '../../shared/format';
import { ServiceDrawer } from './ServiceDrawer';

const TABLE_COLUMNS = '2.2fr 1fr 2.2fr 0.6fr 0.8fr';

function ActiveToggleCell({ service, onError }: { service: Service; onError: (message: string) => void }) {
  const washingPointId = useMyWashingPointId();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (next: boolean) => updateService(service.id, { is_active: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cabinet', 'services', washingPointId] }),
    onError: (err) => onError(err instanceof ApiError ? err.message : 'Не удалось изменить статус услуги'),
  });
  return (
    <Toggle
      checked={mutation.isPending ? !service.is_active : service.is_active}
      onChange={(next) => mutation.mutate(next)}
      disabled={mutation.isPending}
    />
  );
}

function ServiceCard({
  service,
  onOpen,
  onError,
}: {
  service: Service;
  onOpen: () => void;
  onError: (message: string) => void;
}) {
  return (
    <div
      onClick={onOpen}
      style={{
        borderRadius: 18,
        border: `1px solid ${color.borderAlt}`,
        background: color.panel,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ color: color.textPrimaryAlt, fontSize: 14.5, fontWeight: 600 }}>{service.name}</div>
          <div style={{ color: color.textTertiary, fontSize: 12, lineHeight: 1.45 }}>
            {service.description ? `${service.description} · ` : ''}
            {service.duration_minutes} мин
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ActiveToggleCell service={service} onError={onError} />
        </div>
      </div>
      {service.price_options.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {service.price_options.map((p) => (
            <div
              key={p.id}
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                background: color.panelAlt,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  color: p.is_default ? color.warn : color.textTertiary,
                  fontSize: 10.5,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {p.name}
              </span>
              <span style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {formatSomoni(p.price_cents)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddDashedButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      role="button"
      onClick={onClick}
      style={{
        padding: 14,
        borderRadius: radius.xl,
        border: `1px dashed ${color.borderDashed}`,
        color: color.textTertiary,
        fontSize: 13,
        textAlign: 'center',
        cursor: 'pointer',
      }}
    >
      {label}
    </div>
  );
}

export function ServicesPage() {
  const washingPointId = useMyWashingPointId();
  const isMobile = useIsMobile();
  const [drawerService, setDrawerService] = useState<Service | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ['cabinet', 'services', washingPointId],
    queryFn: () => listServices(washingPointId),
  });

  const services = servicesQuery.data?.items ?? [];

  return (
    <>
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 700 }}>Услуги</div>
            <div style={{ color: color.textFaint, fontSize: 12 }}>
              {servicesQuery.data ? `${services.length} ${pluralRu(services.length, ['услуга', 'услуги', 'услуг'])}` : ' '}
            </div>
          </div>
          <PrimaryButton onClick={() => setDrawerService('new')}>+ Добавить услугу</PrimaryButton>
        </div>
      )}

      {servicesQuery.isError && (
        <div style={{ color: color.bad, fontSize: 13, marginBottom: 14 }}>Не удалось загрузить список услуг</div>
      )}
      {error && <div style={{ color: color.bad, fontSize: 13, marginBottom: 14 }}>{error}</div>}

      {servicesQuery.isLoading ? (
        <div style={{ padding: 20, color: color.textFaint, fontSize: 13 }}>Загрузка…</div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {services.length === 0 && (
            <div style={{ padding: 20, color: color.textFaint, fontSize: 13 }}>Пока нет ни одной услуги</div>
          )}
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} onOpen={() => setDrawerService(s)} onError={setError} />
          ))}
          <AddDashedButton label="+ Добавить услугу" onClick={() => setDrawerService('new')} />
        </div>
      ) : services.length === 0 ? (
        <div style={{ padding: 20, color: color.textFaint, fontSize: 13 }}>Пока нет ни одной услуги</div>
      ) : (
        <DataTable>
          <DataTableHeaderRow
            gridTemplateColumns={TABLE_COLUMNS}
            columns={['Услуга', 'Длительность', 'Цены', 'Активна', '']}
          />
          {services.map((s, i) => (
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
                <ActiveToggleCell service={s} onError={setError} />
              </div>
              <div>
                <GhostButton
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDrawerService(s);
                  }}
                  style={{ padding: '7px 14px', fontSize: 12 }}
                >
                  Изменить
                </GhostButton>
              </div>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      {drawerService && (
        <ServiceDrawer
          service={drawerService === 'new' ? undefined : drawerService}
          onClose={() => setDrawerService(null)}
        />
      )}
    </>
  );
}
