// metrics.jsx — Metrikler (v2 §11). Üç metrik + kaynak kırılımı.
// Grafik yok — sayı kartları. Hepsi gerçek veriden; sabit değer yok.
import React, { useMemo } from 'react';
import { useHubStore } from '../hub-store';
import { STAGES, SOURCE_LABEL } from '../hub-constants';
import { stageReachCounts, sourceFunnel, active90 } from '../hub-metrics';

const pct = (n, d) => (d > 0 ? Math.round((100 * n) / d) : null);

function Metric({ label, value, target, hint }) {
  const has = value != null;
  const ok = has && target != null && value >= target;
  return (
    <div style={{ border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-r)', padding: 16, background: 'var(--adm-bg-card)' }}>
      <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 700, color: ok ? 'var(--adm-green)' : 'var(--adm-text)' }}>
        {has ? `%${value}` : '—'}
      </div>
      {target != null && <div style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>Hedef: %{target}+</div>}
      {hint && <div style={{ fontSize: 11, color: 'var(--adm-text-dim)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export default function MetricsPage() {
  const { candidates, touches, stageLog } = useHubStore();

  const reach = useMemo(() => stageReachCounts(stageLog), [stageLog]);
  const funnel = useMemo(() => sourceFunnel(candidates, stageLog), [candidates, stageLog]);
  const a90 = useMemo(() => active90(candidates, stageLog), [candidates, stageLog]);

  const sent = touches.length;
  const replied = touches.filter((t) => t.outcome === 'replied').length;
  const interview = reach.interview || 0;
  const trial = reach.trial || 0;

  // Kaynak başına cevap oranı: o kaynaktan gelen adayların temaslarında
  // outcome='replied' / toplam temas.
  const srcOf = new Map(candidates.map((c) => [c.id, c.source || 'other']));
  const bySource = {};
  for (const t of touches) {
    const s = srcOf.get(t.candidateId) || 'other';
    if (!bySource[s]) bySource[s] = { sent: 0, replied: 0 };
    bySource[s].sent++;
    if (t.outcome === 'replied') bySource[s].replied++;
  }

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
          hint={a90.eligible ? `${a90.active}/${a90.eligible} · 90 günü dolan` : 'henüz 90 günü dolan aday yok'} />
      </div>

      <h3 className="hub-h4">Kaynak başına cevap oranı</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="adm-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Kaynak</th>
              {STAGES.map((s) => <th key={s.value} style={{ textAlign: 'right' }}>{s.label}</th>)}
              <th style={{ textAlign: 'right' }}>Cevap %</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(funnel).sort().map((src) => {
              const f = funnel[src];
              const b = bySource[src] || { sent: 0, replied: 0 };
              return (
                <tr key={src}>
                  <td>{SOURCE_LABEL[src] || src}</td>
                  {STAGES.map((s) => <td key={s.value} style={{ textAlign: 'right' }}>{f[s.value] || 0}</td>)}
                  <td style={{ textAlign: 'right' }}>{pct(b.replied, b.sent) ?? '—'}</td>
                </tr>
              );
            })}
            {Object.keys(funnel).length === 0 && (
              <tr><td colSpan={STAGES.length + 2}><div className="adm-empty">Aday yok.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
