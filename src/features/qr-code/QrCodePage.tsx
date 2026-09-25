import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  color,
  font,
  radius,
  ApiError,
  resolveApiAssetUrl,
  getMyQrCode,
  requestQrCodeReplacement,
  QrCodeImage,
  StatCard,
  StatusPill,
  GhostButton,
  useIsMobile,
  type QrCode,
} from 'q-wash-shared';

// Same helper q-wash-admin's pool page already verified against the live
// backend — /q/{token} is a short, root-level alias for
// /api/v1/qr-codes/scan/{token} (same handler), chosen over the longer
// path so the encoded string stays short and the resulting QR stays a
// low, visually clean version even at a small size.
function scanUrl(token: string): string {
  return resolveApiAssetUrl(`/q/${token}`);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function dayLabel(dateStr: string): string {
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1).replace('.', '');
}

async function downloadSvgAsPng(svg: SVGSVGElement, filename: string) {
  // getBoundingClientRect (not svg.width.baseVal.value) — QrCodeImage now
  // renders width="100%" by default, and baseVal.value only resolves a
  // percentage against layout, which is fragile; the rendered rect is the
  // actual pixel size either way.
  const size = svg.getBoundingClientRect().width || 512;
  const serialized = new XMLSerializer().serializeToString(svg);
  const svgBase64 = btoa(unescape(encodeURIComponent(serialized)));

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('failed to rasterize qr svg'));
    img.src = `data:image/svg+xml;base64,${svgBase64}`;
  });

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(img, 0, 0, size, size);

  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function QrCodePage() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [error, setError] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['cabinet', 'qr-code'],
    queryFn: () => getMyQrCode(),
    retry: (failureCount, err) => err instanceof ApiError && err.code === 'qr_code_not_found' ? false : failureCount < 3,
  });

  const replacementMutation = useMutation({
    mutationFn: () => requestQrCodeReplacement(),
    onSuccess: (updated) => {
      setError(null);
      queryClient.setQueryData(['cabinet', 'qr-code'], updated);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось отправить запрос'),
  });

  useEffect(() => {
    if (!printMode) return;
    const id = requestAnimationFrame(() => window.print());
    const reset = () => setPrintMode(false);
    window.addEventListener('afterprint', reset);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('afterprint', reset);
    };
  }, [printMode]);

  const notFound = query.error instanceof ApiError && query.error.code === 'qr_code_not_found';
  const code: QrCode | undefined = query.data;

  async function handleDownloadPng() {
    const svg = qrWrapperRef.current?.querySelector('svg');
    if (!svg || !code) return;
    try {
      await downloadSvgAsPng(svg, `${code.code}.png`);
    } catch {
      setError('Не удалось сохранить PNG');
    }
  }

  if (query.isLoading) {
    return <div style={{ padding: 20, color: color.textFaint, fontSize: 13 }}>Загрузка…</div>;
  }

  if (notFound) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ color: color.textPrimary, fontSize: 19, fontWeight: 700 }}>QR-код</div>
        <div style={{ color: color.textFaint, fontSize: 13.5, lineHeight: 1.6, maxWidth: 460 }}>
          Администратор ещё не привязал QR-код к вашей мойке. Как только это произойдёт, наклейка появится здесь.
        </div>
      </div>
    );
  }

  if (query.isError || !code) {
    return <div style={{ color: color.bad, fontSize: 13 }}>Не удалось загрузить QR-код</div>;
  }

  const maxDay = Math.max(1, ...code.stats!.scans_by_day.map((d) => d.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {printMode && (
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .qr-print-only, .qr-print-only * { visibility: visible; }
            .qr-print-only { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>
      )}

      {error && <div style={{ color: color.bad, fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 24, alignItems: 'flex-start' }}>
        <div
          style={{
            width: isMobile ? '100%' : 380,
            flex: isMobile ? undefined : '0 0 380px',
            borderRadius: radius.xxl,
            background: '#191813',
            border: `1px solid ${color.borderStrong}`,
            padding: 26,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'stretch' }}>
            <div style={{ color: color.textPrimary, fontSize: 16, fontWeight: 600, fontFamily: font.display }}>Q Wash</div>
            <div style={{ marginLeft: 'auto', color: color.textFaint, fontSize: 12 }}>
              {code.washing_point_name ?? ''}
            </div>
          </div>
          <div
            ref={qrWrapperRef}
            style={{
              width: isMobile ? 196 : 220,
              height: isMobile ? 196 : 220,
              padding: isMobile ? 13 : 14,
              borderRadius: radius.xl,
              background: '#F6F5EF',
              boxSizing: 'border-box',
            }}
          >
            <QrCodeImage value={scanUrl(code.token)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' }}>
            <div style={{ color: color.textPrimary, fontSize: 17, fontWeight: 600 }}>Сканируйте, чтобы занять очередь</div>
            <div style={{ color: color.textFaint, fontSize: 12.5 }}>услуги · запись · живая очередь</div>
          </div>
          <div
            style={{
              alignSelf: 'stretch',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              paddingTop: 12,
              borderTop: `1px solid ${color.borderStrong}`,
            }}
          >
            <span style={{ color: color.gold, fontSize: 13, fontWeight: 700 }}>{code.code}</span>
            <span
              style={{
                color: color.textFaint,
                fontSize: 11,
                fontFamily: 'ui-monospace, monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {scanUrl(code.token)}
            </span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              padding: '18px 20px',
              borderRadius: radius.xxl,
              background: color.panel,
              border: `1px solid ${color.borderAlt}`,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ color: color.textPrimary, fontSize: 16, fontWeight: 600 }}>
                  Код {code.code} привязан к вашей мойке
                </div>
                <StatusPill kind="ok">Активен</StatusPill>
              </div>
              <div style={{ color: color.textFaint, fontSize: 12.5 }}>
                Назначил администратор Q Wash{code.assigned_at ? ` · ${formatDateTime(code.assigned_at)}` : ''} · партия{' '}
                {code.batch_label}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: isMobile ? 8 : 12 }}>
            <StatCard label="Сканов сегодня" value={code.stats!.scans_today} />
            <StatCard label="За 7 дней" value={code.stats!.scans_7d} />
            <StatCard label="Записей через QR" value={code.stats!.bookings_via_qr} />
          </div>

          <div
            style={{
              padding: '18px 20px',
              borderRadius: radius.xxl,
              background: color.panel,
              border: `1px solid ${color.borderAlt}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: color.textPrimary, fontSize: 14, fontWeight: 600 }}>Сканы по дням</div>
              <div style={{ color: color.textFaint, fontSize: 12 }}>последние 7 дней</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 110 }}>
              {code.stats!.scans_by_day.map((d) => (
                <div
                  key={d.date}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}
                >
                  <div
                    title={`${d.date}: ${d.count}`}
                    style={{
                      width: '100%',
                      borderRadius: '6px 6px 3px 3px',
                      height: Math.max(2, Math.round((d.count / maxDay) * 84)),
                      background: color.borderDashed,
                    }}
                  />
                  <div style={{ color: color.textFaint, fontSize: 11 }}>{dayLabel(d.date)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* On mobile these three actions move into a fixed bottom bar
              (below) that mirrors the design mock's mobile QR screen —
              this inline row is desktop-only. */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <GhostButton style={{ flex: 1 }} onClick={() => setPrintMode(true)}>
                Скачать наклейку · PDF
              </GhostButton>
              <GhostButton style={{ flex: 1 }} onClick={() => void handleDownloadPng()}>
                Скачать PNG
              </GhostButton>
              <a
                href={scanUrl(code.token)}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '11px 18px',
                  borderRadius: radius.md,
                  border: `1px solid ${color.borderStrong}`,
                  color: color.textSecondary,
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Открыть страницу
              </a>
            </div>
          )}

          {code.replacement_requested_at ? (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: radius.lg,
                background: color.okBg,
                color: color.ok,
                fontSize: 13,
              }}
            >
              Запрос отправлен администратору. Старый код продолжит работать, пока не привяжут новый.
            </div>
          ) : (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: radius.lg,
                background: color.panelAlt,
                border: `1px solid ${color.borderAlt}`,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 200, color: color.textMuted, fontSize: 12.5, lineHeight: 1.55 }}>
                Наклейка повреждена или потерялась? Сменить код может только администратор.
              </div>
              <GhostButton
                onClick={() => replacementMutation.mutate()}
                disabled={replacementMutation.isPending}
                style={{ color: color.bad, borderColor: color.badBorder, whiteSpace: 'nowrap' }}
              >
                Запросить замену
              </GhostButton>
            </div>
          )}
        </div>
      </div>

      {/* Reserves scroll space so the fixed bottom bar below doesn't cover
          the last content block. */}
      {isMobile && <div style={{ height: 86 }} />}

      {isMobile && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '16px 18px 30px',
            background: `linear-gradient(180deg, rgba(18,18,17,0), ${color.surface} 34%)`,
            zIndex: 12,
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => setPrintMode(true)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 15,
              borderRadius: radius.lg,
              border: 'none',
              background: color.gold,
              color: color.goldOnLight,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
            </svg>
            PDF
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadPng()}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 15,
              borderRadius: radius.lg,
              border: `1px solid ${color.borderStrong}`,
              background: color.panel,
              color: color.textPrimary,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
              <path d="m4 16 4.5-4.5 3.5 3.5 2.5-2.5L20 18" />
            </svg>
            PNG
          </button>
        </div>
      )}

      {printMode && (
        <div className="qr-print-only" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24 }}>
          <QrCodeImage value={scanUrl(code.token)} size={220} background="#ffffff" foreground="#000000" />
          <div style={{ fontWeight: 700, fontSize: 18 }}>{code.code}</div>
          <div>{code.washing_point_name}</div>
        </div>
      )}
    </div>
  );
}
