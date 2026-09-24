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
import { EMPTY_FILTERS } from '../components/filter-bar';
import HubWizard from '../components/wizard';
import NewCandidateModal from './new-candidate';

const STATUS_PILL = { draft: '', sourcing: 'hub-pill--stage', shortlist: 'hub-pill--warn', filled: 'hub-pill--ok' };
const STATUS_LEAD = { draft: '#A29D94', sourcing: '#7C3AED', shortlist: '#EA580C', filled: '#16A34A' };

const BLANK = {
  startupId: '', title: '', roleType: 'technical', track: 'member',
  profile: '', skills: [], firstDeliverable: '', needsCommunication: false,
  assignedTo: '', status: 'sourcing',
};
const daysSince = (iso) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86400000) : 0);
// shortlist'e artık elle geçiş yok (bkz. ROLE_STATUS_NEXT) — bu yüzden burada
// hedef anahtarı olarak hiç görünmez, silinmedi çünkü şortlist'ten geri dönüş
// (shortlist -> sourcing) hâlâ elle mümkün ve "Aramaya al" ile aynı hedefi kullanır.
const NEXT_LABEL = { sourcing: 'Yayınla', draft: 'Taslağa al' };

export default function RolesPage({ onGoto, setFilters }) {
  const store = useHubStore();
  const { openRoles, candidates, members, currentMember } = store;
  const role = useHubMember();
  const { can } = usePerms();

  const [startups, setStartups] = useState(null);   // null = yükleniyor
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3200); };
  // Yeni rol oluşturma: hat + proje seçimi (taslak proje dahil) wizard'dan
  // ÖNCE, ayrı küçük bir akışla çözülür — bkz. RoleSetupFlow altta.
  const [newRoleFlow, setNewRoleFlow] = useState(null);
  const [addToRole, setAddToRole] = useState(null);   // "+ Bu role aday ekle"

  const goToRoleCandidates = (roleId) => {
    if (!onGoto || !setFilters) return;
    setFilters({ ...EMPTY_FILTERS, openRoleId: [roleId] });
    onGoto('candidates');
  };

  const myStartups = currentMember?.startupIds || [];
  const isOwner = role === 'project_owner';
  const canManage = can('roles.create');
  const canClose = can('roles.close');

  useEffect(() => {
    supabase.from('startups').select('id, name').order('name').then(({ data }) => setStartups(data || [])).catch(() => setStartups([]));
  }, []);
  // §7 — startups gelene kadar ham ID render etme; kısa bir iskelet göster.
  const startupName = (id) => {
    if (startups == null) return '…';
    return startups.find((s) => s.id === id)?.name || (id ? 'Proje' : '—');
  };
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

  // 2026-09-24 CRM-lite Round 2 — YENİ rol oluşturma eskiden 7 zorunlu/opsiyonel
  // adımdı (+ proje/hat seçimi için 2-3 adım daha). Artık yalnızca 3 temel soru +
  // 1 opsiyonel not soruluyor; "iletişim ekseni", "beceriler", "ilk teslimat" gibi
  // ayrıntılar SİLİNMEDİ — rol oluştuktan sonra "Düzenle"den eklenebiliyor,
  // varsayılanla (needsCommunication:false, skills:[], firstDeliverable:'')
  // oluşturuluyor. Düzenleme akışı (editWizSteps) hâlâ tüm alanları soruyor.
  const titleStep = { key: 'title', type: 'text', q: 'Rol başlığı nedir?', ph: 'ör. Flutter Geliştirici' };
  const roleTypeStep = { key: 'roleType', type: 'options', q: 'Rol tipi?', options: ROLE_TYPES.map((t) => ({ value: t.value, label: t.label })) };
  const assignedToStep = useMemo(() => ({
    key: 'assignedTo', type: 'options', q: 'Kim arayacak?', options: [
      { value: '', label: '— (henüz belli değil)' },
      ...members.map((m) => ({ value: m.id, label: m.fullName || m.email })),
    ],
  }), [members]);
  const profileStep = {
    key: 'profile', type: 'textarea', q: 'Eklemek istediğin bir not var mı?',
    sub: 'Opsiyonel — aranan profil, beceriler gibi ayrıntıları sonra "Düzenle"den ekleyebilirsin.',
    ph: 'İsteğe bağlı', optional: true,
  };
  const needsCommStep = { key: 'needsCommunication', type: 'options', q: 'İletişim ekseni zorunlu mu? (üye hattı)', options: [
    { value: '0', label: 'Hayır' }, { value: '1', label: 'Evet' },
  ] };
  const skillsStep = { key: 'skills', type: 'text', q: 'Beceriler (virgülle)?', ph: 'React, SQL, Go', optional: true };
  const firstDeliverableStep = { key: 'firstDeliverable', type: 'text', q: 'İlk teslimat (Kapı A görev metni)?', optional: true };

  const restSteps = useMemo(() => [titleStep, roleTypeStep, assignedToStep, profileStep], [assignedToStep]);

  const editWizSteps = useMemo(() => [
    { key: 'startupId', type: 'options', q: 'Hangi proje?', options: [
      { value: '', label: 'Proje atanmamış' },
      ...(startups || []).filter((s) => !isOwner || myStartups.includes(s.id)).map((s) => ({ value: String(s.id), label: s.name })),
    ] },
    titleStep, roleTypeStep,
    { key: 'track', type: 'options', q: 'Hangi hat?', options: TRACKS.map((t) => ({ value: t.value, label: t.label, hint: t.value === 'founder' ? 'ortaklık' : 'projede rol' })) },
    assignedToStep, needsCommStep, skillsStep, firstDeliverableStep, profileStep,
  ], [startups, isOwner, myStartups, assignedToStep]);

  const wizSteps = editing?.id ? editWizSteps : restSteps;

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

  // Rol silme: önce bağlı adayları çöz (0012 migration'ı yoksa FK ihlali
  // rol silmeyi bloklar), sonra sil. Hata olursa diyalog KAPANIR + reload.
  const [deleting, setDeleting] = useState(false);
  const doDelete = async (r) => {
    setDeleting(true);
    try {
      const linked = candidates.filter((c) => c.openRoleId === r.id);
      for (const c of linked) {
        // eslint-disable-next-line no-await-in-loop
        await store.updateItem('candidates', c.id, { ...c, openRoleId: null });
      }
      await store.deleteItem('openRoles', r.id);
      flash(linked.length ? `Rol silindi · ${linked.length} aday çözüldü.` : 'Rol silindi.');
    } catch (e) {
      flash('Silinemedi: ' + (e.message || 'bilinmeyen hata'));
      store.reload();
    } finally {
      setDeleting(false);
      setConfirm(null);
    }
  };

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1 className="adm-page-head__title">Açık Pozisyonlar</h1>
          <p className="adm-page-head__desc">Rol doğrudan "Yayında"ya düşer. Aday sunma aday kartından yapılır.</p>
        </div>
        {canManage && (
          <div className="adm-page-head__actions">
            <button className="adm-btn adm-btn--primary adm-btn--sm adm-btn--cta" onClick={() => setNewRoleFlow({ step: 'track' })}>
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
              <div key={r.id} className="hub-c hub-c--lead" style={{ '--hub-lead': STATUS_LEAD[r.status] || '#E7E0D2', marginBottom: 10, cursor: 'pointer' }}
                onClick={() => goToRoleCandidates(r.id)} title="Bu role bağlı adayları gör">
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

                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                  {can('candidates.write') && (
                    <button className="adm-btn adm-btn--soft adm-btn--sm" onClick={() => setAddToRole(r.id)}>
                      <AIcon name="plus" size={13} /> Bu role aday ekle
                    </button>
                  )}
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

      <ConfirmDialog open={!!confirm} onClose={() => !deleting && setConfirm(null)}
        onConfirm={() => confirm && !deleting && doDelete(confirm)}
        title="Rolü sil?"
        message={`${confirm?.title || ''}${confirm ? ` · ${candidates.filter((c) => c.openRoleId === confirm.id).length} bağlı aday çözülecek` : ''}`} />

      {newRoleFlow && (
        <RoleSetupFlow
          flow={newRoleFlow}
          setFlow={setNewRoleFlow}
          startups={startups}
          isOwner={isOwner}
          myStartups={myStartups}
          onResolved={(track, startupId) => {
            setNewRoleFlow(null);
            setEditing({ ...BLANK, track, startupId });
          }}
          onCreatedDraft={(s) => setStartups((prev) => [...(prev || []), s])}
        />
      )}

      {addToRole && (
        <NewCandidateModal presetRoleId={addToRole} onClose={() => setAddToRole(null)} />
      )}

      {toast && <div className="hub-toast">{toast}</div>}
    </div>
  );
}

// ─── Yeni rol: hat + proje seçimi (wizard'dan önce, ayrı küçük akış) ──────
// Kurucu hattı: "var olan proje" ya da "yeni proje taslağı oluştur" (fikir
// aşaması — henüz sitede yok, stage:'idea' + published:false). Üye hattı:
// mecburen var olan bir proje seçilir, "atanmamış" seçeneği yok.
function RoleSetupFlow({ flow, setFlow, startups, isOwner, myStartups, onResolved, onCreatedDraft }) {
  const [draftName, setDraftName] = useState('');
  const [draftOneLiner, setDraftOneLiner] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const visibleStartups = (startups || []).filter((s) => !isOwner || myStartups.includes(s.id));

  const createDraft = async () => {
    if (!draftName.trim()) return;
    setBusy(true); setErr('');
    try {
      const { data, error } = await supabase.functions.invoke('hub-create-draft-project', {
        body: { name: draftName.trim(), oneLiner: draftOneLiner.trim() },
      });
      if (error || data?.error) throw new Error(data?.error || error.message);
      onCreatedDraft(data.project);
      onResolved('founder', data.project.id);
    } catch (e) {
      setErr(e.message || 'Taslak oluşturulamadı.');
      setBusy(false);
    }
  };

  const back = () => {
    if (flow.step === 'founder-choice' || flow.step === 'project') setFlow({ step: 'track' });
    else if (flow.step === 'draft') setFlow({ step: 'founder-choice' });
  };

  return (
    <div className="hub-wz-overlay" onClick={() => setFlow(null)}>
      <div className="hub-wz" onClick={(e) => e.stopPropagation()}>
        <div className="hub-wz__head">
          <div className="hub-wz__headrow">
            <div className="hub-wz__dots" />
            <button className="hub-wz__x" onClick={() => setFlow(null)}>✕</button>
          </div>
        </div>
        <div className="hub-wz__body">
          {flow.step === 'track' && (
            <div className="hub-wz__step">
              <div className="hub-wz__kicker">YENİ ROL</div>
              <div className="hub-wz__q">Hangi hat için rol açıyorsun?</div>
              <div className="hub-wz__opts">
                <button type="button" className="hub-wz__opt" onClick={() => setFlow({ step: 'founder-choice' })}>
                  <span className="hub-wz__opt-l">Kurucu hattı</span>
                  <span className="hub-wz__opt-r">ortaklık</span>
                </button>
                <button type="button" className="hub-wz__opt" onClick={() => setFlow({ step: 'project', track: 'member' })}>
                  <span className="hub-wz__opt-l">Üye hattı</span>
                  <span className="hub-wz__opt-r">projede rol</span>
                </button>
              </div>
            </div>
          )}

          {flow.step === 'founder-choice' && (
            <div className="hub-wz__step">
              <div className="hub-wz__kicker">YENİ ROL · KURUCU HATTI</div>
              <div className="hub-wz__q">Bu rol hangi proje için?</div>
              <div className="hub-wz__sub">Henüz bir proje yoksa fikir aşamasında bir taslak oluşturabilirsin — sitede yayınlanmaz.</div>
              <div className="hub-wz__opts">
                <button type="button" className="hub-wz__opt" onClick={() => setFlow({ step: 'draft', track: 'founder' })}>
                  <span className="hub-wz__opt-l">Yeni bir proje taslağı oluştur</span>
                </button>
                <button type="button" className="hub-wz__opt" onClick={() => setFlow({ step: 'project', track: 'founder' })}>
                  <span className="hub-wz__opt-l">Benim projem var</span>
                </button>
              </div>
            </div>
          )}

          {flow.step === 'project' && (
            <div className="hub-wz__step">
              <div className="hub-wz__kicker">YENİ ROL</div>
              <div className="hub-wz__q">Hangi proje?</div>
              <div className="hub-wz__opts">
                {visibleStartups.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Henüz bir projen yok.</div>
                )}
                {visibleStartups.map((s) => (
                  <button key={s.id} type="button" className="hub-wz__opt" onClick={() => onResolved(flow.track, String(s.id))}>
                    <span className="hub-wz__opt-l">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {flow.step === 'draft' && (
            <div className="hub-wz__step">
              <div className="hub-wz__kicker">YENİ ROL · PROJE TASLAĞI</div>
              <div className="hub-wz__q">Proje adı?</div>
              <input className="hub-wz__input" autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="ör. StartHub Proje Geliştirme" />
              <div className="hub-wz__q" style={{ marginTop: 16 }}>Tek cümlelik açıklama <span style={{ fontWeight: 400, opacity: 0.6 }}>(opsiyonel)</span></div>
              <input className="hub-wz__input" value={draftOneLiner} onChange={(e) => setDraftOneLiner(e.target.value)} placeholder="Bu proje ne yapıyor?" />
              {err && <div className="hub-wz__err">{err}</div>}
            </div>
          )}
        </div>
        <div className="hub-wz__foot">
          {flow.step !== 'track' && <button className="hub-wz__back" onClick={back} disabled={busy}>← Geri</button>}
          {flow.step === 'draft' && (
            <button className="hub-wz__next" onClick={createDraft} disabled={busy || !draftName.trim()}>
              {busy ? '…' : 'Taslağı oluştur ve devam et'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
