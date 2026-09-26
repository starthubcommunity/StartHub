// permissions-screen.jsx — "Yetkiler" ekranı. Hem /admin/ hem /hub/ kullanır
// (area prop'u ile ayrışır). members.manage yetkisi olana görünür.
// Sol: üye listesi + ekle/davet.  Sağ: seçili üyenin yetki matrisi.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { AIcon, PageHead, Field, Input } from './admin-ui';

// project_owner artık atanabilir değil (2026-09-23 — proje sahipleri HR'a
// giremiyor, bkz. hub-app.jsx ProjectOwnerRedirectPage). Eski satırlarda rol
// hâlâ 'project_owner' olarak durabilir (silinmedi), bu yüzden seçili üye o
// rolse <select> onu göstermeye devam eder — yalnızca YENİ atama listeden çıktı.
const ROLE_OPTS = {
  admin: [{ v: 'admin', l: 'Admin' }, { v: 'editor', l: 'Editor' }],
  hub: [{ v: 'cofounder', l: 'Kurucu' }, { v: 'recruiter', l: 'İşe alım' }],
};
const fmt = (v) => (v ? new Date(v).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

function Switch({ on, disabled, onChange, title }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} title={title}
      onClick={() => !disabled && onChange(!on)}
      style={{
        width: 38, height: 22, borderRadius: 999, border: 'none', position: 'relative', flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        background: on ? '#16A34A' : '#D6D3D1', transition: 'background .15s',
      }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}

export default function PermissionsScreen({ area }) {
  const table = area === 'admin' ? 'admin_members' : 'hub_members';
  const accountsView = area === 'admin' ? 'admin_member_accounts' : 'hub_member_accounts';

  const [members, setMembers] = useState([]);
  const [status, setStatus] = useState({});     // id -> { has_account, last_sign_in_at }
  const [catalog, setCatalog] = useState([]);   // permission_keys (area)
  const [presetsByRole, setPresetsByRole] = useState({}); // role -> Set(key)
  const [selId, setSelId] = useState(null);
  const [eff, setEff] = useState([]);           // effective_permissions of selected
  const [meEmail, setMeEmail] = useState('');
  const [adding, setAdding] = useState(null);   // {} | null
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const [{ data: mem }, { data: st }, { data: keys }, { data: pres }, { data: u }] = await Promise.all([
      supabase.from(table).select('id,email,full_name,role,active,permissions').order('email'),
      supabase.from(accountsView).select('id,has_account,last_sign_in_at,email_confirmed'),
      supabase.from('permission_keys').select('*').eq('area', area).order('sort_order'),
      supabase.from('permission_presets').select('role,key').eq('area', area),
      supabase.auth.getUser(),
    ]);
    setMembers(mem || []);
    setStatus(Object.fromEntries((st || []).map((r) => [r.id, r])));
    setCatalog(keys || []);
    const pr = {};
    for (const p of pres || []) { (pr[p.role] ||= new Set()).add(p.key); }
    setPresetsByRole(pr);
    setMeEmail((u?.user?.email || '').toLowerCase());
    setLoading(false);
    if (!selId && mem?.length) setSelId(mem[0].id);
  }, [table, accountsView, area, selId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const loadEff = useCallback(async (id) => {
    if (!id) { setEff([]); return; }
    const { data } = await supabase.rpc('effective_permissions', { p_area: area, p_member: id });
    setEff(data || []);
  }, [area]);
  useEffect(() => { loadEff(selId); }, [selId, loadEff, members]);

  const selected = members.find((m) => m.id === selId) || null;
  const isSelf = selected && meEmail && selected.email.toLowerCase() === meEmail;
  const presetVal = (role, key) => (presetsByRole[role] || new Set()).has(key);
  const overriddenCount = useMemo(
    () => members.filter((m) => m.permissions && Object.keys(m.permissions).length > 0).length,
    [members]
  );

  const patchPerms = async (id, nextPerms) => {
    const { error } = await supabase.from(table).update({ permissions: nextPerms }).eq('id', id);
    if (error) { flash('Hata: ' + error.message); return false; }
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, permissions: nextPerms } : m)));
    return true;
  };

  const toggle = async (key, nextGranted) => {
    if (!selected) return;
    if (key === 'members.manage' && isSelf && !nextGranted) { flash('Kendi üye yönetimi yetkini kapatamazsın.'); return; }
    const cur = { ...(selected.permissions || {}) };
    if (nextGranted === presetVal(selected.role, key)) delete cur[key];   // şablona eşit → istisna kaldır
    else cur[key] = nextGranted;
    const ok = await patchPerms(selected.id, cur);
    if (ok) loadEff(selected.id);
  };

  const resetKey = async (key) => {
    if (!selected) return;
    const cur = { ...(selected.permissions || {}) };
    delete cur[key];
    if (await patchPerms(selected.id, cur)) { loadEff(selected.id); flash('Satır şablona döndürüldü.'); }
  };
  const resetAll = async () => {
    if (!selected) return;
    if (await patchPerms(selected.id, {})) { loadEff(selected.id); flash('Tüm yetkiler şablona döndürüldü.'); }
  };

  const changeRole = async (role) => {
    if (!selected) return;
    const hadOverrides = Object.keys(selected.permissions || {}).length > 0;
    const { error } = await supabase.from(table).update({ role }).eq('id', selected.id);
    if (error) { flash('Hata: ' + error.message); return; }
    setMembers((ms) => ms.map((m) => (m.id === selected.id ? { ...m, role } : m)));
    loadEff(selected.id);
    flash(hadOverrides ? 'Rol değişti — şablon değişti, kişisel istisnalar korundu.' : 'Rol değişti.');
  };

  const toggleActive = async (m) => {
    const { error } = await supabase.from(table).update({ active: !m.active }).eq('id', m.id);
    if (error) { flash('Hata: ' + error.message); return; }
    setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, active: !x.active } : x)));
    flash(m.active ? 'Pasifleştirildi.' : 'Aktifleştirildi.');
  };

  const invite = async (email) => {
    try { await supabase.functions.invoke('invite-member', { body: { email, area } }); }
    catch (_) { /* yanıt her durumda aynı */ }
    flash('Bağlantı gönderildi (yetkiliyse).');
  };

  const saveNew = async ({ thenInvite }) => {
    const a = adding;
    if (!a.email.trim()) { flash('E-posta zorunlu.'); return; }
    const email = a.email.trim().toLowerCase();
    const { error } = await supabase.from(table).insert({ email, full_name: a.full_name || null, role: a.role });
    if (error) { flash('Hata: ' + error.message); return; }
    setAdding(null);
    if (thenInvite) await invite(email);
    loadMembers();
  };

  const groups = useMemo(() => {
    const g = new Map();
    for (const k of catalog) { if (!g.has(k.grp)) g.set(k.grp, []); g.get(k.grp).push(k); }
    return [...g.entries()];
  }, [catalog]);
  const effByKey = Object.fromEntries(eff.map((e) => [e.key, e]));

  if (loading) return <div className="adm-empty">Yükleniyor…</div>;

  return (
    <div>
      <PageHead title="Yetkiler"
        desc={`${members.length} üye · ${overriddenCount} kişi özelleştirilmiş yetkiye sahip. Rol bir başlangıç şablonu; kişi bazlı istisna üstüne yazılır.`}
        actions={<button className="adm-btn adm-btn--primary" onClick={() => setAdding({ email: '', full_name: '', role: ROLE_OPTS[area][1].v })}><AIcon name="edit" size={15} /> Üye ekle</button>} />

      <div className="hub-perm-grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18, alignItems: 'start' }}>
        {/* SOL — üye listesi */}
        <div style={{ border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-r)', overflow: 'hidden', background: 'var(--adm-bg-card)' }}>
          {members.map((m) => {
            const s = status[m.id] || {};
            const on = m.id === selId;
            return (
              <button key={m.id} onClick={() => setSelId(m.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--adm-border-light)', background: on ? 'var(--adm-bg-hover)' : 'none', cursor: 'pointer', padding: '10px 12px', fontFamily: 'var(--font-body)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--adm-text)' }}>{m.full_name || m.email}</div>
                <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)' }}>{m.email}</div>
                <div style={{ fontSize: 11, marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="adm-badge adm-badge--tag">{m.role}</span>
                  <span style={{ color: m.active ? 'var(--adm-green)' : 'var(--adm-text-dim)' }}>{m.active ? 'aktif' : 'pasif'}</span>
                  <span style={{ color: 'var(--adm-text-dim)' }}>{s.has_account ? `giriş ${fmt(s.last_sign_in_at)}` : 'hesap yok'}</span>
                  {Object.keys(m.permissions || {}).length > 0 && <span style={{ color: 'var(--adm-purple)' }}>özelleştirilmiş</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* SAĞ — yetki matrisi */}
        {!selected ? <div className="adm-empty">Bir üye seç.</div> : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 15 }}>{selected.full_name || selected.email}</strong>
              <select className="adm-input adm-select" style={{ width: 'auto' }} value={selected.role} onChange={(e) => changeRole(e.target.value)}>
                {ROLE_OPTS[area].map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
              </select>
              <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => invite(selected.email)}>
                {status[selected.id]?.has_account ? 'Sıfırlama linki' : 'Davet gönder'}
              </button>
              <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => toggleActive(selected)}>
                {selected.active ? 'Pasifleştir' : 'Aktifleştir'}
              </button>
              <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ marginLeft: 'auto' }} onClick={resetAll}>Tümünü şablona döndür</button>
            </div>

            {groups.map(([grp, keys]) => (
              <div key={grp} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--adm-text-dim)', margin: '0 0 6px' }}>{grp}</div>
                <div style={{ border: '1px solid var(--adm-border-light)', borderRadius: 'var(--adm-r-sm)' }}>
                  {keys.map((k) => {
                    const e = effByKey[k.key] || { granted: false, overridden: false };
                    const selfLock = k.key === 'members.manage' && isSelf;
                    return (
                      <div key={k.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--adm-border-light)' }}>
                        <Switch on={e.granted} disabled={selfLock} onChange={(v) => toggle(k.key, v)}
                          title={selfLock ? 'Kendi üye yönetimi yetkini kapatamazsın' : ''} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: 'var(--adm-text)' }}>{k.label}
                            {e.overridden && <span style={{ color: 'var(--adm-purple)', fontSize: 11, marginLeft: 6 }}>özelleştirilmiş</span>}
                            {selfLock && <span style={{ color: 'var(--adm-text-dim)', fontSize: 11, marginLeft: 6 }}>kendinde kapatılamaz</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{k.key}</div>
                        </div>
                        {e.overridden && !selfLock && (
                          <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => resetKey(k.key)}>şablona dön</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {adding && (
        <div className="adm-modal-overlay" onClick={() => setAdding(null)}>
          <div className="adm-modal adm-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal__header"><h3>Yeni üye</h3><button className="adm-icon-btn" onClick={() => setAdding(null)}><AIcon name="x" size={18} /></button></div>
            <div className="adm-modal__body">
              <Field label="E-posta" required><Input value={adding.email} onChange={(v) => setAdding({ ...adding, email: v })} /></Field>
              <Field label="Ad"><Input value={adding.full_name} onChange={(v) => setAdding({ ...adding, full_name: v })} /></Field>
              <Field label="Rol">
                <select className="adm-input adm-select" value={adding.role} onChange={(e) => setAdding({ ...adding, role: e.target.value })}>
                  {ROLE_OPTS[area].map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="adm-btn adm-btn--ghost" onClick={() => saveNew({ thenInvite: false })}>Yalnızca kaydet</button>
                <button className="adm-btn adm-btn--primary" onClick={() => saveNew({ thenInvite: true })}>Kaydet + Davet gönder</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--adm-text)', color: 'var(--adm-text-inverse)', padding: '10px 18px', borderRadius: 8, fontSize: 13, zIndex: 1200 }}>{toast}</div>}
    </div>
  );
}
