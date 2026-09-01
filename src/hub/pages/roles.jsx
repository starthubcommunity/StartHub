// roles.jsx — Roller (v2 §10). Proje bazında gruplu liste, sade durum
// makinesi (draft → sourcing → shortlist → filled). Talep/onay el sıkışması
// YOK: rol doğrudan "sourcing"e düşer. Buton görünürlüğü has_perm() ile.
import React, { useState, useEffect, useMemo } from 'react';
import { AIcon, Field, Input, Textarea, Select, Modal, ConfirmDialog } from '../../admin/admin-ui';
import { supabase } from '../../lib/supabase';
import { useHubStore } from '../hub-store';
import { useHubMember } from '../hub-member';
import { usePerms } from '../../lib/use-perms';
import { ROLE_TYPES, ROLE_TYPE_LABEL, TRACKS, ROLE_STATUS_LABEL, ROLE_STATUS_NEXT, STAGE_LABEL, STAGE_ORDER } from '../hub-constants';

const STATUS_STYLE = {
  draft:     { background: '#F0EBE0', color: 'var(--adm-text-secondary)' },
  sourcing:  { background: 'var(--adm-purple-light)', color: 'var(--adm-purple)' },
  shortlist: { background: 'var(--adm-amber)', color: '#fff' },
  filled:    { background: 'var(--adm-green-light)', color: 'var(--adm-green)' },
};

const BLANK = {
  startupId: '', title: '', roleType: 'technical', track: 'member',
  profile: '', skills: [], firstDeliverable: '', needsCommunication: false,
  assignedTo: '', status: 'sourcing',
};
const daysSince = (iso) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : 0);
const NEXT_LABEL = { sourcing: 'Aramaya al', shortlist: 'Kısa listeye al', draft: 'Taslağa al' };

export default function RolesPage() {
  const store = useHubStore();
  const { openRoles, candidates, members, currentMember } = store;
  const role = useHubMember();
  const { can } = usePerms();

  const [startups, setStartups] = useState([]);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3200); };

  const myStartups = currentMember?.startupIds || [];
  const isOwner = role === 'project_owner';
  const canManage = can('roles.create');
  const canClose = can('roles.close');

  useEffect(() => {
    supabase.from('startups').select('id, name').order('name').then(({ data }) => setStartups(data || [])).catch(() => setStartups([]));
  }, []);
  const startupName = (id) => startups.find((s) => s.id === id)?.name || (id ? `#${id}` : '—');
  const memberName = (id) => members.find((m) => m.id === id)?.fullName || members.find((m) => m.id === id)?.email || '—';

  const visible = useMemo(() =>
    openRoles.filter((r) => !isOwner || (r.startupId != null && myStartups.includes(r.startupId))),
    [openRoles, isOwner, myStartups]);

  const groups = useMemo(() => {
    const g = new Map();
    [...visible].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'tr')).forEach((r) => {
      const k = r.startupId ?? 'none';
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(r);
    });
    return [...g.entries()];
  }, [visible]);

  const linkedCands = (roleId) => candidates.filter((c) => c.openRoleId === roleId && c.stage !== 'archived');

  const save = async () => {
    const e = editing;
    if (!e.title.trim()) { flash('Başlık zorunlu.'); return; }
    const payload = {
      startupId: e.startupId ? Number(e.startupId) : null,
      title: e.title.trim(),
      roleType: e.roleType,
      track: e.track,
      profile: e.profile,
      skills: e.skills,
      firstDeliverable: e.firstDeliverable,
      needsCommunication: e.needsCommunication,
      assignedTo: e.assignedTo || null,
      status: e.status || 'sourcing',
    };
    try {
      if (e.id) await store.updateItem('openRoles', e.id, payload);
      else await store.addItem('openRoles', payload);
      setEditing(null);
    } catch (err) { flash('Hata: ' + err.message); }
  };

  const move = async (r, to) => {
    try { await store.advanceRole(r.id, to); flash(`Durum: ${ROLE_STATUS_LABEL[to]}`); }
    catch (e) { flash('Hata: ' + e.message); }
  };

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Roller</h1>
          <p className="adm-page-head__desc">Rol doğrudan "Aranıyor"a düşer. Aday sunma aday kartından yapılır.</p>
        </div>
        {canManage && (
          <div className="adm-page-head__actions">
            <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setEditing({ ...BLANK })}>
              <AIcon name="plus" size={14} /> Rol oluştur
            </button>
          </div>
        )}
      </div>

      {groups.length === 0 && <div className="adm-empty">Görebileceğin açık rol yok.</div>}

      {groups.map(([sid, list]) => (
        <div key={sid} style={{ marginBottom: 20 }}>
          <h3 className="hub-h4">{sid === 'none' ? 'Proje atanmamış' : startupName(Number(sid))}</h3>
          {list.map((r) => {
            const cs = linkedCands(r.id);
            const funnel = STAGE_ORDER.map((s) => [s, cs.filter((c) => c.stage === s).length]).filter(([, n]) => n > 0);
            return (
              <div key={r.id} style={{ border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-r)', background: 'var(--adm-bg-card)', padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 15, fontFamily: 'var(--font-heading)' }}>{r.title}</strong>
                  <span className="hub-pill" style={STATUS_STYLE[r.status]}>{ROLE_STATUS_LABEL[r.status]}</span>
                  <span className="hub-pill">{r.track === 'founder' ? 'Kurucu hattı' : 'Üye hattı'}</span>
                  <span className="hub-pill">{ROLE_TYPE_LABEL[r.roleType] || r.roleType}</span>
                  <span style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginLeft: 'auto' }}>{daysSince(r.createdAt)} gündür açık</span>
                </div>
                {r.profile && <div style={{ fontSize: 13, color: 'var(--adm-text-secondary)', margin: '6px 0' }}>{r.profile}</div>}
                <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>
                  {(r.skills || []).join(', ') || 'beceri yok'}
                  {r.needsCommunication ? ' · iletişim zorunlu' : ''}
                  {r.firstDeliverable ? ` · ilk teslimat: ${r.firstDeliverable}` : ''}
                  {` · sorumlu: ${memberName(r.assignedTo)}`}
                </div>

                <div style={{ fontSize: 12, marginTop: 8 }}>
                  <strong>Bağlı adaylar ({cs.length}):</strong>{' '}
                  {funnel.length ? funnel.map(([s, n]) => `${STAGE_LABEL[s]} ${n}`).join(' · ') : '—'}
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {canManage && (ROLE_STATUS_NEXT[r.status] || []).map((to) => (
                    <button key={to} className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => move(r, to)}>
                      {NEXT_LABEL[to] || ROLE_STATUS_LABEL[to]}
                    </button>
                  ))}
                  {canManage && <button className="adm-icon-btn" title="Düzenle" onClick={() => setEditing({
                    ...r, startupId: r.startupId ?? '', assignedTo: r.assignedTo ?? '',
                  })}><AIcon name="edit" size={14} /></button>}
                  {canClose && <button className="adm-icon-btn adm-icon-btn--danger" title="Sil" onClick={() => setConfirm(r)}><AIcon name="trash" size={14} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Rolü düzenle' : 'Yeni rol'} wide>
        {editing && (
          <div>
            <div className="adm-form-grid">
              <Field label="Proje">
                <select className="adm-input adm-select" value={editing.startupId} onChange={(e) => setEditing({ ...editing, startupId: e.target.value })}>
                  <option value="">—</option>
                  {startups.filter((s) => !isOwner || myStartups.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Başlık" required><Input value={editing.title} onChange={(v) => setEditing({ ...editing, title: v })} /></Field>
              <Field label="Rol tipi"><Select value={editing.roleType} onChange={(v) => setEditing({ ...editing, roleType: v })} options={ROLE_TYPES} /></Field>
              <Field label="Hat" hint="Kurucu = ortaklık; Üye = projede rol.">
                <Select value={editing.track} onChange={(v) => setEditing({ ...editing, track: v })} options={TRACKS} />
              </Field>
              <Field label="Sorumlu (arayacak kişi)">
                <select className="adm-input adm-select" value={editing.assignedTo} onChange={(e) => setEditing({ ...editing, assignedTo: e.target.value })}>
                  <option value="">—</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.fullName || m.email}</option>)}
                </select>
              </Field>
              <Field label="İletişim ekseni zorunlu (üye hattı)">
                <Select value={editing.needsCommunication ? '1' : '0'} onChange={(v) => setEditing({ ...editing, needsCommunication: v === '1' })}
                  options={[{ value: '0', label: 'Hayır' }, { value: '1', label: 'Evet' }]} />
              </Field>
            </div>
            <Field label="Aranan profil"><Textarea value={editing.profile} onChange={(v) => setEditing({ ...editing, profile: v })} /></Field>
            <Field label="Beceriler (virgülle)">
              <Input value={(editing.skills || []).join(', ')} onChange={(v) => setEditing({ ...editing, skills: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
            </Field>
            <Field label="İlk teslimat"><Input value={editing.firstDeliverable} onChange={(v) => setEditing({ ...editing, firstDeliverable: v })} placeholder="Kapı A görev metni" /></Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setEditing(null)}>İptal</button>
              <button className="adm-btn adm-btn--primary" onClick={save}>Kaydet</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => { store.deleteItem('openRoles', confirm.id).then(() => setConfirm(null)); }}
        title="Rolü sil?" message={confirm?.title} />

      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}
