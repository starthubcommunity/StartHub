// roles.jsx — Açık Roller (§12.5). Proje bazında gruplu liste, durum
// makinesi (§12.2/12.3), rolden GitHub taraması (§12.4). Yetki §12.7.
import React, { useState, useEffect, useMemo } from 'react';
import { AIcon, Field, Input, Textarea, Select, Modal, ConfirmDialog } from '../../admin/admin-ui';
import { supabase } from '../../lib/supabase';
import { useHubStore } from '../hub-store';
import { useHubMember } from '../hub-member';
import { suggestCandidatesFor } from '../hub-match';
import {
  ROLE_TYPES, ROLE_TYPE_LABEL, TRACKS, URGENCIES, URGENCY_LABEL,
  ROLE_STATUS_LABEL, STAGE_LABEL, STAGES,
} from '../hub-constants';

const STATUS_STYLE = {
  draft:     { background: '#F0EBE0', color: 'var(--adm-text-secondary)' },
  requested: { background: 'var(--adm-blue-light)', color: 'var(--adm-blue)' },
  sourcing:  { background: 'var(--adm-purple-light)', color: 'var(--adm-purple)' },
  shortlist: { background: 'var(--adm-amber)', color: '#fff' },
  filled:    { background: 'var(--adm-green-light)', color: 'var(--adm-green)' },
  paused:    { background: '#F0EBE0', color: 'var(--adm-text-dim)' },
  cancelled: { background: 'var(--adm-red-light)', color: 'var(--adm-red)' },
};

const BLANK = {
  startupId: '', title: '', roleType: 'technical', track: 'member',
  profile: '', skills: [], weeklyHours: '', durationMonths: '', firstDeliverable: '',
  teamSize: '', needsCommunication: false, urgency: 'normal', status: 'draft',
};

const daysSince = (iso) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : 0);

export default function RolesPage({ onScanForRole }) {
  const store = useHubStore();
  const { openRoles, candidates, members, currentMember } = store;
  const role = useHubMember();

  const [startups, setStartups] = useState([]);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [logFor, setLogFor] = useState(null);   // rol id — durum günlüğü
  const [roleLog, setRoleLog] = useState([]);
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3200); };

  const myStartups = currentMember?.startupIds || [];
  const isOwner = role === 'project_owner';
  const canRequest = ['cofounder', 'recruiter', 'project_owner'].includes(role); // team lead de açar
  const canClaim = role === 'cofounder' || role === 'recruiter';                 // recruiter arar

  useEffect(() => {
    supabase.from('startups').select('id, name').order('name').then(({ data }) => setStartups(data || [])).catch(() => setStartups([]));
  }, []);
  const startupName = (id) => startups.find((s) => s.id === id)?.name || (id ? `#${id}` : '—');

  // §12.7 — project_owner yalnızca kendi projesinin rollerini görür.
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
      ...e,
      startupId: e.startupId ? Number(e.startupId) : null,
      weeklyHours: e.weeklyHours === '' ? null : Number(e.weeklyHours),
      durationMonths: e.durationMonths === '' ? null : Number(e.durationMonths),
      teamSize: e.teamSize === '' ? null : Number(e.teamSize),
    };
    try {
      if (e.id) await store.updateItem('openRoles', e.id, payload);
      else await store.addItem('openRoles', payload);
      setEditing(null);
    } catch (err) { flash('Hata: ' + err.message); }
  };

  const move = async (r, to) => {
    try { await store.advanceRole(r.id, to, { note: `${ROLE_STATUS_LABEL[r.status]} → ${ROLE_STATUS_LABEL[to]}` }); flash(`Durum: ${ROLE_STATUS_LABEL[to]}`); }
    catch (e) { flash('Hata: ' + e.message); }
  };

  const openLog = async (roleId) => {
    setLogFor(roleId);
    const { data } = await supabase.from('hub_role_log').select('*').eq('role_id', roleId).order('created_at', { ascending: false });
    setRoleLog((data || []).map((x) => ({
      when: x.created_at, from: x.from_status, to: x.to_status, note: x.note,
      who: members.find((m) => m.id === x.actor_id)?.fullName || '—',
    })));
  };

  const statusButtons = (r) => {
    const b = [];
    if (r.status === 'draft' && canRequest) b.push(['requested', 'Talep gönder', 'primary']);
    if (r.status === 'requested' && canClaim) b.push(['sourcing', 'Üstlen', 'primary']);
    if (['requested', 'sourcing', 'shortlist'].includes(r.status) && (canClaim || isOwner)) {
      b.push(['paused', 'Dondur', 'ghost'], ['cancelled', 'Kapat', 'ghost']);
    }
    if (r.status === 'paused' && (canClaim || isOwner)) b.push(['sourcing', 'Devam et', 'primary'], ['cancelled', 'Kapat', 'ghost']);
    if (r.status === 'cancelled' && canRequest) b.push(['draft', 'Taslağa al', 'ghost']);
    return b;
  };

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Açık Roller</h1>
          <p className="adm-page-head__desc">Rol, hattın sonunda bir etiket değil — başlangıcı. Her adımda tek karar verici (§12.3).</p>
        </div>
        {canRequest && (
          <div className="adm-page-head__actions">
            <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => setEditing({ ...BLANK })}>
              <AIcon name="edit" size={14} /> Rol oluştur
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
            const funnel = STAGES.map((s) => [s, cs.filter((c) => c.stage === s.value).length]).filter(([, n]) => n > 0);
            return (
              <div key={r.id} style={{ border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-r)', background: 'var(--adm-bg-card)', padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 15, fontFamily: 'var(--font-heading)' }}>{r.title}</strong>
                  <span className="hub-pill" style={STATUS_STYLE[r.status]}>{ROLE_STATUS_LABEL[r.status]}</span>
                  <span className="hub-pill">{r.track === 'founder' ? 'Kurucu hattı' : 'Üye hattı'}</span>
                  <span className="hub-pill">{ROLE_TYPE_LABEL[r.roleType] || r.roleType}</span>
                  {r.urgency !== 'normal' && <span className="hub-pill hub-pill--flag">{URGENCY_LABEL[r.urgency]}</span>}
                  <span style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginLeft: 'auto' }}>{daysSince(r.createdAt)} gündür açık</span>
                </div>
                {r.profile && <div style={{ fontSize: 13, color: 'var(--adm-text-secondary)', margin: '6px 0' }}>{r.profile}</div>}
                <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>
                  {(r.skills || []).join(', ') || 'beceri yok'}
                  {r.weeklyHours ? ` · ${r.weeklyHours} saat/hafta` : ''}
                  {r.durationMonths ? ` · ${r.durationMonths} ay` : ''}
                  {r.teamSize ? ` · ekip ${r.teamSize}` : ''}
                  {r.needsCommunication ? ' · iletişim zorunlu' : ''}
                  {r.firstDeliverable ? ` · ilk teslimat: ${r.firstDeliverable}` : ''}
                </div>

                <div style={{ fontSize: 12, marginTop: 8 }}>
                  <strong>Bağlı adaylar ({cs.length}):</strong>{' '}
                  {funnel.length ? funnel.map(([s, n]) => `${STAGE_LABEL[s.value]} ${n}`).join(' · ') : '—'}
                  {r.status === 'sourcing' && <span style={{ color: 'var(--adm-text-dim)' }}> · aday sunma aday kartından yapılır</span>}
                </div>
                {['sourcing', 'shortlist'].includes(r.status) && (() => {
                  const sug = suggestCandidatesFor(r, candidates);
                  return sug.length === 0 ? null : (
                    <div style={{ fontSize: 12, marginTop: 4, color: 'var(--adm-text-secondary)' }}>
                      <strong>Havuzdan öneri</strong> (role_type + beceri örtüşmesi — atama değil):{' '}
                      {sug.map(({ candidate }) => candidate.fullName).join(', ')}
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {statusButtons(r).map(([to, label, kind]) => (
                    <button key={to + label} className={`adm-btn adm-btn--${kind} adm-btn--sm`} onClick={() => move(r, to)}>{label}</button>
                  ))}
                  {['sourcing', 'shortlist'].includes(r.status) && canClaim && (
                    <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => onScanForRole?.(r)}>
                      <AIcon name="refresh" size={13} /> Bu rol için tara
                    </button>
                  )}
                  <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => openLog(r.id)}>Günlük</button>
                  {canRequest && <button className="adm-icon-btn" title="Düzenle" onClick={() => setEditing({
                    ...r,
                    weeklyHours: r.weeklyHours ?? '', durationMonths: r.durationMonths ?? '', teamSize: r.teamSize ?? '',
                    startupId: r.startupId ?? '',
                  })}><AIcon name="edit" size={14} /></button>}
                  {(role === 'cofounder') && <button className="adm-icon-btn adm-icon-btn--danger" title="Sil" onClick={() => setConfirm(r)}><AIcon name="trash" size={14} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Oluştur / düzenle */}
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
              <Field label="Hat" hint="Kurucu = ortaklık; Üye = projede rol. Eşik ve kapı sayısı buna göre.">
                <Select value={editing.track} onChange={(v) => setEditing({ ...editing, track: v })} options={TRACKS} />
              </Field>
              <Field label="Haftalık saat"><Input type="number" value={editing.weeklyHours} onChange={(v) => setEditing({ ...editing, weeklyHours: v })} /></Field>
              <Field label="Süre (ay)"><Input type="number" value={editing.durationMonths} onChange={(v) => setEditing({ ...editing, durationMonths: v })} /></Field>
              <Field label="Ekip büyüklüğü"><Input type="number" value={editing.teamSize} onChange={(v) => setEditing({ ...editing, teamSize: v })} /></Field>
              <Field label="Aciliyet"><Select value={editing.urgency} onChange={(v) => setEditing({ ...editing, urgency: v })} options={URGENCIES} /></Field>
              <Field label="İletişim ekseni zorunlu (üye hattı)">
                <Select value={editing.needsCommunication ? '1' : '0'} onChange={(v) => setEditing({ ...editing, needsCommunication: v === '1' })}
                  options={[{ value: '0', label: 'Hayır' }, { value: '1', label: 'Evet' }]} />
              </Field>
            </div>
            <Field label="Aranan profil" hint="Mesaj taslağındaki kişiselleştirme bağlamını besler (§12.4).">
              <Textarea value={editing.profile} onChange={(v) => setEditing({ ...editing, profile: v })} />
            </Field>
            <Field label="Beceriler (virgülle) — GitHub taramasını besler" hint="Dil ve anahtar kelimeler elle girilmez; rolden gelir.">
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

      {/* Durum günlüğü */}
      <Modal open={!!logFor} onClose={() => setLogFor(null)} title="Rol durum günlüğü">
        {roleLog.length === 0 ? <div style={{ color: 'var(--adm-text-dim)' }}>Kayıt yok.</div> : (
          <ul className="hub-timeline">
            {roleLog.map((l, i) => (
              <li key={i}>
                <div className="hub-timeline__when">{new Date(l.when).toLocaleString('tr-TR')} · {l.who}</div>
                <div className="hub-timeline__what">{ROLE_STATUS_LABEL[l.from] || l.from || '—'} → {ROLE_STATUS_LABEL[l.to] || l.to}{l.note ? ` (${l.note})` : ''}</div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => { store.deleteItem('openRoles', confirm.id).then(() => setConfirm(null)); }}
        title="Rolü sil?" message={confirm?.title} />

      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}
