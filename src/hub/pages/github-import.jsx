// github-import.jsx — GitHub taraması (HUB_SPEC v3 §12.5, PROMPT_V3 E5).
// Ayrı ekran DEĞİL — aday ekleme yöntemlerinden biri (Adaylar → aksiyon menüsü).
// Token tarayıcıya inmez: tarama `hub-github-scan` edge function'ında,
// HUB_GITHUB_TOKEN secret'ıyla. Dönen `enrichment` yalnızca ön puan ÖNERİR;
// rubriğin (iletişim / kapasite) yerine geçmez — onlar görüşmeden çıkar.
import React, { useState } from 'react';
import { Field, Input, Select } from '../../admin/admin-ui';
import { supabase } from '../../lib/supabase';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import BulkDraft from '../components/bulk-draft';

const KNOWN_LANGS = ['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Swift', 'Kotlin', 'Java', 'C++', 'C#', 'Ruby', 'PHP', 'Dart'];

export default function GithubImport({ onClose }) {
  const store = useHubStore();
  const { can } = usePerms();
  const { openRoles } = store;
  const [p, setP] = useState({ location: 'Turkey', language: 'TypeScript', minRepos: 3, minFollowers: 0, activeMonths: 12, limit: 6 });
  const [roleId, setRoleId] = useState('');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));

  const scan = async () => {
    setBusy(true); setErr(''); setRows(null);
    try {
      const { data, error } = await supabase.functions.invoke('hub-github-scan', { body: p });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setRows((data.rows || []).map((r) => ({ ...r, _take: true })));
      if (!data.rows?.length) setErr('Sonuç yok — parametreleri gevşet.');
    } catch (e) { setErr(e.message || 'Tarama başarısız.'); }
    setBusy(false);
  };

  const add = async () => {
    setBusy(true); setErr('');
    try {
      const payload = (rows || []).map((r) => ({
        _take: r._take,
        fullName: r.name,
        github: r.url,
        city: r.location || null,
        roleType: 'technical',
        whyThisOne: r.why || null,
        evidence: r.evidence || [],
        enrichment: r.enrichment,
        enrichedAt: r.enrichment?.fetched_at,
        aiScore: r.prescore?.score,
        aiScoreNote: r.prescore?.note,
      }));
      const { created } = await store.importCandidates(
        { source: 'github', sourceDetail: 'GitHub taraması', roleId: roleId || null },
        payload,
      );
      setDone({ created });
    } catch (e) { setErr(e.message || 'Eklenemedi.'); setBusy(false); }
  };

  if (!can('candidates.write') || !can('scan.run')) return null;
  const takeN = (rows || []).filter((r) => r._take).length;

  return (
    <div className="hub-wz-overlay" onClick={busy ? undefined : onClose}>
      <div className="hub-wz hub-wz--wide" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="hub-wz__done">
            <h3>{done.created.length} aday havuza eklendi.</h3>
            {done.created.length > 0 && <BulkDraft candidates={done.created} />}
            <button className="hub-wz__next" style={{ margin: '10px auto 0' }} onClick={onClose}>Kapat</button>
          </div>
        ) : (<>
          <div className="hub-wz__head">
            <div className="hub-wz__headrow">
              <div className="hub-wz__q hub-wz__q--tight">GitHub taraması</div>
              <button className="hub-wz__x" onClick={onClose} disabled={busy}>✕</button>
            </div>
          </div>
          <div className="hub-wz__body">
            <div className="hub-wz__sub">
              Token sunucuda tutulur. Ön puan yalnızca <b>bitirmişlik</b> tahmini — iletişim/kapasite görüşmeden.
            </div>
            <div className="adm-form-grid">
              <Field label="Konum"><Input value={p.location} onChange={(v) => set('location', v)} /></Field>
              <Field label="Dil"><Select value={p.language} onChange={(v) => set('language', v)} options={KNOWN_LANGS.map((l) => ({ value: l, label: l }))} /></Field>
              <Field label="Min. repo"><input className="adm-input" type="number" value={p.minRepos} onChange={(e) => set('minRepos', +e.target.value)} /></Field>
              <Field label="Min. takipçi"><input className="adm-input" type="number" value={p.minFollowers} onChange={(e) => set('minFollowers', +e.target.value)} /></Field>
              <Field label="Son aktiflik (ay, 0=filtre yok)"><input className="adm-input" type="number" value={p.activeMonths} onChange={(e) => set('activeMonths', +e.target.value)} /></Field>
              <Field label="Kaç kullanıcı (≤ 8)"><input className="adm-input" type="number" value={p.limit} onChange={(e) => set('limit', Math.min(+e.target.value, 8))} /></Field>
              <Field label="Açık rol (opsiyonel)">
                <select className="adm-input adm-select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                  <option value="">—</option>
                  {openRoles.filter((r) => ['sourcing', 'shortlist'].includes(r.status)).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </Field>
            </div>
            <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={busy} onClick={scan}>
              {busy && !rows ? 'Taranıyor… (API sınırı, ~2 sn/kullanıcı)' : 'Tara'}
            </button>

            {rows && (
              <div style={{ marginTop: 14 }}>
                {rows.map((r, i) => (
                  <div key={r.login} style={{ border: '1px solid var(--adm-border)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <input type="checkbox" checked={r._take} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, _take: e.target.checked } : x)))} />
                      <a href={r.url} target="_blank" rel="noreferrer" style={{ color: 'var(--adm-text)' }}>{r.name}</a>
                      <span style={{ color: 'var(--adm-text-dim)', fontSize: 12, fontWeight: 400 }}>@{r.login} · {r.publicRepos} repo{r.location ? ` · ${r.location}` : ''}</span>
                    </label>
                    <div style={{ fontSize: 12.5, marginTop: 6 }}>
                      <b>Ön puan (öneri): {r.prescore?.score}/5</b> · {r.prescore?.confidence} — {r.prescore?.evidence}
                      <div style={{ color: 'var(--adm-text-dim)' }}>İletişim: — · Kapasite: — (görüşmeden)</div>
                    </div>
                    <div style={{ fontSize: 12.5, marginTop: 4 }}><b>Neden bu kişi:</b> {r.why || '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {err && <div className="hub-wz__err">{err}</div>}
          <div className="hub-wz__foot">
            {rows && <button className="hub-wz__next" disabled={busy || takeN === 0} onClick={add}>{busy ? 'Ekleniyor…' : `${takeN} adayı ekle`}</button>}
          </div>
        </>)}
      </div>
    </div>
  );
}
