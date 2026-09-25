import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  color,
  radius,
  getReports,
  StatCard,
  DataTable,
  DataTableHeaderRow,
  DataTableRow,
  GhostButton,
  useIsMobile,
  type ReportsPeriod,
  type ReportsBar,
  type StatusPillKind,
} from 'q-wash-shared';
import { useMyWashingPoint, useMyWashingPointId } from '../../shared/useMyWashingPoint';
import { formatSomoni } from '../../shared/format';

const SERVICES_TABLE_COLUMNS = '2fr 0.8fr 1.1fr 1.3fr';

const PERIODS: { value: ReportsPeriod; label: string }[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
];

interface Delta {
  text: string;
  kind: StatusPillKind;
}

function pctDelta(n: number | null): Delta | undefined {
  if (n == null) return undefined;
  return { text: `${n > 0 ? '+' : ''}${n}%`, kind: n < 0 ? 'bad' : n > 0 ? 'ok' : 'mute' };
}

function intDelta(n: number | null): Delta | undefined {
  if (n == null) return undefined;
  return { text: `${n > 0 ? '+' : ''}${n}`, kind: n < 0 ? 'bad' : n > 0 ? 'ok' : 'mute' };
}

function ppDelta(n: number | null): Delta | undefined {
  if (n == null) return undefined;
  return { text: `${n > 0 ? '+' : ''}${n} п.п.`, kind: n < 0 ? 'bad' : n > 0 ? 'ok' : 'mute' };
}

// Same convention QrCodePage's dayLabel already uses: format the bar
// label client-side from the raw timestamp the backend sends, rather than
// have the backend pre-format Russian text. For month (up to 31 bars),
// only every 4th label plus the last is shown — otherwise they overlap —
// matching the design mock's own sparse-labeling for that period.
function barLabel(period: ReportsPeriod, iso: string, index: number, total: number): string {
  const d = new Date(iso);
  if (period === 'today') {
    return String(d.getHours()).padStart(2, '0');
  }
  if (period === 'month' && index % 4 !== 0 && index !== total - 1) {
    return '';
  }
  if (period === 'week') {
    const label = d.toLocaleDateString('ru-RU', { weekday: 'short' });
    return label.charAt(0).toUpperCase() + label.slice(1).replace('.', '');
  }
  return String(d.getDate());
}

// The backend always returns 24 hourly bars for period=today so the chart
// stays a fixed shape regardless of the point's hours — but showing empty
// bars for the middle of the night is just noise, so this trims to the
// point's own open/close hours when they're known. Falls back to showing
// everything if they don't parse (overnight hours, or not loaded yet).
function visibleTodayBars(bars: ReportsBar[], openTime?: string, closeTime?: string): ReportsBar[] {
  if (!openTime || !closeTime) return bars;
  const openHour = Number(openTime.split(':')[0]);
  const closeHour = Number(closeTime.split(':')[0]);
  if (!Number.isFinite(openHour) || !Number.isFinite(closeHour) || closeHour <= openHour) return bars;
  return bars.slice(openHour, closeHour);
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function ReportsPage() {
  const isMobile = useIsMobile();
  const washingPointId = useMyWashingPointId();
  const pointQuery = useMyWashingPoint();
  const [period, setPeriod] = useState<ReportsPeriod>('week');
  const [printMode, setPrintMode] = useState(false);

  const query = useQuery({
    queryKey: ['cabinet', 'reports', washingPointId, period],
    queryFn: () => getReports(washingPointId, period),
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

  function downloadCsv() {
    const report = query.data;
    if (!report) return;
    const rows: string[][] = [
      ['Отчёт', report.range_label],
      [],
      ['Выручка, смн.', String(report.kpis.revenue_cents / 100)],
      ['Машин', String(report.kpis.cars)],
      ['Средний чек, смн.', String(report.kpis.avg_receipt_cents / 100)],
      ['Загрузка боксов, %', String(report.kpis.box_utilization_pct)],
      [],
      ['Услуга', 'Кол-во', 'Выручка, смн.', 'Доля, %'],
      ...report.services.map((s) => [s.name, String(s.count), String(s.revenue_cents / 100), String(s.share_pct)]),
      [],
      ['Бокс', 'Машин', 'Выручка, смн.', 'Загрузка, %'],
      ...report.boxes.map((b) => [b.label, String(b.cars), String(b.revenue_cents / 100), String(b.load_pct)]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `qwash_report_${period}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const report = query.data;
  const bars = report ? (period === 'today' ? visibleTodayBars(report.bars, pointQuery.data?.open_time, pointQuery.data?.close_time) : report.bars) : [];
  const maxBarRevenue = Math.max(1, ...bars.map((b) => b.revenue_cents));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {printMode && report && (
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .report-print-only, .report-print-only * { visibility: visible; }
            .report-print-only { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>
      )}

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ color: color.textPrimary, fontSize: 17, fontWeight: 700 }}>Отчёты</div>
          <div style={{ color: color.textFaint, fontSize: 13 }}>{report?.range_label ?? ' '}</div>
        </div>

        <div style={{ display: 'flex', gap: 4, background: color.panel, border: `1px solid ${color.borderAlt}`, padding: 4, borderRadius: radius.lg, width: isMobile ? '100%' : undefined }}>
          {PERIODS.map((p) => (
            <div
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '9px 16px',
                borderRadius: radius.md,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                ...(period === p.value ? { background: color.gold, color: color.goldOnLight } : { color: color.textFaint }),
              }}
            >
              {p.label}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginLeft: isMobile ? 0 : 'auto' }}>
          <GhostButton style={{ flex: isMobile ? 1 : undefined }} onClick={() => setPrintMode(true)} disabled={!report}>
            Скачать PDF
          </GhostButton>
          <GhostButton style={{ flex: isMobile ? 1 : undefined }} onClick={downloadCsv} disabled={!report}>
            Скачать Excel
          </GhostButton>
        </div>
      </div>

      {query.isLoading && <div style={{ color: color.textFaint, fontSize: 13 }}>Загрузка…</div>}
      {query.isError && <div style={{ color: color.bad, fontSize: 13 }}>Не удалось загрузить отчёт</div>}

      {report && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? 10 : 12 }}>
            <StatCard label="Выручка" value={formatSomoni(report.kpis.revenue_cents)} delta={pctDelta(report.kpis.revenue_delta_pct)} />
            <StatCard label="Машин" value={report.kpis.cars} delta={intDelta(report.kpis.cars_delta)} />
            <StatCard label="Средний чек" value={formatSomoni(report.kpis.avg_receipt_cents)} delta={pctDelta(report.kpis.avg_receipt_delta_pct)} />
            <StatCard label="Загрузка боксов" value={`${report.kpis.box_utilization_pct}%`} delta={ppDelta(report.kpis.box_utilization_delta_pp)} />
          </div>

          <div style={{ padding: isMobile ? '16px 16px' : '20px 22px', borderRadius: radius.xxl, background: color.panel, border: `1px solid ${color.borderAlt}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: color.textPrimary, fontSize: 14, fontWeight: 600 }}>
                {period === 'today' ? 'Выручка по часам' : 'Выручка по дням'}
              </div>
              <div style={{ color: color.textFaint, fontSize: 12 }}>
                {period === 'today' ? 'текущий час выделен' : 'сегодня выделено'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? 4 : 8, height: isMobile ? 130 : 176, overflowX: isMobile ? 'auto' : undefined }}>
              {bars.map((b, i) => (
                <div key={b.timestamp} title={formatSomoni(b.revenue_cents)} style={{ flex: '1 0 0', minWidth: isMobile ? 10 : 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: '100%',
                      borderRadius: '5px 5px 2px 2px',
                      height: Math.max(2, Math.round((b.revenue_cents / maxBarRevenue) * (isMobile ? 100 : 148))),
                      background: b.highlighted ? color.gold : color.borderDashed,
                    }}
                  />
                  <div style={{ color: color.textFaint, fontSize: isMobile ? 9.5 : 11, whiteSpace: 'nowrap' }}>{barLabel(period, b.timestamp, i, bars.length)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1.35fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ color: color.textPrimary, fontSize: 14, fontWeight: 600 }}>По услугам</div>
                {report.services.length === 0 ? (
                  <div style={{ color: color.textFaint, fontSize: 12.5 }}>Нет завершённых записей за период</div>
                ) : (
                  report.services.map((s) => (
                    <div key={s.service_id} style={{ padding: 12, borderRadius: radius.lg, background: color.panel, border: `1px solid ${color.borderAlt}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ color: color.textPrimaryAlt, fontSize: 13.5, fontWeight: 600 }}>{s.name}</span>
                        <span style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatSomoni(s.revenue_cents)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: color.textFaint, fontSize: 12 }}>{s.count} шт</span>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: color.borderAlt, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, background: color.gold, width: `${s.share_pct}%` }} />
                        </div>
                        <span style={{ color: color.textFaint, fontSize: 12, width: 32, textAlign: 'right' }}>{s.share_pct}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <DataTable>
                <DataTableHeaderRow gridTemplateColumns={SERVICES_TABLE_COLUMNS} columns={['Услуга', 'Кол-во', 'Выручка', 'Доля']} />
                {report.services.length === 0 ? (
                  <div style={{ padding: 20, color: color.textFaint, fontSize: 13 }}>Нет завершённых записей за период</div>
                ) : (
                  report.services.map((s, i) => (
                    <DataTableRow key={s.service_id} gridTemplateColumns={SERVICES_TABLE_COLUMNS} isLast={i === report.services.length - 1}>
                      <div style={{ color: color.textPrimaryAlt, fontSize: 13.5, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ color: color.textSecondary, fontSize: 13 }}>{s.count}</div>
                      <div style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatSomoni(s.revenue_cents)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: color.borderAlt, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, background: color.gold, width: `${s.share_pct}%` }} />
                        </div>
                        <span style={{ color: color.textFaint, fontSize: 12, width: 34, textAlign: 'right' }}>{s.share_pct}%</span>
                      </div>
                    </DataTableRow>
                  ))
                )}
              </DataTable>
            )}

            <div style={{ padding: '16px 20px', borderRadius: radius.xxl, background: color.panel, border: `1px solid ${color.borderAlt}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: color.textPrimary, fontSize: 14, fontWeight: 600 }}>По боксам</span>
                <span style={{ color: color.textFaint, fontSize: 12 }}>загрузка</span>
              </div>
              {report.boxes.map((b) => (
                <div key={b.number} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ color: color.textPrimaryAlt, fontSize: 13, fontWeight: 600 }}>{b.label}</span>
                    <span style={{ color: color.textSecondary, fontSize: 12.5, whiteSpace: 'nowrap' }}>{b.cars} авто · {formatSomoni(b.revenue_cents)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: color.borderAlt, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: color.gold, width: `${b.load_pct}%` }} />
                    </div>
                    <span style={{ color: color.textFaint, fontSize: 12, width: 34, textAlign: 'right' }}>{b.load_pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {printMode && report && (
        <div className="report-print-only" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Отчёт · {report.range_label}</div>
          <div>Выручка: {formatSomoni(report.kpis.revenue_cents)}</div>
          <div>Машин: {report.kpis.cars}</div>
          <div>Средний чек: {formatSomoni(report.kpis.avg_receipt_cents)}</div>
          <div>Загрузка боксов: {report.kpis.box_utilization_pct}%</div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Услуга</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Кол-во</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Выручка</th>
              </tr>
            </thead>
            <tbody>
              {report.services.map((s) => (
                <tr key={s.service_id}>
                  <td>{s.name}</td>
                  <td>{s.count}</td>
                  <td>{formatSomoni(s.revenue_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
