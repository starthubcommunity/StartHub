// settings.jsx — Ayarlar (§15). YALNIZCA cofounder.
// Üye yönetimi · rubrik/eşik (şimdilik salt okunur) · kırmızı bayrak listesi ·
// KVKK "adayı tamamen sil". v2: cron / gece işi yok.
import React, { useState, useEffect } from 'react';
import { AIcon, Field, Input, Select, Modal, ConfirmDialog } from '../../admin/admin-ui';
import { supabase } from '../../lib/supabase';
import { useHubStore } from '../hub-store';
import { usePerms } from '../../lib/use-perms';
import {
  HUB_ROLES, HUB_ROLE_LABEL, RUBRIC_AXES, RED_FLAGS, THRESHOLD, STALE, GATE,
} from '../hub-constants';

const BLANK_MEMBER = { email: '', fullName: '', role: 'recruiter', startupIds: [], active: true };

function MemberForm({ value, onChange }) {
  return (
    <div>
      <Field label="E-posta" required><Input value={value.email} onChange={(v) => onChange({ ...value, email: v })} /></Field>
      <div className="adm-form-grid">
        <Field label="Ad"><Input value={value.fullName} onChange={(v) => onChange({ ...value, fullName: v })} /></Field>
        <Field label="Rol"><Select value={value.role} onChange={(v) => onChange({ ...value, role: v })} options={HUB_ROLES} /></Field>
      </div>
      <Field label="Proje kapsamı (startup_id, virgülle) — yalnızca project_owner" hint="Boş = tüm projeler yok">
        <Input value={(value.startupIds || []).join(',')}
          onChange={(v) => onChange({ ...value, startupIds: v.split(',').map((x) => x.trim()).filter(Boolean).map(Number) })} />
      </Field>
      <Field label="Aktif">
        <Select value={value.active ? '1' : '0'} onChange={(v) => onChange({ ...value, active: v === '1' })}
          options={[{ value: '1', label: 'Evet' }, { value: '0', label: 'Hayır' }]} />
      </Field>
    </div>
  );
}

export default function SettingsPage() {
  const store = useHubStore();
  const { members, candidates } = store;
  const { can } = usePerms();

  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState('');
  const [purgeConfirm, setPurgeConfirm] = useState(false);
  const [toast, setToast] = useState('');
  const [accounts, setAccounts] = useState({});   // memberId -> { has_account, last_sign_in_at, email_confirmed }
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  useEffect(() => {
    supabase.from('hub_member_accounts').select('*')
      .then(({ data }) => setAccounts(Object.fromEntries((data || []).map((a) => [a.id, a]))))
      .catch(() => {});
  }, [members.length]);

  if (!can('settings.write')) {
    return <div className="adm-empty">Ayarları düzenleme yetkin yok.</div>;
  }

  const fmtLogin = (v) => (v ? new Date(v).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
  const invite = async (email) => {
    try { await supabase.functions.invoke('invite-member', { body: { email, area: 'hub' } }); }
    catch (_) { /* yanıt her durumda aynı */ }
    flash('Bağlantı gönderildi (yetkiliyse).');
  };

  const saveMember = async () => {
    if (!editing.email.trim()) { flash('E-posta zorunlu.'); return; }
    try {
      if (editing.id) await store.updateItem('members', editing.id, editing);
      else await store.addItem('members', editing);
      setEditing(null);
    } catch (e) { flash('Hata: ' + e.message); }
  };


  const purge = async () => {
    setPurgeConfirm(false);
    try {
      await store.purgeCandidate(purgeTarget);
      setPurgeTarget('');
      flash('Aday ve tüm bağlı kayıtları silindi.');
    } catch (e) { flash('Silinemedi: ' + e.message); }
  };

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Ayarlar</h1>
          <p className="adm-page-head__desc">Yalnızca kurucu. Yetki RLS'te de uygulanır.</p>
        </div>
      </div>

      {/* ── Üyeler ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="hub-h4">Üyeler</h3>
        <button className="adm-btn adm-btn--primary adm-btn--sm adm-btn--cta" onClick={() => setEditing({ ...BLANK_MEMBER })}>
          <AIcon name="edit" size={14} /> Üye ekle
        </button>
      </div>
      <div className="adm-card" style={{ overflowX: 'auto' }}>
        <table className="adm-table" style={{ width: '100%' }}>
          <thead><tr>
            <th>E-posta</th><th>Ad</th><th>Rol</th><th>Kapsam</th><th>Durum</th>
            <th>Hesap</th><th>Son giriş</th><th>Doğr.</th><th style={{ width: 200 }}></th>
          </tr></thead>
          <tbody>
            {members.map((m) => {
              const a = accounts[m.id] || {};
              return (
              <tr key={m.id}>
                <td>{m.email}</td>
                <td>{m.fullName || '—'}</td>
                <td>{HUB_ROLE_LABEL[m.role] || m.role}</td>
                <td>{(m.startupIds || []).join(', ') || '—'}</td>
                <td>{m.active ? 'aktif' : 'pasif'}</td>
                <td>{a.has_account ? '✓ var' : '— yok'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtLogin(a.last_sign_in_at)}</td>
                <td>{a.email_confirmed ? '✓' : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => invite(m.email)}>
                      {a.has_account ? 'Sıfırlama linki' : 'Davet gönder'}
                    </button>
                    <button className="adm-icon-btn" title="Düzenle" onClick={() => setEditing(m)}><AIcon name="edit" size={14} /></button>
                    <button className="adm-icon-btn adm-icon-btn--danger" title="Sil" onClick={() => setConfirm(m)}><AIcon name="trash" size={14} /></button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Rubrik / eşik (salt okunur) ── */}
      <h3 className="hub-h4" style={{ marginTop: 28 }}>Rubrik ve eşik değerleri</h3>
      <div className="hub-ai" style={{ marginBottom: 10 }}>
        Bunlar şu an <code>src/hub/hub-constants.js</code>'te sabit. Arayüzden düzenlenebilir olması için
        bir <code>hub_settings</code> tablosu gerekir — bir sonraki migration'da eklenebilir.
      </div>
      <ul style={{ fontSize: 13, color: 'var(--adm-text-secondary)', margin: '0 0 4px 18px' }}>
        {RUBRIC_AXES.map((a) => <li key={a.value}><strong>{a.label}:</strong> {a.hint}</li>)}
        <li>Kurucu hattı eşiği: toplam ≥ {THRESHOLD.founder.minTotal}, her eksen ≥ {THRESHOLD.founder.minAxis}</li>
        <li>Üye hattı eşiği: bitirmişlik ≥ {THRESHOLD.member.minFinishing}, kapasite ≥ {THRESHOLD.member.minCapacity} (iletişim yalnızca rol gerektiriyorsa ≥ {THRESHOLD.member.minCommunication})</li>
        <li>Ortak: kırmızı bayrak &lt; {THRESHOLD.blockAtRedFlags} (ya da kurucu + override)</li>
        <li>Bayatlama (istemcide isStale): {Object.entries(STALE).map(([k, v]) => `${k} ${v.warn}/${v.critical}g`).join(' · ')}</li>
        <li>Kapılar: A {GATE.aHours} saat · B {GATE.bDays} gün · uzatma +1/+3/+7 gün</li>
      </ul>

      <h3 className="hub-h4" style={{ marginTop: 24 }}>Kırmızı bayrak listesi</h3>
      <ul style={{ fontSize: 13, color: 'var(--adm-text-secondary)', margin: '0 0 4px 18px' }}>
        {RED_FLAGS.map((f) => <li key={f.value}><strong>{f.label}</strong> — {f.hint}</li>)}
      </ul>

      {/* ── Otomasyon ── */}
      <h3 className="hub-h4" style={{ marginTop: 28 }}>Otomasyon</h3>
      <p style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 8 }}>
        v2'de gece işi / cron yok — bayatlama <code>isStale()</code> ile istemcide,
        aşama geçişleri senkron. Elle tetiklenecek bir şey yok.
      </p>

      {/* ── KVKK ── */}
      {can('candidates.purge') && (<>
        <h3 className="hub-h4" style={{ marginTop: 28 }}>KVKK — adayı tamamen sil</h3>
        <p style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 8 }}>
          Aday + tüm temas / görüşme / kapı / aşama kaydı + (o partide başka aday kalmadıysa) ham yapıştırma metni. Geri alınamaz.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="adm-input adm-select" style={{ maxWidth: 320 }} value={purgeTarget} onChange={(e) => setPurgeTarget(e.target.value)}>
            <option value="">Aday seç…</option>
            {[...candidates].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'tr'))
              .map((c) => <option key={c.id} value={c.id}>{c.fullName} — {c.email || c.github || '—'}</option>)}
          </select>
          <button className="adm-btn adm-btn--danger adm-btn--sm" disabled={!purgeTarget} onClick={() => setPurgeConfirm(true)}>
            Tamamen sil
          </button>
        </div>
      </>)}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Üyeyi düzenle' : 'Yeni üye'}>
        {editing && (
          <div>
            <MemberForm value={editing} onChange={setEditing} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setEditing(null)}>İptal</button>
              <button className="adm-btn adm-btn--primary" onClick={saveMember}>Kaydet</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => {
          store.deleteItem('members', confirm.id)
            .then(() => { setConfirm(null); flash('Üye silindi.'); })
            .catch((e) => {
              setConfirm(null);
              flash(/foreign key|violates|constraint/i.test(e.message || '')
                ? 'Bu üyenin geçmiş aktivitesi var — silmek yerine pasifleştir (Yetkiler ekranı).'
                : 'Silinemedi: ' + e.message);
            });
        }}
        title="Üyeyi sil?" message={`${confirm?.email} kütükten çıkarılacak.`} />
      <ConfirmDialog open={purgeConfirm} onClose={() => setPurgeConfirm(false)} onConfirm={purge}
        title="Adayı tamamen sil?" message="Bu işlem tüm bağlı kayıtları ve ham metni siler. Geri alınamaz." />

      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}
