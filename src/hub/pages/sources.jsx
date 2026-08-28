// sources.jsx — Kaynak kütüğü + GitHub taraması (§8.6.4–8.6.9).
import React, { useState, useMemo } from 'react';
import { AIcon, Field, Input, Select, Modal, ConfirmDialog } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { useHubMember } from '../hub-member';
import { SOURCES, SOURCE_LABEL } from '../hub-constants';
import { sourceFunnel, intervalToDays } from '../hub-metrics';
import { searchUsers, enrichUser, requestsPerUser } from '../hub-github';
import { computeEnrichment, prescoreFinishing, whyThisOne, UNKNOWABLE } from '../hub-enrich';

// §8.6.1 — 12 kaynak, kütüğe başlangıç verisi.
const SEED_SOURCES = [
  ['GitHub (konum / dil / aktiflik)', 'github', 'https://github.com/search'],
  ['Hackathon finalist listeleri (Teknofest, banka/operatör, BTK)', 'hackathon', ''],
  ['Kuluçka / hızlandırıcı demo day listeleri', 'incubator', ''],
  ['TÜBİTAK 2209-A/B + TEKNOFEST takım listeleri', 'tubitak', ''],
  ['Kapanmış / duraklamış girişimlerin kurucuları', 'dead_startup', ''],
  ['Üniversite kulüpleri yönetim kurulları (IEEE, ACM, GDG)', 'club', ''],
  ['Bootcamp mezun / demo günleri (Patika, Kodluyoruz, Techcareer)', 'bootcamp', ''],
  ['Yarışmalar (ACM-ICPC TR, Kaggle, Codeforces TR)', 'competition', ''],
  ['Türkçe teknik içerik üretenler (Medium, YouTube, blog)', 'content', ''],
  ['Açık kaynak katkıcıları (TR yerelleştirme / TR odaklı projeler)', 'open_source', ''],
  ['Referans (üyelerden isim isteme)', 'referral', ''],
  ['Inbound (site başvurusu)', 'inbound', ''],
];

const CHECK_OPTS = [
  { value: '7 days', label: 'Haftalık' },
  { value: '14 days', label: '2 haftada bir' },
  { value: '30 days', label: 'Aylık' },
  { value: '90 days', label: '3 ayda bir' },
];
const STATUS_OPTS = [
  { value: 'active', label: 'Aktif' },
  { value: 'paused', label: 'Duraklatıldı' },
  { value: 'dead', label: 'Ölü' },
];

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

function GitHubScan() {
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

// ── Kaynak kütüğü (§8.6.8–8.6.9) ────────────────────────────────
const BLANK_SRC = { name: '', url: '', source: 'hackathon', note: '', checkEvery: '7 days', ownerId: '', status: 'active' };
const EIGHT_WEEKS = 56 * 86400000;

function SourceRegistry() {
  const store = useHubStore();
  const { sources, candidates, stageLog, members, currentMember } = store;
  const role = useHubMember();
  const canWrite = role === 'cofounder' || role === 'recruiter';
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const funnel = useMemo(() => sourceFunnel(candidates, stageLog), [candidates, stageLog]);
  // §8.6.9: 8 haftadır görüşmeye dönüşmemiş kaynak tipi → 'paused' ÖNERİSİ.
  const stalePerf = useMemo(() => {
    const oldestBySrc = {};
    for (const c of candidates) {
      const t = c.createdAt ? Date.parse(c.createdAt) : Date.now();
      const s = c.source || 'other';
      if (!(s in oldestBySrc) || t < oldestBySrc[s]) oldestBySrc[s] = t;
    }
    const rec = {};
    for (const s of Object.keys(funnel)) {
      const f = funnel[s];
      const old = oldestBySrc[s] && Date.now() - oldestBySrc[s] >= EIGHT_WEEKS;
      rec[s] = old && f.pool >= 3 && f.interviewed === 0;
    }
    return rec;
  }, [funnel, candidates]);

  const seed = async () => {
    for (const [name, source, url] of SEED_SOURCES) {
      await store.addItem('sources', { ...BLANK_SRC, name, source, url, ownerId: currentMember?.id ?? null });
    }
    flash('12 kaynak eklendi.');
  };
  const save = async () => {
    if (!editing.name.trim()) { flash('Ad zorunlu.'); return; }
    try {
      if (editing.id) await store.updateItem('sources', editing.id, editing);
      else await store.addItem('sources', { ...editing, ownerId: editing.ownerId || currentMember?.id || null });
      setEditing(null);
    } catch (e) { flash('Hata: ' + e.message); }
  };
  const markChecked = (s) => store.updateItem('sources', s.id, { ...s, lastChecked: new Date().toISOString() });
  const pause = (src) => {
    sources.filter((s) => s.source === src && s.status === 'active')
      .forEach((s) => store.updateItem('sources', s.id, { ...s, status: 'paused' }));
    flash(`“${SOURCE_LABEL[src]}” kaynakları duraklatıldı.`);
  };

  const memberName = (id) => members.find((m) => m.id === id)?.fullName || '—';

  return (
    <div style={{ marginBottom: 32 }}>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Kaynak kütüğü</h1>
          <p className="adm-page-head__desc">Avın nerede yapılacağı birinin aklında değil, burada durur.</p>
        </div>
        {canWrite && (
          <div className="adm-page-head__actions">
            {sources.length === 0 && <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={seed}>12 kaynağı ekle</button>}
            <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setEditing({ ...BLANK_SRC })}>
              <AIcon name="edit" size={14} /> Kaynak ekle
            </button>
          </div>
        )}
      </div>

      {sources.length === 0 ? (
        <div className="adm-empty">Kütük boş. “12 kaynağı ekle” ile §8.6.1 listesinden başla.</div>
      ) : (
        <div className="hub-grid-wrap" style={{ maxHeight: 'none' }}>
          <table className="adm-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Ad</th><th>Tip</th><th>Sıklık</th><th>Son kontrol</th><th>Sorumlu</th>
                <th>Huni (havuz→görüşme→katıldı)</th><th>Durum</th>{canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const f = funnel[s.source] || {};
                const due = !s.lastChecked || Date.now() - Date.parse(s.lastChecked) >= intervalToDays(s.checkEvery) * 86400000;
                return (
                  <tr key={s.id}>
                    <td>{s.url ? <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--adm-blue)' }}>{s.name}</a> : s.name}</td>
                    <td>{SOURCE_LABEL[s.source] || s.source}</td>
                    <td>{CHECK_OPTS.find((c) => c.value === s.checkEvery)?.label || s.checkEvery}</td>
                    <td style={{ color: due ? 'var(--adm-red)' : 'var(--adm-text-dim)' }}>
                      {s.lastChecked ? String(s.lastChecked).slice(0, 10) : 'hiç'}{due ? ' · zamanı geldi' : ''}
                    </td>
                    <td>{memberName(s.ownerId)}</td>
                    <td style={{ fontSize: 12 }}>
                      {f.pool || 0} → {f.replied || 0} → {f.interviewed || 0} → {f.joined || 0}
                      {stalePerf[s.source] && (
                        <button className="hub-pill hub-pill--flag" style={{ marginLeft: 6, cursor: 'pointer', border: 'none' }}
                          onClick={() => pause(s.source)} title="8 haftadır görüşmeye dönüşmedi — duraklatmayı öner">
                          pasifleştir öner
                        </button>
                      )}
                    </td>
                    <td><span className="hub-pill">{STATUS_OPTS.find((o) => o.value === s.status)?.label}</span></td>
                    {canWrite && (
                      <td>
                        <div className="adm-table__actions">
                          <button className="adm-icon-btn" title="Kontrol edildi işaretle" onClick={() => markChecked(s)}><AIcon name="check" size={14} /></button>
                          <button className="adm-icon-btn" title="Düzenle" onClick={() => setEditing(s)}><AIcon name="edit" size={14} /></button>
                          <button className="adm-icon-btn adm-icon-btn--danger" title="Sil" onClick={() => setConfirm(s)}><AIcon name="trash" size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Kaynağı düzenle' : 'Yeni kaynak'}>
        {editing && (
          <div>
            <Field label="Ad" required><Input value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} /></Field>
            <Field label="URL"><Input value={editing.url} onChange={(v) => setEditing({ ...editing, url: v })} placeholder="https://…" /></Field>
            <div className="adm-form-grid">
              <Field label="Tip"><Select value={editing.source} onChange={(v) => setEditing({ ...editing, source: v })} options={SOURCES} /></Field>
              <Field label="Kontrol sıklığı"><Select value={editing.checkEvery} onChange={(v) => setEditing({ ...editing, checkEvery: v })} options={CHECK_OPTS} /></Field>
              <Field label="Sorumlu"><Select value={editing.ownerId || ''} onChange={(v) => setEditing({ ...editing, ownerId: v })} options={members.map((m) => ({ value: m.id, label: m.fullName || m.email }))} placeholder="—" /></Field>
              <Field label="Durum"><Select value={editing.status} onChange={(v) => setEditing({ ...editing, status: v })} options={STATUS_OPTS} /></Field>
            </div>
            <Field label="Not"><Input value={editing.note} onChange={(v) => setEditing({ ...editing, note: v })} /></Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setEditing(null)}>İptal</button>
              <button className="adm-btn adm-btn--primary" onClick={save}>Kaydet</button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => { store.deleteItem('sources', confirm.id).then(() => setConfirm(null)); }}
        title="Kaynağı sil?" message={confirm?.name} />
      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}

export default function SourcesPage() {
  return (
    <div>
      <SourceRegistry />
      <GitHubScan />
    </div>
  );
}
