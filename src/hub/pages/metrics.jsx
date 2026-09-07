// metrics.jsx — Metrikler (v2 §11). Üç metrik + kaynak kırılımı.
// Grafik yok — sayı kartları. Hepsi gerçek veriden; sabit değer yok.
import React, { useMemo } from 'react';
import { useHubStore } from '../hub-store';
import { SOURCE_LABEL } from '../hub-constants';
import { stageReachCounts, sourceStats, active90 } from '../hub-metrics';

const pct = (n, d) => (d > 0 ? Math.round((100 * n) / d) : null);

function Metric({ label, value, target, hint }) {
  const has = value != null;
  const ok = has && target != null && value >= target;
  const pctFill = has && target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="hub-c">
      <div style={{ fontSize: 12, color: '#A29D94' }}>{label}</div>
      <div style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif', fontSize: 27, fontWeight: 700, color: ok ? '#16A34A' : '#1C1917', margin: '2px 0 8px' }}>
        {has ? `%${value}` : '—'}
      </div>
      {target != null && (
        <div className="hub-bar"><i style={{ width: `${pctFill}%`, background: ok ? '#16A34A' : '#DC2626' }} /></div>
      )}
      <div style={{ fontSize: 11, color: '#A29D94', marginTop: 6 }}>
        {target != null ? `Hedef %${target}+` : ''}{hint ? ` · ${hint}` : ''}
      </div>
    </div>
  );
}

export default function MetricsPage() {
  const { candidates, touches, stageLog } = useHubStore();

  const reach = useMemo(() => stageReachCounts(stageLog), [stageLog]);
  const stats = useMemo(() => sourceStats(candidates, touches, stageLog), [candidates, touches, stageLog]);
  const a90 = useMemo(() => active90(candidates, stageLog), [candidates, stageLog]);

  const sent = touches.length;
  const replied = touches.filter((t) => t.outcome === 'replied').length;
  const interview = reach.interview || 0;
  const trial = reach.trial || 0;

  // E1 — kaynak = "Teknofest 2026 ulaşım kategorisi" düzeyinde (source_detail).
  // Önce işe alım, sonra cevap oranına göre sırala; verimli kaynak üstte.
  const srcRows = Object.values(stats).sort(
    (a, b) => b.hired - a.hired || (b.replyRate ?? -1) - (a.replyRate ?? -1) || b.total - a.total
  );

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Metrikler</h1>
          <p className="adm-page-head__desc">Hepsi hub_touches / hub_stage_log'tan. Sabit değer yok.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Metric label="Cevap oranı (temas → cevap)" value={pct(replied, sent)} target={20} hint={`${replied}/${sent}`} />
        <Metric label="Görüşmeden Deneme'ye" value={pct(trial, interview)} target={25} hint={`${trial}/${interview}`} />
        <Metric label="90 günde hâlâ aktif" value={a90.rate} target={70}
          hint={a90.eligible
            ? `${a90.active}/${a90.eligible} · 90 günü dolan · ${a90.source === 'production' ? 'Team üretim verisi' : 'stage_log tahmini (Team verisi bekleniyor — E6)'}`
            : 'henüz 90 günü dolan aday yok'} />
      </div>

      <h3 className="hub-h4">Kaynak verimi</h3>
      <p style={{ fontSize: 12, color: '#A29D94', margin: '0 0 8px' }}>
        Kaynak = spesifik parti (“Teknofest 2026 ulaşım kategorisi”), tip değil. Aday sayısı çok değil,
        <b> cevap oranı</b> ve <b>işe alım</b> önemli.
      </p>
      <div className="adm-card" style={{ overflowX: 'auto' }}>
        <table className="adm-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Kaynak</th>
              <th style={{ textAlign: 'right' }}>Aday</th>
              <th style={{ textAlign: 'right' }}>Temas</th>
              <th style={{ textAlign: 'right' }}>Cevap %</th>
              <th style={{ textAlign: 'right' }}>İşe alım</th>
            </tr>
          </thead>
          <tbody>
            {srcRows.map((r) => (
              <tr key={r.key}>
                <td>{SOURCE_LABEL[r.key] || r.key || '—'}</td>
                <td style={{ textAlign: 'right' }}>{r.total}</td>
                <td style={{ textAlign: 'right' }}>{r.sent}</td>
                <td style={{ textAlign: 'right', fontWeight: r.replyRate != null && r.replyRate >= 20 ? 700 : 400, color: r.replyRate != null && r.replyRate >= 20 ? 'var(--adm-green)' : undefined }}>
                  {r.replyRate == null ? '—' : `%${r.replyRate}`}
                </td>
                <td style={{ textAlign: 'right', fontWeight: r.hired > 0 ? 700 : 400 }}>{r.hired}</td>
              </tr>
            ))}
            {srcRows.length === 0 && (
              <tr><td colSpan={5}><div className="adm-empty">Aday yok.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
