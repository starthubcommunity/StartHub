// hub-store.jsx — Supabase CRUD + React context (admin-store.jsx deseni).
//
// - Koleksiyonlar mount'ta paralel yüklenir (Promise.all).
// - patchLocal: sunucu round-trip'ini beklemeden yerel cache'i günceller
//   (optimistic UI). Çağıran taraf updateItem ile gerçek isteği atar; hata
//   olursa yine patchLocal ile eski değere döner (rollback).
// - HUB_SPEC §4.6.1: nextId hack'i YOK. Tüm hub tabloları uuid default'lu —
//   insert'te id gönderilmez (mapper'lar zaten üretmez).
import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { HUB_TABLES } from './hub-mappers';
import { roleStatusAfterReject } from './hub-rules';

// Ana ekranların ihtiyaç duyduğu koleksiyonlar (paralel yüklenir).
// interviews tek aday için loadHistory() ile çekilir; touches/gates Bugün
// ekranı + akışları için, stageLog ise Hat dönüşüm oranları (§8.7) için global.
const COLLECTIONS = ['candidates', 'members', 'openRoles', 'roleLog', 'views', 'templates', 'touches', 'gates', 'stageLog', 'sources'];

const EMPTY = COLLECTIONS.reduce((o, k) => ((o[k] = []), o), {});

const HubStoreContext = createContext(null);
export function useHubStore() {
  const ctx = useContext(HubStoreContext);
  if (!ctx) throw new Error('useHubStore, <HubStoreProvider> içinde çağrılmalı');
  return ctx;
}

export function HubStoreProvider({ children }) {
  const [data, setData]           = useState(EMPTY);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [authEmail, setAuthEmail] = useState(null);

  // Giriş yapmış üyeyi tanımak için e-posta (owner_id / created_by / actor_id).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthEmail(session?.user?.email?.toLowerCase() || null);
    });
  }, []);

  const loadAll = useCallback(() => {
    setLoading(true);
    let cancelled = false;
    Promise.all(
      COLLECTIONS.map((c) => supabase.from(HUB_TABLES[c].table).select('*'))
    ).then((results) => {
      if (cancelled) return;
      const next = {};
      let firstErr = null;
      results.forEach((res, i) => {
        const c = COLLECTIONS[i];
        if (res.error) {
          firstErr = firstErr || res.error;
          console.error(`[Hub] ${HUB_TABLES[c].table}:`, res.error.message);
          next[c] = [];
        } else {
          next[c] = (res.data || []).map(HUB_TABLES[c].fromDb);
        }
      });
      setData(next);
      setLoadError(firstErr ? firstErr.message : null);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      console.error('[Hub] Yükleme hatası:', err.message);
      setLoadError(err.message);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => loadAll(), [loadAll]);

  const currentMember = useMemo(
    () => data.members.find((m) => (m.email || '').toLowerCase() === authEmail) || null,
    [data.members, authEmail]
  );

  // ── Genel CRUD ─────────────────────────────────────────────────────
  const addItem = useCallback((collection, item) => {
    const entry = HUB_TABLES[collection];
    if (!entry) return Promise.reject(new Error(`Bilinmeyen koleksiyon: ${collection}`));
    return supabase.from(entry.table).insert(entry.toDb(item)).select().single()
      .then(({ data: row, error }) => {
        if (error) throw new Error(error.message);
        const mapped = entry.fromDb(row);
        if (collection in data) {
          setData((prev) => ({ ...prev, [collection]: [mapped, ...prev[collection]] }));
        }
        return mapped;
      });
  }, [data]);

  const updateItem = useCallback((collection, id, updates) => {
    const entry = HUB_TABLES[collection];
    if (!entry) return Promise.reject(new Error(`Bilinmeyen koleksiyon: ${collection}`));
    const dbRecord = entry.toDb(updates);
    delete dbRecord.id; // PK asla güncellenmez
    return supabase.from(entry.table).update(dbRecord).eq('id', id).select().single()
      .then(({ data: row, error }) => {
        if (error) throw new Error(error.message);
        const mapped = entry.fromDb(row);
        if (collection in data) {
          setData((prev) => ({
            ...prev,
            [collection]: prev[collection].map((it) => (it.id === id ? mapped : it)),
          }));
        }
        return mapped;
      });
  }, [data]);

  const deleteItem = useCallback((collection, id) => {
    const entry = HUB_TABLES[collection];
    if (!entry) return Promise.reject(new Error(`Bilinmeyen koleksiyon: ${collection}`));
    if (collection in data) {
      setData((prev) => ({ ...prev, [collection]: prev[collection].filter((it) => it.id !== id) }));
    }
    return supabase.from(entry.table).delete().eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error(`[Hub] ${entry.table} silinemedi:`, error.message);
          throw new Error(error.message);
        }
      });
  }, [data]);

  // Yerel-yalnız kısmi güncelleme (optimistic / rollback).
  const patchLocal = useCallback((collection, id, partial) => {
    setData((prev) => ({
      ...prev,
      [collection]: prev[collection].map((it) => (it.id === id ? { ...it, ...partial } : it)),
    }));
  }, []);

  // ── Aday kısayolları ──────────────────────────────────────────────
  const addCandidate = useCallback(
    (c) => addItem('candidates', { createdBy: currentMember?.id ?? null, ...c }),
    [addItem, currentMember]
  );
  const updateCandidate = useCallback((id, u) => updateItem('candidates', id, u), [updateItem]);
  const deleteCandidate = useCallback((id) => deleteItem('candidates', id), [deleteItem]);
  const patchCandidate  = useCallback((id, p) => patchLocal('candidates', id, p), [patchLocal]);

  // Aşama geçiş günlüğü (§3 — "kim, ne zaman" otomatik kaydı). Kural
  // kontrolü (canAdvance) çağıran tarafta; burada yalnızca DB işi.
  const logStage = useCallback((candidateId, fromStage, toStage, reason = null) =>
    addItem('stageLog', { candidateId, fromStage, toStage, reason, actorId: currentMember?.id ?? null }),
    [addItem, currentMember]
  );

  // Aşama değiştir — TEK yer. HER aşama değişiminde stage_changed_at = now()
  // yazılır ve aynı işlemde hub_stage_log kaydı düşer (§9 bayatlama sayacı).
  // canAdvance kontrolü çağıran tarafta yapılır; burada yalnızca DB işi.
  // `extra` ile ek kolon değişimi (ör. archiveReason) aynı update'e girer.
  const advanceStage = useCallback(async (id, toStage, { reason = null, extra = {} } = {}) => {
    const row = data.candidates.find((c) => c.id === id);
    if (!row) return;
    const from = row.stage;
    const stamp = new Date().toISOString();
    const prev = { stage: from, stageChangedAt: row.stageChangedAt ?? null };
    Object.keys(extra).forEach((k) => { prev[k] = row[k]; });
    patchLocal('candidates', id, { stage: toStage, stageChangedAt: stamp, ...extra });
    try {
      await updateItem('candidates', id, { ...row, stage: toStage, stageChangedAt: stamp, ...extra });
      await logStage(id, from, toStage, reason);
    } catch (e) {
      patchLocal('candidates', id, prev);
      throw e;
    }
  }, [data, patchLocal, updateItem, logStage]);

  const STAGE_ORDER = ['pool', 'contacted', 'replied', 'interviewed', 'finalist', 'gate_a', 'gate_b', 'joined'];

  // ── Mesaj gönderme akışı (§8.5b) ────────────────────────────────
  // Sistem mesajı GÖNDERMEZ. "Kopyala" anında: hub_touches kaydı + adayı
  // contacted'a taşı (yalnızca contacted öncesindeyse) + 7 günlük follow_up_at
  // + son temas tarihi + şablonun sent_count'unu artır. Panoya kopyalama
  // çağıran tarafta (navigator.clipboard).
  const sendTouch = useCallback(async (candidate, { templateId = null, variant = null, channel, personalization = null }) => {
    const now = new Date();
    const followUp = new Date(now.getTime() + 7 * 86400000).toISOString();
    await addItem('touches', {
      candidateId: candidate.id,
      channel,
      templateId,
      variant,
      senderId: currentMember?.id ?? null,
      sentAt: now.toISOString(),
      outcome: 'pending',
      followUpAt: followUp,
      note: personalization,
    });

    const beforeContacted = STAGE_ORDER.indexOf(candidate.stage) < STAGE_ORDER.indexOf('contacted');
    if (beforeContacted) {
      await advanceStage(candidate.id, 'contacted', { reason: 'ilk mesaj', extra: { lastContactAt: now.toISOString() } });
    } else {
      patchLocal('candidates', candidate.id, { lastContactAt: now.toISOString() });
      await updateItem('candidates', candidate.id, { ...candidate, lastContactAt: now.toISOString() });
    }

    if (templateId) {
      const tpl = data.templates.find((t) => t.id === templateId);
      if (tpl) {
        patchLocal('templates', templateId, { sentCount: (tpl.sentCount || 0) + 1 });
        await updateItem('templates', templateId, { ...tpl, sentCount: (tpl.sentCount || 0) + 1 });
      }
    }
    return { advanced: beforeContacted };
  }, [addItem, advanceStage, updateItem, patchLocal, currentMember, data]);

  // "Cevap geldi" — aşama replied, son temasın outcome'u replied, şablonun
  // reply_count'u artar (§8.5b adım 7).
  const markReplied = useCallback(async (candidateId) => {
    const candidate = data.candidates.find((c) => c.id === candidateId);
    if (!candidate) return;
    const last = data.touches
      .filter((t) => t.candidateId === candidateId)
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0];
    if (last && last.outcome !== 'replied') {
      patchLocal('touches', last.id, { outcome: 'replied' });
      await updateItem('touches', last.id, { ...last, outcome: 'replied' });
      if (last.templateId) {
        const tpl = data.templates.find((t) => t.id === last.templateId);
        if (tpl) {
          patchLocal('templates', tpl.id, { replyCount: (tpl.replyCount || 0) + 1 });
          await updateItem('templates', tpl.id, { ...tpl, replyCount: (tpl.replyCount || 0) + 1 });
        }
      }
    }
    if (candidate.stage === 'contacted') {
      await advanceStage(candidateId, 'replied', { reason: 'cevap geldi' });
    }
  }, [data, patchLocal, updateItem, advanceStage]);

  // ── Kapılar (§2.5) ─────────────────────────────────────────────
  // Team sistemine YALNIZCA referansla bağlanır (startup_id + person_id yazılır);
  // app_state JSON bloğu okunmaz/yazılmaz (§4.6.2).
  const startGate = useCallback(async (candidate, gate, { taskText = null, dueAt, startupId = null, personId = null }) => {
    await addItem('gates', {
      candidateId: candidate.id, gate, startupId, personId,
      taskText, startedAt: new Date().toISOString(), dueAt, result: 'pending',
    });
    const toStage = gate === 'A' ? 'gate_a' : 'gate_b';
    const extra = gate === 'B' && startupId != null ? { startupId } : {};
    await advanceStage(candidate.id, toStage, { reason: `Kapı ${gate} başlatıldı`, extra });
  }, [addItem, advanceStage]);

  const markGate = useCallback((gateId, patch) => {
    const g = data.gates.find((x) => x.id === gateId);
    if (!g) return Promise.resolve();
    patchLocal('gates', gateId, patch);
    return updateItem('gates', gateId, { ...g, ...patch }).catch((e) => { patchLocal('gates', gateId, g); throw e; });
  }, [data, patchLocal, updateItem]);

  // "Ekibe aktar" — aşama joined. joined_at + vesting_start_date KOLONLARI
  // doldurulur (§6/0003); stage_log.reason'a da insan okusun diye yazılır
  // ama kaynak artık kolondur. vesting_start_date = Kapı A'nın ilk günü,
  // geriye dönük (§2.5).
  const moveToTeam = useCallback(async (candidateId) => {
    const gatesA = data.gates
      .filter((g) => g.candidateId === candidateId && g.gate === 'A' && g.startedAt)
      .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
    const vestingStart = gatesA[0] ? String(gatesA[0].startedAt).slice(0, 10) : null;
    const joinedAt = new Date().toISOString();
    await advanceStage(candidateId, 'joined', {
      reason: vestingStart ? `hak ediş başlangıcı: ${vestingStart} (Kapı A ilk günü)` : 'ekibe aktarıldı',
      extra: { joinedAt, vestingStartDate: vestingStart },
    });
    // §12.3 adım 7: aday joined olunca bağlı rol `filled` olur.
    const cand = data.candidates.find((c) => c.id === candidateId);
    if (cand?.openRoleId) {
      const role = data.openRoles.find((r) => r.id === cand.openRoleId);
      if (role && role.status !== 'filled') {
        const patch = { status: 'filled', filledAt: joinedAt };
        patchLocal('openRoles', role.id, patch);
        await updateItem('openRoles', role.id, { ...role, ...patch });
        await addItem('roleLog', { roleId: role.id, fromStatus: role.status, toStatus: 'filled', note: `${cand.fullName} ekibe katıldı`, actorId: currentMember?.id ?? null });
      }
    }
    return vestingStart;
  }, [data, advanceStage, patchLocal, updateItem, addItem, currentMember]);

  // ── Açık roller: durum makinesi (§12.2 / 12.3) ────────────────
  const logRoleStatus = useCallback((roleId, fromStatus, toStatus, note = null) =>
    addItem('roleLog', { roleId, fromStatus, toStatus, note, actorId: currentMember?.id ?? null }),
    [addItem, currentMember]
  );

  // Rol durumunu ilerlet + günlüğe yaz + ilgili zaman damgaları (§12.6).
  const advanceRole = useCallback(async (roleId, toStatus, { note = null, assignTo } = {}) => {
    const role = data.openRoles.find((r) => r.id === roleId);
    if (!role) return;
    const now = new Date().toISOString();
    const patch = { status: toStatus };
    if (toStatus === 'requested') {
      patch.requestedAt = role.requestedAt || now;
      patch.requestedBy = role.requestedBy || currentMember?.id || null;
    }
    if (toStatus === 'sourcing' && !role.assignedTo) {
      patch.assignedTo = assignTo || currentMember?.id || null;
    }
    if (toStatus === 'filled') patch.filledAt = now;
    const prev = {};
    Object.keys(patch).forEach((k) => { prev[k] = role[k]; });
    patchLocal('openRoles', roleId, patch);
    try {
      await updateItem('openRoles', roleId, { ...role, ...patch });
      await logRoleStatus(roleId, role.status, toStatus, note);
    } catch (e) {
      patchLocal('openRoles', roleId, prev);
      throw e;
    }
  }, [data, patchLocal, updateItem, logRoleStatus, currentMember]);

  // §12.3 adım 5: eşiği geçen adayı proje sahibine sun. Aday `presented_at` +
  // owner_decision='pending' alır (eski karar/gerekçe SIFIRLANIR — reddedilen
  // aday yeniden sunulabilir), açık role bağlanır, rol `shortlist` olur.
  // presentGate kontrolü çağıran tarafta (canPresent).
  const presentCandidate = useCallback(async (candidateId, roleId) => {
    const cand = data.candidates.find((c) => c.id === candidateId);
    if (!cand) return;
    const now = new Date().toISOString();
    const patch = { presentedAt: now, ownerDecision: 'pending', ownerDecisionNote: null, openRoleId: roleId };
    patchLocal('candidates', candidateId, patch);
    await updateItem('candidates', candidateId, { ...cand, ...patch });
    const role = data.openRoles.find((r) => r.id === roleId);
    if (role && role.status === 'sourcing') {
      await advanceRole(roleId, 'shortlist', { note: `${cand.fullName} sunuldu` });
    }
  }, [data, patchLocal, updateItem, advanceRole]);

  // §12.3 adım 6-7: proje sahibi kararı. GEREKÇE ZORUNLU.
  // Kabul → aday finalist + Kapı A başlar; rol shortlist'te kalır (aday joined
  //   olunca filled).
  // Ret → aday hatta kalır (recruiter arşivler veya başka role sunar). Rol
  //   ASILI BIRAKILMAZ (§12.3): bu role bağlı başka `pending` sunulmuş aday
  //   yoksa rol `sourcing`'e döner + hub_role_log'a not düşülür; varsa
  //   `shortlist`'te kalır.
  const ownerDecide = useCallback(async (candidateId, decision, note) => {
    if (!note || !note.trim()) throw new Error('Karar gerekçesi zorunludur.');
    const cand = data.candidates.find((c) => c.id === candidateId);
    if (!cand) return;
    const role = cand.openRoleId ? data.openRoles.find((r) => r.id === cand.openRoleId) : null;
    const patch = { ownerDecision: decision, ownerDecisionNote: note.trim() };
    if (decision === 'accepted' && role?.startupId != null) patch.startupId = role.startupId;
    patchLocal('candidates', candidateId, patch);
    await updateCandidate(candidateId, { ...cand, ...patch });

    if (decision === 'accepted') {
      const c2 = { ...cand, ...patch };
      await advanceStage(candidateId, 'finalist', { reason: 'proje sahibi kabul etti' });
      const due = new Date(Date.now() + 72 * 3600000).toISOString();
      await startGate({ ...c2, stage: 'finalist' }, 'A', {
        taskText: role?.firstDeliverable || null, dueAt: due, startupId: role?.startupId ?? null,
      });
      if (role) {
        patchLocal('openRoles', role.id, { acceptedAt: new Date().toISOString() });
        await updateItem('openRoles', role.id, { ...role, acceptedAt: new Date().toISOString() });
      }
    } else if (decision === 'rejected' && role) {
      if (roleStatusAfterReject(role, data.candidates, candidateId) === 'sourcing') {
        await advanceRole(role.id, 'sourcing', { note: 'aday reddedildi, arama sürüyor' });
      }
    }
  }, [data, patchLocal, updateCandidate, updateItem, advanceStage, advanceRole, startGate]);

  // ── İçe aktarma (§8.6.3) ───────────────────────────────────────
  // Ham metin hub_import_batches.raw_text'e saklanır. Kabul edilen her satır
  // pool'a yeni aday olur; kvkk alanları doldurulur. applications kaydı ASLA
  // taşınmaz/değiştirilmez — kopyalanır, source_ref'e id yazılır (§4.6.3).
  const importCandidates = useCallback(async (batchInfo, rows) => {
    const accepted = rows.filter((r) => r._take);
    const batch = await addItem('batches', {
      method: batchInfo.method,
      source: batchInfo.source,
      sourceDetail: batchInfo.sourceDetail || null,
      eventDate: batchInfo.eventDate || null,
      rawText: batchInfo.rawText || null,
      parsedCount: rows.length,
      acceptedCount: accepted.length,
      createdBy: currentMember?.id ?? null,
    });
    const retainUntil = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    const created = [];
    for (const r of accepted) {
      const c = await addItem('candidates', {
        fullName: r.fullName || '(isimsiz)',
        email: r.email || null,
        linkedin: r.linkedin || null,
        github: r.github || null,
        university: r.university || null,
        department: r.department || null,
        roleType: r.roleType || batchInfo.roleType || null,
        source: batchInfo.source,
        sourceDetail: batchInfo.sourceDetail || null,
        sourceRef: r.sourceRef || null,
        batchId: batch?.id ?? null,
        evidence: r.evidence || [],
        dataTrust: r.dataTrust || 'guess',
        stage: 'pool',
        createdBy: currentMember?.id ?? null,
        kvkkConsent: false,
        kvkkAt: null,
        retainUntil,
      });
      created.push(c);
    }
    return { batch, created };
  }, [addItem, currentMember]);

  // ── KVKK: adayı tamamen sil (§8.6.10 / §12) ───────────────────
  // Bağlı kayıtlar (touches / interviews / gates / stage_log) FK on delete
  // cascade ile gider. Ham yapıştırma metni: batch'te başka aday kalmadıysa
  // hub_import_batches satırı da silinir.
  const purgeCandidate = useCallback(async (id) => {
    const cand = data.candidates.find((c) => c.id === id);
    const { error } = await supabase.from('hub_candidates').delete().eq('id', id);
    if (error) throw new Error(error.message);
    setData((prev) => ({ ...prev, candidates: prev.candidates.filter((c) => c.id !== id) }));
    if (cand?.batchId) {
      const { count } = await supabase
        .from('hub_candidates').select('id', { count: 'exact', head: true })
        .eq('batch_id', cand.batchId);
      if (!count) await supabase.from('hub_import_batches').delete().eq('id', cand.batchId);
    }
  }, [data]);

  // Tek adayın geçmişi — "Geçmiş" sekmesi için ihtiyaç anında.
  const loadHistory = useCallback(async (candidateId) => {
    const [touches, interviews, gates, stageLog] = await Promise.all([
      supabase.from('hub_touches').select('*').eq('candidate_id', candidateId).order('sent_at', { ascending: false }),
      supabase.from('hub_interviews').select('*').eq('candidate_id', candidateId).order('held_at', { ascending: false }),
      supabase.from('hub_gates').select('*').eq('candidate_id', candidateId).order('started_at', { ascending: false }),
      supabase.from('hub_stage_log').select('*').eq('candidate_id', candidateId).order('created_at', { ascending: false }),
    ]);
    return {
      touches:    (touches.data    || []).map(HUB_TABLES.touches.fromDb),
      interviews: (interviews.data || []).map(HUB_TABLES.interviews.fromDb),
      gates:      (gates.data      || []).map(HUB_TABLES.gates.fromDb),
      stageLog:   (stageLog.data   || []).map(HUB_TABLES.stageLog.fromDb),
    };
  }, []);

  const value = {
    data,
    ...data,                // candidates, members, openRoles, views, templates
    loading,
    loadError,
    currentMember,
    reload: loadAll,
    addItem, updateItem, deleteItem, patchLocal,
    addCandidate, updateCandidate, deleteCandidate, patchCandidate,
    logStage, advanceStage, loadHistory,
    sendTouch, markReplied,
    startGate, markGate, moveToTeam,
    importCandidates, purgeCandidate,
    logRoleStatus, advanceRole, presentCandidate, ownerDecide,
  };

  // Konsoldan aday ekle/güncelle/sil denemesi için (yalnızca geliştirme).
  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    window.__hubStore = value;
  }

  return <HubStoreContext.Provider value={value}>{children}</HubStoreContext.Provider>;
}
