import { useState } from 'react';
import type { FormEvent } from 'react';
import { authStore, color, font, radius, ApiError, PrimaryButton, LogoMark } from 'q-wash-shared';

const inputStyle = {
  padding: '14px 16px',
  borderRadius: radius.lg,
  background: color.input,
  border: `1px solid ${color.borderStrong}`,
  color: color.textPrimaryAlt,
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
};

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authStore.login(username, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось выполнить запрос');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: color.pageBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 380,
          background: color.panel,
          border: `1px solid ${color.border}`,
          borderRadius: radius.xxxl,
          padding: 36,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <LogoMark size={44} />
          <div style={{ fontFamily: font.display, color: color.textPrimary, fontSize: 20 }}>Кабинет мойки</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ color: color.textMuted, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Логин
          </label>
          <input
            style={inputStyle}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ color: color.textMuted, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Пароль
          </label>
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <div style={{ color: color.bad, fontSize: 13 }}>{error}</div>}

        <PrimaryButton type="submit" disabled={submitting} style={{ width: '100%', padding: 14, fontSize: 14 }}>
          {submitting ? 'Входим…' : 'Войти'}
        </PrimaryButton>
      </form>
    </div>
  );
}
