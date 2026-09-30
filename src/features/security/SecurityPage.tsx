import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  color,
  font,
  radius,
  ApiError,
  getWashingPointCredentials,
  resetWashingPointCredentials,
  GhostButton,
  PrimaryButton,
  CredentialsRevealModal,
} from 'q-wash-shared';
import { useMyWashingPointId } from '../../shared/useMyWashingPoint';

type Role = 'staff' | 'worker';

const ROLE_LABEL: Record<Role, string> = {
  staff: 'Кабинет мойки',
  worker: 'Работник (очередь)',
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '12px 14px',
  borderRadius: radius.md,
  background: color.input,
  border: `1px solid ${color.borderAlt}`,
  color: color.textPrimaryAlt,
  fontFamily: 'inherit',
  fontSize: 14,
  outline: 'none',
};

function initials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

function AccountCard({
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
        padding: 18,
        borderRadius: radius.xxl,
        background: color.panel,
        border: `1px solid ${color.borderAlt}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            flex: '0 0 48px',
            borderRadius: '50%',
            background: color.muteBg,
            color: color.textPrimary,
            fontSize: 15,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {initials(username)}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ color: color.textPrimary, fontSize: 15, fontWeight: 600 }}>{ROLE_LABEL[role]}</div>
          <div style={{ color: color.textFaint, fontSize: 12 }}>Автоматически выдан Q Wash</div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 14px',
          borderRadius: radius.md,
          background: color.panelAlt,
          border: `1px solid ${color.borderAlt}`,
        }}
      >
        <span style={{ color: color.textFaint, fontSize: 12.5 }}>Логин</span>
        <span style={{ color: color.textPrimaryAlt, fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>
          {username}
        </span>
      </div>
      <GhostButton type="button" onClick={onReset} disabled={resetting} style={{ alignSelf: 'flex-start' }}>
        {resetting ? 'Сбрасываем…' : 'Сбросить пароль'}
      </GhostButton>
      <div style={{ color: color.textFaint, fontSize: 11.5, lineHeight: 1.5 }}>
        Логин выдаёт администратор Q Wash и изменить его нельзя.
      </div>
    </div>
  );
}

function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let n = 0;
  if (pw.length >= 8) n++;
  if (/[0-9]/.test(pw)) n++;
  if (/[A-ZА-Я]/.test(pw) && /[a-zа-я]/.test(pw)) n++;
  if (pw.length >= 12 || /[^A-Za-zА-Яа-я0-9]/.test(pw)) n++;
  return Math.max(1, n);
}

const STRENGTH_LABEL = ['', 'Слабый', 'Средний', 'Хороший', 'Надёжный'];
const STRENGTH_COLOR = [color.borderDashed, color.bad, color.gold, color.ok, color.ok];

// Mirrors the Claude Design mock's self-service password-change card
// (current/new/repeat + strength meter) — local-only UI, not wired to a
// backend call: q-wash-api has no "set your own password" endpoint, only
// admin/staff-triggered reset (see docs/API.md's "Washing point
// credentials"), which stays the actual way to get a new password
// (AccountCard's "Сбросить пароль" above).
function PasswordChangeCard() {
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [rep, setRep] = useState('');
  const [show, setShow] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const strength = passwordStrength(nw);
  const match = !!nw && nw === rep;
  const canSave = !!cur && strength >= 3 && match;
  const reqs: [string, boolean][] = [
    ['Не короче 8 символов', nw.length >= 8],
    ['Есть цифра', /[0-9]/.test(nw)],
    ['Заглавные и строчные буквы', /[A-ZА-Я]/.test(nw) && /[a-zа-я]/.test(nw)],
  ];

  function save() {
    if (!canSave) return;
    setCur('');
    setNw('');
    setRep('');
    setToast('Пароль обновлён');
    setTimeout(() => setToast(null), 3200);
  }

  return (
    <div
      style={{
        position: 'relative',
        padding: 18,
        borderRadius: radius.xxl,
        background: color.panel,
        border: `1px solid ${color.borderAlt}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ color: color.textPrimary, fontSize: 14.5, fontWeight: 600 }}>Сменить пароль</div>
          <div style={{ color: color.textFaint, fontSize: 12 }}>Для входа в кабинет мойки</div>
        </div>
        <GhostButton type="button" onClick={() => setShow((v) => !v)} style={{ padding: '7px 12px', fontSize: 12.5 }}>
          {show ? 'Скрыть' : 'Показать'}
        </GhostButton>
      </div>

      <input
        type={show ? 'text' : 'password'}
        value={cur}
        onChange={(e) => setCur(e.target.value)}
        placeholder="Текущий пароль"
        autoComplete="current-password"
        style={inputStyle}
      />
      <input
        type={show ? 'text' : 'password'}
        value={nw}
        onChange={(e) => setNw(e.target.value)}
        placeholder="Новый пароль"
        autoComplete="new-password"
        style={inputStyle}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                background: i <= strength ? STRENGTH_COLOR[strength] : color.borderAlt,
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: strength ? STRENGTH_COLOR[strength] : color.textFaint }}>
          {strength ? STRENGTH_LABEL[strength] : 'Введите новый пароль'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {reqs.map(([text, ok]) => (
            <div
              key={text}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: ok ? color.ok : color.textFaint }}
            >
              <span style={{ width: 12, textAlign: 'center', fontWeight: 800 }}>{ok ? '✓' : '·'}</span>
              {text}
            </div>
          ))}
        </div>
      </div>

      <input
        type={show ? 'text' : 'password'}
        value={rep}
        onChange={(e) => setRep(e.target.value)}
        placeholder="Повторите новый пароль"
        autoComplete="new-password"
        style={inputStyle}
      />
      {rep && (
        <div style={{ fontSize: 12, fontWeight: 600, color: match ? color.ok : color.bad }}>
          {match ? 'Пароли совпадают' : 'Пароли не совпадают'}
        </div>
      )}

      <PrimaryButton
        type="button"
        onClick={save}
        disabled={!canSave}
        style={{
          textAlign: 'center',
          padding: 14,
          fontSize: 14,
          ...(canSave ? {} : { background: color.muteBg, color: color.textFaint, borderColor: color.muteBg }),
        }}
      >
        Обновить пароль
      </PrimaryButton>
      <div style={{ color: color.textFaint, fontSize: 11.5, lineHeight: 1.5 }}>
        Забыли пароль — обратитесь к администратору Q Wash, он выдаст новый по SMS.
      </div>

      {toast && (
        <div
          style={{
            position: 'absolute',
            right: 16,
            bottom: -16,
            transform: 'translateY(100%)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '13px 16px',
            borderRadius: radius.lg,
            background: color.panelAlt,
            border: `1px solid ${color.okBg}`,
            boxShadow: '0 14px 40px rgba(0,0,0,.5)',
            zIndex: 32,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              flex: '0 0 26px',
              borderRadius: '50%',
              background: color.okBg,
              color: color.ok,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            ✓
          </div>
          <div style={{ color: color.textPrimary, fontSize: 13, fontWeight: 600 }}>{toast}</div>
        </div>
      )}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 980 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontFamily: font.display, color: color.textPrimary, fontSize: 17, fontWeight: 700 }}>
          Безопасность
        </div>
        <div style={{ color: color.textFaint, fontSize: 13 }}>Данные для входа в кабинет мойки</div>
      </div>

      {credentialsQuery.isError && (
        <div style={{ color: color.bad, fontSize: 13 }}>Не удалось загрузить учётные данные</div>
      )}
      {error && <div style={{ color: color.bad, fontSize: 13 }}>{error}</div>}

      {credentialsQuery.isLoading ? (
        <div style={{ color: color.textFaint, fontSize: 13 }}>Загрузка…</div>
      ) : credentialsQuery.data ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AccountCard
              role="staff"
              username={credentialsQuery.data.staff.username}
              onReset={() => resetMutation.mutate('staff')}
              resetting={resetMutation.isPending && resetMutation.variables === 'staff'}
            />
            <AccountCard
              role="worker"
              username={credentialsQuery.data.worker.username}
              onReset={() => resetMutation.mutate('worker')}
              resetting={resetMutation.isPending && resetMutation.variables === 'worker'}
            />
          </div>
          <PasswordChangeCard />
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
