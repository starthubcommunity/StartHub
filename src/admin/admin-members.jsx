// admin-members.jsx — Yönetim paneli üye yönetimi (yalnızca role === 'admin').
// admin_members CRUD + admin_member_accounts görünümünden hesap durumu +
// davet / sıfırlama linki (invite-member, area: 'admin').
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AIcon, PageHead, Field, Input, Modal, ConfirmDialog } from './admin-ui';

const ROLES = [
  { value: 'admin',  label: 'Admin (tam yetki)' },
  { value: 'editor', label: 'Editor (yalnızca Yazılar + Analitik)' },
];
const BLANK = { email: '', full_name: '', role: 'editor', active: true };
const fmt = (v) => (v ? new Date(v).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

function AdminMembersPage() {
  const [rows, setRows] = useState([]);        // admin_member_accounts
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('admin_member_accounts').select('*').order('email');
    if (error) flash('Yüklenemedi: ' + error.message);
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async ({ thenInvite = false } = {}) => {
    const e = editing;
    if (!e.email.trim()) { flash('E-posta zorunlu.'); return; }
    const email = e.email.trim().toLowerCase();
    const payload = { email, full_name: e.full_name || null, role: e.role, active: e.active };
    const res = e.id
      ? await supabase.from('admin_members').update(payload).eq('id', e.id)
      : await supabase.from('admin_members').insert(payload);
    if (res.error) { flash('Hata: ' + res.error.message); return; }
    setEditing(null);
    if (thenInvite) { await invite(email); }
    else flash('Kaydedildi.');
    load();
  };

  const toggleActive = async (m) => {
    const res = await supabase.from('admin_members').update({ active: !m.active }).eq('id', m.id);
    if (res.error) { flash('Hata: ' + res.error.message); return; }
    flash(m.active ? 'Pasifleştirildi.' : 'Aktifleştirildi.');
    load();
  };

  const remove = async (id) => {
    const res = await supabase.from('admin_members').delete().eq('id', id);
    setConfirm(null);
    if (res.error) { flash('Silinemedi: ' + res.error.message); return; }
    flash('Üye silindi.');
    load();
  };

  const invite = async (email) => {
    try { await supabase.functions.invoke('invite-member', { body: { email, area: 'admin' } }); }
    catch (_) { /* yanıt her durumda aynı */ }
    flash('Bağlantı gönderildi (yetkiliyse).');
  };

  return (
    <div>
      <PageHead title="Üyeler" desc="Yönetim paneli erişimi. Yetki e-posta üzerinden çözülür; RLS asıl kapıdır."
        actions={<button className="adm-btn adm-btn--primary" onClick={() => setEditing({ ...BLANK })}><AIcon name="edit" size={15} /> Üye ekle</button>} />

      {loading ? <div className="adm-empty">Yükleniyor…</div> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>E-posta</th><th>Ad</th><th>Rol</th><th>Durum</th>
                <th>Hesap</th><th>Son giriş</th><th>Doğrulandı</th><th style={{ width: 220 }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>{r.full_name || '—'}</td>
                  <td>{r.role}</td>
                  <td>{r.active ? 'aktif' : 'pasif'}</td>
                  <td>{r.has_account ? '✓ var' : '— yok'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmt(r.last_sign_in_at)}</td>
                  <td>{r.email_confirmed ? '✓' : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => invite(r.email)}>
                        {r.has_account ? 'Sıfırlama linki' : 'Davet gönder'}
                      </button>
                      <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => toggleActive(r)}>
                        {r.active ? 'Pasifleştir' : 'Aktifleştir'}
                      </button>
                      <button className="adm-icon-btn" title="Düzenle" onClick={() => setEditing(r)}><AIcon name="edit" size={14} /></button>
                      <button className="adm-icon-btn adm-icon-btn--danger" title="Sil (kalıcı)" onClick={() => setConfirm(r)}><AIcon name="trash" size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8}><div className="adm-empty">Üye yok.</div></td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Üyeyi düzenle' : 'Yeni üye'}>
        {editing && (
          <div>
            <Field label="E-posta" required><Input value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} /></Field>
            <Field label="Ad"><Input value={editing.full_name || ''} onChange={(v) => setEditing({ ...editing, full_name: v })} /></Field>
            <Field label="Rol">
              <select className="adm-input adm-select" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Durum">
              <select className="adm-input adm-select" value={editing.active ? '1' : '0'} onChange={(e) => setEditing({ ...editing, active: e.target.value === '1' })}>
                <option value="1">Aktif</option><option value="0">Pasif</option>
              </select>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setEditing(null)}>İptal</button>
              {editing.id ? (
                <button className="adm-btn adm-btn--primary" onClick={() => save()}>Kaydet</button>
              ) : (
                <>
                  <button className="adm-btn adm-btn--ghost" onClick={() => save()}>Yalnızca kaydet</button>
                  <button className="adm-btn adm-btn--primary" onClick={() => save({ thenInvite: true })}>Kaydet + Davet gönder</button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => remove(confirm.id)}
        title="Üyeyi sil?" message={`${confirm?.email} yönetim erişiminden çıkarılacak. (Auth hesabı silinmez.)`} />

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--adm-text)', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, zIndex: 1200 }}>{toast}</div>}
    </div>
  );
}

export { AdminMembersPage };
