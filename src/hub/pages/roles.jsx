// roles.jsx — Roller (v2 §10). Proje bazında gruplu liste, sade durum
// makinesi (draft → sourcing → shortlist → filled). Talep/onay el sıkışması
// YOK: rol doğrudan "sourcing"e düşer. Buton görünürlüğü has_perm() ile.
import React, { useState, useEffect, useMemo } from 'react';
import { AIcon, ConfirmDialog } from '../../admin/admin-ui';
import { supabase } from '../../lib/supabase';
import { useHubStore } from '../hub-store';
import { useHubMember } from '../hub-member';
import { usePerms } from '../../lib/use-perms';
import { ROLE_TYPES, ROLE_TYPE_LABEL, TRACKS, ROLE_STATUS_LABEL, ROLE_STATUS_NEXT, STAGE_LABEL, STAGE_ORDER } from '../hub-constants';
import HubWizard from '../components/wizard';

const STATUS_PILL = { draft: '', sourcing: 'hub-pill--stage', shortlist: 'hub-pill--warn', filled: 'hub-pill--ok' };
const STATUS_LEAD = { draft: '#A29D94', sourcing: '#7C3AED', shortlist: '#EA580C', filled: '#16A34A' };

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

  const wizSteps = useMemo(() => [
    { key: 'startupId', type: 'options', q: 'Hangi proje?', options: [
      { value: '', label: 'Proje atanmamış' },
      ...startups.filter((s) => !isOwner || myStartups.includes(s.id)).map((s) => ({ value: String(s.id), label: s.name })),
    ] },
    { key: 'title', type: 'text', q: 'Rol başlığı nedir?', ph: 'ör. Flutter Geliştirici' },
    { key: 'roleType', type: 'options', q: 'Rol tipi?', options: ROLE_TYPES.map((t) => ({ value: t.value, label: t.label })) },
    { key: 'track', type: 'options', q: 'Hangi hat?', options: TRACKS.map((t) => ({ value: t.value, label: t.label, hint: t.value === 'founder' ? 'ortaklık' : 'projede rol' })) },
    { key: 'assignedTo', type: 'options', q: 'Kim arayacak?', options: [
      { value: '', label: '— (henüz belli değil)' },
      ...members.map((m) => ({ value: m.id, label: m.fullName || m.email })),
    ] },
    { key: 'needsCommunication', type: 'options', q: 'İletişim ekseni zorunlu mu? (üye hattı)', options: [
      { value: '0', label: 'Hayır' }, { value: '1', label: 'Evet' },
    ] },
    { key: 'profile', type: 'textarea', q: 'Aranan profil?', ph: 'Kişiselleştirme bağlamını besler.', optional: true },
    { key: 'skills', type: 'text', q: 'Beceriler (virgülle)?', ph: 'React, SQL, Go', optional: true },
    { key: 'firstDeliverable', type: 'text', q: 'İlk teslimat (Kapı A görev metni)?', optional: true },
  ], [startups, members, isOwner, myStartups]);

  const saveRole = async (a) => {
    if (!String(a.title || '').trim()) throw new Error('Başlık zorunlu.');
    const payload = {
      startupId: a.startupId ? Number(a.startupId) : null,
      title: a.title.trim(),
      roleType: a.roleType || 'technical',
      track: a.track || 'member',
      profile: a.profile || '',
      skills: String(a.skills || '').split(',').map((x) => x.trim()).filter(Boolean),
      firstDeliverable: a.firstDeliverable || '',
      needsCommunication: a.needsCommunication === '1' || a.needsCommunication === true,
      assignedTo: a.assignedTo || null,
      status: editing?.status || 'sourcing',
    };
    if (editing?.id) await store.updateItem('openRoles', editing.id, payload);
    else await store.addItem('openRoles', payload);
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
            <button className="adm-btn adm-btn--primary adm-btn--sm adm-btn--cta" onClick={() => setEditing({ ...BLANK })}>
              <AIcon name="plus" size={14} /> Rol oluştur
            </button>
          </div>
        )}
      </div>

      {groups.length === 0 && <div className="adm-empty">İlk açık rolünü oluştur — sağ üstteki “Rol oluştur”.</div>}

      {groups.map(([sid, list]) => (
        <div key={sid} style={{ marginBottom: 20 }}>
          <h3 className="hub-h4">{sid === 'none' ? 'Proje atanmamış' : startupName(Number(sid))}</h3>
          {list.map((r) => {
            const cs = linkedCands(r.id);
            const funnel = STAGE_ORDER.map((s) => [s, cs.filter((c) => c.stage === s).length]).filter(([, n]) => n > 0);
            return (
              <div key={r.id} className="hub-c hub-c--lead" style={{ '--hub-lead': STATUS_LEAD[r.status] || '#E7E0D2', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 15, fontFamily: 'var(--font-heading)' }}>{r.title}</strong>
                  <span className={`hub-pill ${STATUS_PILL[r.status] || ''}`}>{ROLE_STATUS_LABEL[r.status]}</span>
                  <span className={`hub-pill hub-pill--track-${r.track === 'founder' ? 'founder' : 'member'}`}>{r.track === 'founder' ? 'Kurucu hattı' : 'Üye hattı'}</span>
                  <span className="hub-pill">{ROLE_TYPE_LABEL[r.roleType] || r.roleType}</span>
                  <span style={{ fontSize: 12, color: '#A29D94', marginLeft: 'auto' }}>{daysSince(r.createdAt)} gündür açık</span>
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

      {editing && (
        <HubWizard
          title={editing.id ? 'Rolü düzenle' : 'Yeni rol'}
          steps={wizSteps}
          initial={{
            startupId: editing.startupId != null ? String(editing.startupId) : '',
            title: editing.title || '',
            roleType: editing.roleType || 'technical',
            track: editing.track || 'member',
            assignedTo: editing.assignedTo || '',
            needsCommunication: editing.needsCommunication ? '1' : '0',
            profile: editing.profile || '',
            skills: (editing.skills || []).join(', '),
            firstDeliverable: editing.firstDeliverable || '',
          }}
          submitLabel={editing.id ? 'Kaydet' : 'Rolü oluştur'}
          onComplete={saveRole}
          onCancel={() => setEditing(null)}
          wide
        />
      )}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => { store.deleteItem('openRoles', confirm.id).then(() => setConfirm(null)); }}
        title="Rolü sil?" message={confirm?.title} />

      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}
