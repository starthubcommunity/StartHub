// settings.jsx — Ayarlar (§15). YALNIZCA cofounder.
// Üye yönetimi · rubrik/eşik (şimdilik salt okunur) · kırmızı bayrak listesi ·
// KVKK "adayı tamamen sil" · hub-daily elle tetikleme.
import React, { useState } from 'react';
import { AIcon, Field, Input, Select, Modal, ConfirmDialog } from '../../admin/admin-ui';
import { supabase } from '../../lib/supabase';
import { useHubStore } from '../hub-store';
import { useHubMember } from '../hub-member';
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
  const role = useHubMember();

  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState('');
  const [purgeConfirm, setPurgeConfirm] = useState(false);
  const [dailyOut, setDailyOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  if (role !== 'cofounder') {
    return <div className="adm-empty">Ayarlar yalnızca kurucu rolünde açıktır.</div>;
  }

  const saveMember = async () => {
    if (!editing.email.trim()) { flash('E-posta zorunlu.'); return; }
    try {
      if (editing.id) await store.updateItem('members', editing.id, editing);
      else await store.addItem('members', editing);
      setEditing(null);
    } catch (e) { flash('Hata: ' + e.message); }
  };

  const runDaily = async () => {
    setBusy(true); setDailyOut(null);
    try {
      const { data, error } = await supabase.functions.invoke('hub-daily');
      if (error) throw error;
      setDailyOut(data);
    } catch (e) { setDailyOut({ error: e.message }); }
    setBusy(false);
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
        <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setEditing({ ...BLANK_MEMBER })}>
          <AIcon name="edit" size={14} /> Üye ekle
        </button>
      </div>
      <div className="hub-grid-wrap" style={{ maxHeight: 'none' }}>
        <table className="adm-table" style={{ width: '100%' }}>
          <thead><tr><th>E-posta</th><th>Ad</th><th>Rol</th><th>Kapsam</th><th>Durum</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.email}{m.userId ? '' : ' (hesap yok)'}</td>
                <td>{m.fullName || '—'}</td>
                <td>{HUB_ROLE_LABEL[m.role] || m.role}</td>
                <td>{(m.startupIds || []).join(', ') || '—'}</td>
                <td>{m.active ? 'aktif' : 'pasif'}</td>
                <td>
                  <div className="adm-table__actions">
                    <button className="adm-icon-btn" title="Düzenle" onClick={() => setEditing(m)}><AIcon name="edit" size={14} /></button>
                    <button className="adm-icon-btn adm-icon-btn--danger" title="Sil" onClick={() => setConfirm(m)}><AIcon name="trash" size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
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
        <li>Bayatlama: contacted {STALE.contacted.warn}/{STALE.contacted.critical}g · interviewed {STALE.interviewed.warn}/{STALE.interviewed.critical}g · replied {STALE.replied.warn}/{STALE.replied.critical}g · finalist {STALE.finalist.warn}/{STALE.finalist.critical}g</li>
        <li>Kapılar: A {GATE.aHours} saat · B {GATE.bDays} gün</li>
      </ul>

      <h3 className="hub-h4" style={{ marginTop: 24 }}>Kırmızı bayrak listesi</h3>
      <ul style={{ fontSize: 13, color: 'var(--adm-text-secondary)', margin: '0 0 4px 18px' }}>
        {RED_FLAGS.map((f) => <li key={f.value}><strong>{f.label}</strong> — {f.hint}</li>)}
      </ul>

      {/* ── Otomasyon ── */}
      <h3 className="hub-h4" style={{ marginTop: 28 }}>Otomasyon</h3>
      <p style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 8 }}>
        <code>hub-daily</code> her gece 03:00'te çalışır (pg_cron). Elle tetikleyip sonucu görebilirsin.
        Otomatik arşivleme yalnızca <code>no_reply</code> içindir.
      </p>
      <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy} onClick={runDaily}>
        <AIcon name="refresh" size={14} /> hub-daily'yi şimdi çalıştır
      </button>
      {dailyOut && (
        <pre style={{ fontSize: 12, background: 'var(--adm-bg-hover)', padding: 10, borderRadius: 6, marginTop: 8, overflowX: 'auto' }}>
          {JSON.stringify(dailyOut, null, 2)}
        </pre>
      )}

      {/* ── KVKK ── */}
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
        onConfirm={() => { store.deleteItem('members', confirm.id).then(() => setConfirm(null)); }}
        title="Üyeyi sil?" message={`${confirm?.email} kütükten çıkarılacak.`} />
      <ConfirmDialog open={purgeConfirm} onClose={() => setPurgeConfirm(false)} onConfirm={purge}
        title="Adayı tamamen sil?" message="Bu işlem tüm bağlı kayıtları ve ham metni siler. Geri alınamaz." />

      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}
