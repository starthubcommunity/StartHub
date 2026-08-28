// metrics.jsx — §8.7 yedi metrik + kaynak kırılımı.
// Grafik kütüphanesi yok — sayı kartları ve oran çubukları. Her metrik
// GERÇEK veriden; sabit değer yok. Veri yetmiyorsa "—" gösterilir.
import React, { useMemo } from 'react';
import { useHubStore } from '../hub-store';
import { STAGES, SOURCE_LABEL } from '../hub-constants';
import { stageReachCounts, sourceFunnel, active90 } from '../hub-metrics';

const pct = (n, d) => (d > 0 ? Math.round((100 * n) / d) : null);

function Metric({ label, value, target, hint }) {
  const has = value != null;
  const num = typeof value === 'number';
  const ok = has && num && target != null && value >= target;
  return (
    <div style={{ border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-r)', padding: 14, background: 'var(--adm-bg-card)' }}>
      <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 700, color: ok ? 'var(--adm-green)' : 'var(--adm-text)' }}>
        {has ? (num && hint !== 'raw' ? `%${value}` : value) : '—'}
      </div>
      {target != null && <div style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>Hedef: {typeof target === 'number' && hint !== 'raw' ? `%${target}+` : target}</div>}
      {hint && hint !== 'raw' && <div style={{ fontSize: 11, color: 'var(--adm-text-dim)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function Bar({ label, n, d }) {
  const p = pct(n, d);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ color: 'var(--adm-text-dim)' }}>{n}/{d}{p != null ? ` · %${p}` : ''}</span>
      </div>
      <div style={{ height: 6, background: 'var(--adm-border-light)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${p || 0}%`, background: 'var(--adm-blue)' }} />
      </div>
    </div>
  );
}

export default function MetricsPage() {
  const { candidates, touches, gates, stageLog, members } = useHubStore();

  const reach = useMemo(() => stageReachCounts(stageLog), [stageLog]);
  const funnel = useMemo(() => sourceFunnel(candidates, stageLog), [candidates, stageLog]);
  const a90 = useMemo(() => active90(candidates, stageLog), [candidates, stageLog]);

  const contacted = reach.contacted || 0;
  const replied = reach.replied || 0;
  const interviewed = reach.interviewed || 0;
  const finalist = reach.finalist || 0;

  const gateA = gates.filter((g) => g.gate === 'A');
  const gateB = gates.filter((g) => g.gate === 'B');
  const gatePass = (list) => {
    const decided = list.filter((g) => g.result === 'passed' || g.result === 'failed');
    return { n: list.filter((g) => g.result === 'passed').length, d: decided.length };
  };
  const pa = gatePass(gateA), pb = gatePass(gateB);

  const perFounder = members.map((m) => ({
    name: m.fullName || m.email,
    count: touches.filter((t) => t.senderId === m.id).length,
  })).filter((x) => x.count > 0);

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Metrikler</h1>
          <p className="adm-page-head__desc">Hepsi hub_stage_log / hub_touches / hub_gates'ten. Sabit değer yok.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Metric label="Cevap oranı (temas→cevap)" value={pct(replied, contacted)} target={20} hint={`${replied}/${contacted}`} />
        <Metric label="Cevaptan görüşmeye" value={pct(interviewed, replied)} target={50} hint={`${interviewed}/${replied}`} />
        <Metric label="Görüşmeden finaliste" value={pct(finalist, interviewed)} target={25} hint={`${finalist}/${interviewed}`} />
        <Metric label="Kapı A geçme" value={pct(pa.n, pa.d)} target={60} hint={`${pa.n}/${pa.d}`} />
        <Metric label="Kapı B geçme" value={pct(pb.n, pb.d)} target={70} hint={`${pb.n}/${pb.d}`} />
        <Metric label="90 günde hâlâ aktif" value={a90.rate} target={70}
          hint={a90.eligible ? `${a90.active}/${a90.eligible} · 90 günü dolan` : 'henüz 90 günü dolan aday yok'} />
        <Metric label="Kurucu başına temas" value={perFounder.length ? Math.round(perFounder.reduce((s, x) => s + x.count, 0) / perFounder.length) : null}
          target="50–80" hint="raw" />
      </div>

      <h3 className="hub-h4">Kurucu başına temas</h3>
      {perFounder.length === 0 ? <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Henüz temas yok.</div>
        : perFounder.map((f) => <Bar key={f.name} label={f.name} n={f.count} d={80} />)}

      <h3 className="hub-h4" style={{ marginTop: 24 }}>Kaynak kırılımı</h3>
      <div className="hub-grid-wrap" style={{ maxHeight: 'none' }}>
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
              return (
                <tr key={src}>
                  <td>{SOURCE_LABEL[src] || src}</td>
                  {STAGES.map((s) => <td key={s.value} style={{ textAlign: 'right' }}>{f[s.value] || 0}</td>)}
                  <td style={{ textAlign: 'right' }}>{pct(f.replied || 0, f.contacted || 0) ?? '—'}</td>
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
