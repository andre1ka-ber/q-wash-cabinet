import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  color,
  radius,
  ApiError,
  getWashingPointCredentials,
  resetWashingPointCredentials,
  GhostButton,
  CredentialsRevealModal,
} from 'q-wash-shared';
import { useMyWashingPointId } from '../../shared/useMyWashingPoint';

type Role = 'staff' | 'worker';

const ROLE_LABEL: Record<Role, string> = {
  staff: 'Персонал (кабинет)',
  worker: 'Работник (очередь)',
};

function CredentialRow({
  role,
  username,
  onReset,
  resetting,
}: {
  role: Role;
  username: string;
  onReset: () => void;
  resetting: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 20px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ color: color.textFaint, fontSize: 12 }}>{ROLE_LABEL[role]}</div>
        <div style={{ color: color.textPrimaryAlt, fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{username}</div>
      </div>
      <GhostButton type="button" onClick={onReset} disabled={resetting} style={{ padding: '10px 16px', fontSize: 12.5 }}>
        {resetting ? 'Сбрасываем…' : 'Сбросить пароль'}
      </GhostButton>
    </div>
  );
}

// Login credentials for this point's two auto-provisioned accounts (staff
// for this cabinet, worker for the worker app) — usernames only, never
// passwords (only ever visible once, at creation or right after a reset —
// see q-wash-api/docs/API.md's "Washing point credentials"). Both roles
// share the point's own /washing-points/{id}/credentials endpoint (staff
// may only act on their own point, same restriction as every other tab
// here).
export function SecurityPage() {
  const washingPointId = useMyWashingPointId();
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ role: Role; username: string; password: string } | null>(null);

  const credentialsQuery = useQuery({
    queryKey: ['cabinet', 'credentials', washingPointId],
    queryFn: () => getWashingPointCredentials(washingPointId),
  });

  const resetMutation = useMutation({
    mutationFn: (role: Role) => resetWashingPointCredentials(washingPointId, role),
    onSuccess: (credential, role) => {
      setError(null);
      setReveal({ role, ...credential });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось сбросить пароль'),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 700 }}>Безопасность</div>

      {credentialsQuery.isError && (
        <div style={{ color: color.bad, fontSize: 13 }}>Не удалось загрузить учётные данные</div>
      )}
      {error && <div style={{ color: color.bad, fontSize: 13 }}>{error}</div>}

      {credentialsQuery.isLoading ? (
        <div style={{ color: color.textFaint, fontSize: 13 }}>Загрузка…</div>
      ) : credentialsQuery.data ? (
        <div
          style={{
            borderRadius: radius.xxxl,
            background: color.panel,
            border: `1px solid ${color.border}`,
            overflow: 'hidden',
          }}
        >
          <CredentialRow
            role="staff"
            username={credentialsQuery.data.staff.username}
            onReset={() => resetMutation.mutate('staff')}
            resetting={resetMutation.isPending && resetMutation.variables === 'staff'}
          />
          <div style={{ borderTop: `1px solid ${color.rowBorder}` }} />
          <CredentialRow
            role="worker"
            username={credentialsQuery.data.worker.username}
            onReset={() => resetMutation.mutate('worker')}
            resetting={resetMutation.isPending && resetMutation.variables === 'worker'}
          />
        </div>
      ) : null}

      {reveal && (
        <CredentialsRevealModal
          title="Пароль сброшен"
          items={[{ label: ROLE_LABEL[reveal.role], username: reveal.username, password: reveal.password }]}
          onClose={() => setReveal(null)}
        />
      )}
    </div>
  );
}
