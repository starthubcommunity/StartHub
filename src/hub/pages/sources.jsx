// sources.jsx — Kaynak kütüğü + GitHub taraması (§8.6.4–8.6.8).
// C2: GitHub taraması + zenginleştirme + AI ön puanı.
// (Kaynak kütüğü CRUD'u C3'te bu dosyaya eklenecek.)
import React, { useState } from 'react';
import { AIcon, Field, Input } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { searchUsers, enrichUser, requestsPerUser } from '../hub-github';
import { computeEnrichment, prescoreFinishing, whyThisOne, UNKNOWABLE } from '../hub-enrich';

const BLANK = { location: 'Turkey', language: 'TypeScript', minRepos: 3, minFollowers: 0, activeMonths: 6 };

function SignalGrid({ e }) {
  const cells = [
    ['Bitmiş proje', e.finished_projects],
    ['Son aktiflik', e.activity_recency == null ? '—' : `${e.activity_recency} gün`],
    ['Süreklilik', `${e.consistency}/12 ay`],
    ['Dil çeşitliliği', e.breadth],
    ['İş birliği', e.collaboration],
    ['Tek başına bitiren', e.solo_finisher ? 'evet' : 'hayır'],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, fontSize: 12 }}>
      {cells.map(([k, v]) => (
        <div key={k} style={{ background: 'var(--adm-bg)', borderRadius: 6, padding: '4px 8px' }}>
          <div style={{ color: 'var(--adm-text-dim)', fontSize: 11 }}>{k}</div>
          <strong>{v}</strong>
        </div>
      ))}
    </div>
  );
}

export default function SourcesPage() {
  const store = useHubStore();
  const [params, setParams] = useState(BLANK);
  const [token, setToken] = useState('');   // yalnızca RAM — kaydedilmez
  const [limit, setLimit] = useState(12);
  const [deep, setDeep] = useState(false);
  const [prog, setProg] = useState(null);   // { done, total, msg }
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  const set = (k, v) => setParams({ ...params, [k]: v });

  const run = async () => {
    setBusy(true); setErr(''); setRows(null); setDone('');
    try {
      const logins = await searchUsers(params, { token, limit, onProgress: (p) => setProg({ done: 0, total: 1, msg: p.msg }) });
      const total = 1 + logins.length * requestsPerUser(deep);
      let done = 1;
      setProg({ done, total, msg: `${logins.length} kullanıcı analiz ediliyor…` });
      const out = [];
      for (const login of logins) {
        const { user, repos, top, prsToOthers, orgs, readmes } = await enrichUser(login, {
          token, deep,
          tick: () => { done++; setProg({ done, total, msg: `${login}…` }); },
        });
        const enrichment = computeEnrichment({ user, repos, prsToOthers, orgs, readmes });
        const prescore = prescoreFinishing(enrichment, top, { deep });
        out.push({
          _take: true, login,
          name: user.name || login,
          url: user.html_url || `https://github.com/${login}`,
          company: user.company || '',
          blog: user.blog || '',
          location: user.location || '',
          publicRepos: user.public_repos,
          enrichment, prescore,
          why: whyThisOne(top, { sourceDetail: 'GitHub taraması' }),
          top,
        });
      }
      setRows(out);
      setProg(null);
    } catch (e) { setErr(e.message); setProg(null); }
    setBusy(false);
  };

  const addSelected = async () => {
    const take = rows.filter((r) => r._take);
    setBusy(true);
    try {
      const retainUntil = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
      for (const r of take) {
        await store.addCandidate({
          fullName: r.name,
          github: r.url,
          linkedin: null,
          email: null,
          city: r.location || null,
          university: null,                       // §8.6.4: üniversite gelmez
          eduStatus: r.company ? 'working' : 'unknown',
          roleType: 'technical',
          source: 'github',
          sourceDetail: 'GitHub taraması',
          dataTrust: 'guess',                     // §8.6.4
          stage: 'pool',
          enrichment: r.enrichment,
          enrichedAt: r.enrichment.fetched_at,
          aiScore: r.prescore.score,             // yalnızca bitirmişlik
          aiScoreNote: r.prescore.note,
          whyThisOne: r.why,
          evidence: r.top.map((t) => ({ type: 'repo', url: t.html_url, note: `${t.stargazers_count || 0}★ ${t.language || ''}`.trim() })),
          kvkkConsent: false,
          kvkkAt: null,
          retainUntil,
        });
      }
      setDone(`${take.length} aday havuza eklendi.`);
      setRows(null);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">GitHub taraması</h1>
          <p className="adm-page-head__desc">
            Tek gerçek otomatik kaynak. Arama API'si <strong>dakikada 30 istek</strong> (tokensiz 10) —
            tarama kuyrukta ilerler.
          </p>
        </div>
      </div>

      <div className="adm-form-grid adm-form-grid--3">
        <Field label="Konum"><Input value={params.location} onChange={(v) => set('location', v)} /></Field>
        <Field label="Dil"><Input value={params.language} onChange={(v) => set('language', v)} placeholder="TypeScript" /></Field>
        <Field label="Min. repo"><input className="adm-input" type="number" value={params.minRepos} onChange={(e) => set('minRepos', +e.target.value)} /></Field>
        <Field label="Min. takipçi"><input className="adm-input" type="number" value={params.minFollowers} onChange={(e) => set('minFollowers', +e.target.value)} /></Field>
        <Field label="Son aktiflik (ay)"><input className="adm-input" type="number" value={params.activeMonths} onChange={(e) => set('activeMonths', +e.target.value)} /></Field>
        <Field label="Kaç kullanıcı"><input className="adm-input" type="number" value={limit} onChange={(e) => setLimit(+e.target.value)} /></Field>
        <Field label="GitHub token (opsiyonel — kaydedilmez)"><input className="adm-input" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_…" /></Field>
        <Field label="Derin analiz (README/PR/org — daha yavaş)">
          <select className="adm-input adm-select" value={deep ? '1' : '0'} onChange={(e) => setDeep(e.target.value === '1')}>
            <option value="0">Hayır (hızlı)</option><option value="1">Evet</option>
          </select>
        </Field>
      </div>

      <button className="adm-btn adm-btn--primary" disabled={busy} onClick={run}>
        <AIcon name="refresh" size={14} /> Taramayı çalıştır
      </button>

      {prog && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginBottom: 4 }}>
            {prog.msg} · {prog.done}/{prog.total} istek
          </div>
          <div style={{ height: 6, background: 'var(--adm-border-light)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round((100 * prog.done) / Math.max(1, prog.total))}%`, background: 'var(--adm-blue)' }} />
          </div>
        </div>
      )}
      {err && <div style={{ color: 'var(--adm-red)', fontSize: 13, marginTop: 10 }}>{err}</div>}

      <div className="hub-ai" style={{ marginTop: 16 }}>
        <b>Bu taramadan kesinlikle çıkarılamaz</b> — kullanıcı sistemin ne bilmediğini bilmeli:
        <ul style={{ margin: '6px 0 0 18px' }}>
          {UNKNOWABLE.map((u) => <li key={u}>{u}</li>)}
        </ul>
      </div>

      {rows && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--adm-text-secondary)', marginBottom: 10 }}>
            {rows.length} kullanıcı · AI ön puanı yalnızca <strong>bitirmişlik</strong> eksenini tahmin eder;
            iletişim ve kapasite <strong>boş kalır</strong> (görüşmeden çıkar).
          </div>
          {rows.map((r, i) => (
            <div key={r.login} style={{ border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-r)', padding: 12, marginBottom: 10, background: 'var(--adm-bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <input type="checkbox" checked={r._take} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, _take: e.target.checked } : x)))} />
                <a href={r.url} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: 'var(--adm-text)' }}>{r.name}</a>
                <span style={{ color: 'var(--adm-text-dim)', fontSize: 12 }}>@{r.login} · {r.publicRepos} repo{r.company ? ` · ${r.company}` : ''}</span>
              </div>
              <SignalGrid e={r.enrichment} />
              <div className="hub-ai" style={{ marginTop: 8 }}>
                <b>AI ön puanı (öneri): {r.prescore.score}/5</b> · {r.prescore.confidence} güven —{' '}
                {r.prescore.evidence}
                <div style={{ marginTop: 4 }}>İletişim: — (görüşmeden) · Kapasite: — (görüşmeden)</div>
              </div>
              <div style={{ fontSize: 12.5, marginTop: 6 }}>
                <b>Neden bu kişi:</b> {r.why || '—'}
              </div>
            </div>
          ))}
          <button className="adm-btn adm-btn--primary" disabled={busy || rows.every((r) => !r._take)} onClick={addSelected}>
            Seçilenleri havuza ekle
          </button>
        </div>
      )}
      {done && <div className="hub-toast">{done}</div>}
    </div>
  );
}
