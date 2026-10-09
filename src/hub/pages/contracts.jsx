// contracts.jsx — Sözleşme Metinleri (HR › Yönetim, equity.read; yayınlama equity.manage).
// 0060 (A): kurucu ve üye için ayrı, sürümlü metinler. Yayınlanan sürüm
// DEĞİŞTİRİLEMEZ (DB tetikleyicisi) — düzeltme = yeni sürüm. Her kabul kaydı
// kendi metin kopyasını taşır; yeni sürüm eski onayları etkilemez.
// Gönderim ayarı: test modu açıkken (ve metin yer tutucuyken) sözleşme yalnızca
// test adreslerine gider; "Canlıya aç" yalnızca cofounder, tek onaylı adım.
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AIcon, PageHead, Modal, Field, Input, Textarea } from '../../admin/admin-ui';
import { usePerms } from '../../lib/use-perms';
import {
  CONTRACT_KINDS, CONTRACT_KIND_LABEL, CONTRACT_FIELDS, unknownFields, renderContract, contractVars, contractTerms,
  mapTemplateFromDb, mapSettingsFromDb, mapAcceptanceFromDb,
} from '../../lib/contract-render';

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const textBox = { whiteSpace: 'pre-wrap', background: 'var(--adm-bg)', border: '1px solid var(--adm-border)', borderRadius: 10, padding: '12px 14px', lineHeight: 1.55, fontSize: 13, maxHeight: 360, overflowY: 'auto' };

// Önizleme için örnek değerler (gerçek kişi değil)
const SAMPLE = {
  founder: contractTerms({ grant: { holderName: 'Örnek Kişi', holderEmail: 'ornek@ornek.com', grantPct: 30, schedule: 'lead_hybrid', vestMonths: 36, cliffMonths: 6, milestoneBonusPct: 5 }, seat: { title: 'Team Lead' }, projectName: 'Örnek Proje', weeklyHours: 10 }),
  member: contractTerms({ grant: { holderName: 'Örnek Kişi', holderEmail: 'ornek@ornek.com', grantPct: 10, schedule: 'time', vestMonths: 12, cliffMonths: 6 }, seat: { title: 'Mobil geliştirici' }, projectName: 'Örnek Proje', weeklyHours: 8 }),
};

function PlaceholderPill() {
  return <span className="hub-pill" style={{ background: '#FEF3C7', color: '#92400E', borderColor: 'transparent' }}>Yer tutucu</span>;
}

// ── Gönderim ayarı ──────────────────────────────────────────────────────
function SendingCard({ settings, anyPlaceholder, canManage, onChanged }) {
  const [ask, setAsk] = useState(null);   // 'live' | 'test'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const apply = async () => {
    setBusy(true); setErr('');
    const { error, data } = await supabase.from('contract_settings').update({ test_mode: ask === 'test' }).eq('id', 1).select('id');
    setBusy(false);
    if (error || !data?.length) { setErr(error?.message || 'Yetkin yok.'); return; }
    setAsk(null); onChanged();
  };
  return (
    <div className="adm-card" style={{ marginBottom: 16 }}>
      <div className="adm-card__body">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700 }}>Gönderim: {settings.testMode ? 'Test modu' : 'Canlı'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--adm-text-secondary)', marginTop: 2 }}>
              {settings.testMode
                ? <>Sözleşme yalnızca şu adreslere gönderilebilir: <b>{settings.testEmails.join(', ')}</b>. Başka adrese gönderim sunucuda reddedilir.</>
                : <>Sözleşme ilgili kişiye gönderilir. Canlıya açan: {settings.liveEnabledBy || '—'} · {fmtDateTime(settings.liveEnabledAt)}</>}
            </div>
            {anyPlaceholder && (
              <div style={{ fontSize: 12.5, color: '#92400E', marginTop: 6 }}>
                Yer tutucu metin yayındayken, canlı modda bile o metin yalnızca test adreslerine gider. Gerçek metni yeni sürüm olarak yayınlayınca bu kilit kalkar.
              </div>
            )}
          </div>
          {canManage && (settings.testMode
            ? <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setAsk('live')}>Canlıya aç</button>
            : <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setAsk('test')}>Test moduna dön</button>)}
        </div>
      </div>
      {ask && (
        <Modal open onClose={() => !busy && setAsk(null)} title={ask === 'live' ? 'Gönderimi canlıya aç' : 'Test moduna dön'}>
          <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
            {ask === 'live'
              ? <>Bundan sonra “Sözleşmeyi gönder”, sözü olan <b>gerçek kişiye</b> mail atar. {anyPlaceholder && <>Yer tutucu metinler yine yalnızca test adreslerine gider.</>} Bu adım kayda geçer (kim, ne zaman).</>
              : <>Gönderim yeniden yalnızca test adreslerine ({settings.testEmails.join(', ')}) sınırlanır.</>}
          </div>
          {err && <div style={{ fontSize: 12.5, color: 'var(--adm-red)', marginTop: 10 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button className="adm-btn adm-btn--ghost" onClick={() => setAsk(null)} disabled={busy}>Vazgeç</button>
            <button className="adm-btn adm-btn--primary" onClick={apply} disabled={busy}>
              {busy ? 'Bekle…' : ask === 'live' ? 'Canlıya aç, evet eminim' : 'Evet, test moduna dön'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Yeni sürüm formu ────────────────────────────────────────────────────
function PublishForm({ kind, current, onClose, onPublished }) {
  const [f, setF] = useState({ title: current?.title || '', body: current?.body || '', note: '' });
  const [step, setStep] = useState('edit');   // 'edit' | 'confirm'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const unknown = unknownFields(f.body);
  const placeholder = /YER TUTUCU/i.test(f.body);
  const unchanged = current && f.body.replace(/\r\n/g, '\n') === current.body.replace(/\r\n/g, '\n') && f.title === current.title;
  const next = () => {
    if (!f.title.trim()) { setErr('Başlık zorunlu.'); return; }
    if (f.body.trim().length < 20) { setErr('Metin çok kısa.'); return; }
    if (unchanged) { setErr('Metin önceki sürümle aynı.'); return; }
    setErr(''); setStep('confirm');
  };
  const publish = async () => {
    setBusy(true); setErr('');
    const { data, error } = await supabase.from('contract_templates')
      .insert({ kind, version: 0, title: f.title.trim(), body: f.body, note: f.note.trim() || null }).select('version').single();
    setBusy(false);
    if (error) { setErr(error.message); setStep('edit'); return; }
    onPublished(data.version);
  };
  return (
    <Modal open onClose={() => !busy && onClose()} title={`${CONTRACT_KIND_LABEL[kind]} — yeni sürüm`}>
      {step === 'edit' ? (
        <form className="adm-form" onSubmit={(e) => { e.preventDefault(); next(); }}>
          <Field label="Başlık" required><Input value={f.title} onChange={(v) => setF((p) => ({ ...p, title: v }))} /></Field>
          <Field label="Metin" required hint="Süslü parantezli alanlar sözden doldurulur (aşağıdaki liste).">
            <Textarea rows={14} value={f.body} onChange={(v) => setF((p) => ({ ...p, body: v }))} />
          </Field>
          <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', margin: '-4px 0 10px', lineHeight: 1.6, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0 12px' }}>
            {CONTRACT_FIELDS.map(([k, label]) => <span key={k} style={{ overflowWrap: 'anywhere' }}><code>{`{${k}}`}</code> {label}</span>)}
          </div>
          {unknown.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--adm-red)', marginBottom: 8 }}>Tanınmayan alan: {unknown.map((u) => `{${u}}`).join(', ')} — olduğu gibi görünür.</div>}
          {placeholder && <div style={{ fontSize: 12.5, color: '#92400E', marginBottom: 8 }}>Metinde “YER TUTUCU” geçiyor — bu sürüm de yer tutucu sayılır, yalnızca test adreslerine gönderilebilir.</div>}
          <Field label="Sürüm notu (isteğe bağlı)"><Input value={f.note} onChange={(v) => setF((p) => ({ ...p, note: v }))} placeholder="Neyi değiştirdin?" /></Field>
          <div className="adm-form__footer">
            {err && <span className="adm-form__err">{err}</span>}
            <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>İptal</button>
            <button type="submit" className="adm-btn adm-btn--primary">Devam</button>
          </div>
        </form>
      ) : (
        <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
          <b>{CONTRACT_KIND_LABEL[kind]}</b> metninin <b>v{(current?.version || 0) + 1}</b> sürümünü yayınlıyorsun.
          Yayınlanan sürüm değiştirilemez; bundan sonra gönderilen sözleşmeler bu metni kullanır. Daha önce gönderilmiş ya da onaylanmış sözleşmeler kendi sürümünde kalır.
          {!placeholder && current?.isPlaceholder && <div style={{ marginTop: 8, color: 'var(--adm-green, #15803D)' }}>Bu sürüm yer tutucu değil — yayınlanınca bu metin için yer tutucu kilidi kalkar.</div>}
          {err && <div style={{ fontSize: 12.5, color: 'var(--adm-red)', marginTop: 10 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button className="adm-btn adm-btn--ghost" onClick={() => setStep('edit')} disabled={busy}>Düzenlemeye dön</button>
            <button className="adm-btn adm-btn--primary" onClick={publish} disabled={busy}>{busy ? 'Yayınlanıyor…' : 'Evet, yayınla'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function ContractsPage() {
  const { can } = usePerms();
  const canManage = can('equity.manage');
  const [kind, setKind] = useState('member');
  const [rows, setRows] = useState({ templates: [], settings: mapSettingsFromDb(null), acceptances: [], loading: true, err: '' });
  const [publishing, setPublishing] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = async () => {
    const [t, s, a] = await Promise.all([
      supabase.from('contract_templates').select('*').order('version', { ascending: false }),
      supabase.from('contract_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('contract_acceptances').select('id, grant_id, template_kind, template_version, holder_email, typed_name, accepted_at, ip, text_sha256').order('accepted_at', { ascending: false }).limit(50),
    ]);
    const err = t.error || s.error || a.error;
    setRows({
      templates: (t.data || []).map(mapTemplateFromDb),
      settings: mapSettingsFromDb(s.data),
      acceptances: (a.data || []).map(mapAcceptanceFromDb),
      loading: false, err: err ? err.message : '',
    });
  };
  useEffect(() => { load(); }, []);

  const versions = useMemo(() => rows.templates.filter((t) => t.kind === kind), [rows.templates, kind]);
  const current = versions[0] || null;
  const latestOf = (k) => rows.templates.find((t) => t.kind === k);
  const anyPlaceholder = CONTRACT_KINDS.some((k) => latestOf(k.value)?.isPlaceholder);

  return (
    <div>
      <PageHead title="Sözleşme Metinleri" desc="Pay sözü sözleşmesinin sürümlü metinleri. Yeni sürüm, daha önce onaylanmış sözleşmeleri değiştirmez." />
      {toast && <div className="adm-toast">{toast}</div>}
      {rows.err && <div className="adm-empty" style={{ color: 'var(--adm-red)' }}>Yüklenemedi: {rows.err}</div>}
      {rows.loading ? <div style={{ textAlign: 'center', padding: 32, color: 'var(--adm-text-dim)' }}>Yükleniyor…</div> : (
        <>
          <SendingCard settings={rows.settings} anyPlaceholder={anyPlaceholder} canManage={canManage} onChanged={() => { load(); flash('Gönderim ayarı güncellendi.'); }} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            {CONTRACT_KINDS.map((k) => (
              <button key={k.value} type="button" className={`adm-chip ${kind === k.value ? 'adm-chip--active' : ''}`} onClick={() => { setKind(k.value); setShowSample(false); }}>
                {k.label}{latestOf(k.value) ? ` · v${latestOf(k.value).version}` : ''}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {canManage && (
              <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setPublishing(true)}>
                <AIcon name="plus" size={14} /> Yeni sürüm yayınla
              </button>
            )}
          </div>

          {!current ? <div className="adm-empty">Bu tür için yayınlanmış metin yok.</div> : (
            <div className="adm-card" style={{ marginBottom: 16 }}>
              <div className="adm-card__body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{current.title}</div>
                  <span className="hub-pill">v{current.version} · geçerli</span>
                  {current.isPlaceholder && <PlaceholderPill />}
                </div>
                <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', margin: '2px 0 10px' }}>
                  Yayınlandı {fmtDateTime(current.publishedAt)} · {current.publishedBy || '—'}{current.note ? ` · ${current.note}` : ''}
                </div>
                <div style={textBox}>{showSample ? renderContract(current.body, contractVars(SAMPLE[kind], ['Kurucu 1', 'Kurucu 2'])) : current.body}</div>
                <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" style={{ marginTop: 8 }} onClick={() => setShowSample((v) => !v)}>
                  {showSample ? 'Alanları göster' : 'Örnek değerlerle önizle'}
                </button>
              </div>
            </div>
          )}

          {versions.length > 1 && (
            <div className="adm-card" style={{ marginBottom: 16 }}>
              <div className="adm-card__body">
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Önceki sürümler</div>
                {versions.slice(1).map((v) => (
                  <details key={v.id} style={{ margin: '6px 0' }}>
                    <summary style={{ cursor: 'pointer', fontSize: 13 }}>
                      v{v.version} · {fmtDateTime(v.publishedAt)}{v.isPlaceholder ? ' · yer tutucu' : ''}{v.note ? ` · ${v.note}` : ''}
                    </summary>
                    <div style={{ ...textBox, marginTop: 6 }}>{v.body}</div>
                  </details>
                ))}
              </div>
            </div>
          )}

          <div className="adm-card">
            <div className="adm-card__body">
              <div style={{ fontWeight: 700 }}>Kabul kayıtları</div>
              <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', margin: '2px 0 10px' }}>
                Değiştirilemez ve silinemez. Her kayıt onaylanan metnin kopyasını ve parmak izini taşır — ayrıntı Pay Sözleri’nde sözün geçmişinde.
              </div>
              {rows.acceptances.length === 0 ? <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Henüz onaylanmış sözleşme yok.</div> : (
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead><tr><th>Onaylayan</th><th>Metin</th><th>Zaman</th><th>IP</th></tr></thead>
                    <tbody>
                      {rows.acceptances.map((a) => (
                        <tr key={a.id}>
                          <td><div style={{ fontWeight: 600 }}>{a.typedName}</div><div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>{a.holderEmail}</div></td>
                          <td>{CONTRACT_KIND_LABEL[a.templateKind]} v{a.templateVersion}</td>
                          <td>{fmtDateTime(a.acceptedAt)}</td>
                          <td style={{ fontSize: 12 }}>{a.ip || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {publishing && <PublishForm kind={kind} current={current} onClose={() => setPublishing(false)}
        onPublished={(v) => { setPublishing(false); load(); flash(`v${v} yayınlandı.`); }} />}
    </div>
  );
}
