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
import { roleStatusAfterReject, inheritedTrack, undoPlan } from './hub-rules';
import { findDuplicate } from './hub-parse';
import { STAGE_ORDER } from './hub-constants';

// Ana ekranların ihtiyaç duyduğu koleksiyonlar (paralel yüklenir).
// v2: roleLog / views / sources düştü (menüde yok). interviews tek aday için
// loadHistory() ile; touches/gates Bugün ekranı için; stageLog dönüşüm için.
const COLLECTIONS = ['candidates', 'members', 'openRoles', 'templates', 'touches', 'gates', 'stageLog', 'sources', 'folders'];

const EMPTY = { ...COLLECTIONS.reduce((o, k) => ((o[k] = []), o), {}), hiddenHub: [] };

// HR yalnızca LAB (startup) başvurularını alır (0041). Eskiden HUB (topluluk) başvurusu olarak
// otomatik Adaylar'a düşmüş, henüz dokunulmamış ('pool') kayıtlar burada görünmez — bu kişiler
// Hub başvuru tablosuna (Google Sheets) aktarılır. Silinmez; yalnızca mükerrer kontrolünde tutulur.
const isHubOrigin = (c) => c.source === 'inbound' && c.stage === 'pool'
  && /^(community|hub)(\s—|$)|^Hub ·/.test(c.whyThisOne || '');

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
      next.hiddenHub = next.candidates.filter(isHubOrigin);
      next.candidates = next.candidates.filter((c) => !isHubOrigin(c));
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
    // toDb() mapper'ları TAM bir öğe bekler (eksik alanı ''/false/null
    // varsayılanına çevirir) — admin-store.jsx'te aynı desenin kısmi bir
    // `updates` ile çağrılınca tüm satırı sessizce boşalttığı canlı bir
    // olayla ortaya çıktı (bkz. 2026-09-15 postmortem). Buradaki tüm
    // mevcut çağıranlar zaten tam nesne gönderiyor ama önlem olarak aynı
    // kök-düzeltme: DB'ye yazmadan önce mevcut bilinen öğeyle birleştir.
    const current = (data[collection] || []).find((it) => it.id === id) || {};
    const dbRecord = entry.toDb({ ...current, ...updates });
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
    // ÖNCE DB, sonra yerel. Optimistik silme YOK: FK ihlali / RLS reddinde
    // satır ekranda kaybolup DB'de kalmasın (çağıran .catch ile mesaj gösterir).
    return supabase.from(entry.table).delete().eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error(`[Hub] ${entry.table} silinemedi:`, error.message);
          throw new Error(error.message);
        }
        if (collection in data) {
          setData((prev) => ({ ...prev, [collection]: prev[collection].filter((it) => it.id !== id) }));
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

  // Adayı açık role bağla/çöz. §12.1 — bağlarken track ROLDEN miras alınır
  // (kullanıcı aday kartından sonra elle değiştirebilir). Bağlantı kaldırılınca
  // track olduğu gibi kalır — geri alma yok.
  const linkCandidateRole = useCallback(async (candidateId, roleId) => {
    const cand = data.candidates.find((c) => c.id === candidateId);
    if (!cand) return;
    let patch;
    if (!roleId) {
      patch = { openRoleId: null };
    } else {
      const role = data.openRoles.find((r) => r.id === roleId);
      patch = { openRoleId: roleId, track: inheritedTrack(role, cand.track) };
    }
    patchCandidate(candidateId, patch);
    await updateCandidate(candidateId, { ...cand, ...patch });
  }, [data, patchCandidate, updateCandidate]);

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

  // ── Mesaj gönderme akışı (v2 §9) ───────────────────────────────
  // Sistem mesajı GÖNDERMEZ. "Kopyala" anında: hub_touches kaydı + adayı
  // Temas'a taşı (yalnızca Temas öncesindeyse) + 7 günlük follow_up_at
  // + son temas tarihi + şablonun sent_count'unu artır.
  const sendTouch = useCallback(async (candidate, { templateId = null, variant = null, channel, personalization = null }) => {
    const now = new Date();
    const followUp = new Date(now.getTime() + 7 * 86400000).toISOString();
    // Çağıran bayat bir aday nesnesi geçmiş olabilir (aday kartı / hızlı eleme
    // ayrı yerlerden çağırıyor) — aşama kontrolünü CANLI cache'ten yap.
    const live = data.candidates.find((c) => c.id === candidate.id) || candidate;
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

    const beforeContact = STAGE_ORDER.indexOf(live.stage) < STAGE_ORDER.indexOf('contact');
    if (beforeContact) {
      await advanceStage(candidate.id, 'contact', { reason: 'ilk mesaj', extra: { lastContactAt: now.toISOString() } });
    } else {
      patchLocal('candidates', candidate.id, { lastContactAt: now.toISOString() });
      await updateItem('candidates', candidate.id, { ...live, lastContactAt: now.toISOString() });
    }

    if (templateId) {
      const tpl = data.templates.find((t) => t.id === templateId);
      if (tpl) {
        patchLocal('templates', templateId, { sentCount: (tpl.sentCount || 0) + 1 });
        await updateItem('templates', templateId, { ...tpl, sentCount: (tpl.sentCount || 0) + 1 });
      }
    }
    return { advanced: beforeContact };
  }, [addItem, advanceStage, updateItem, patchLocal, currentMember, data]);

  // "Cevap geldi" (v2 §2) — cevap durumu YALNIZCA hub_touches.outcome'da
  // tutulur; ayrı bir "Cevap" aşaması YOK (Temas kapsar). Şablonun
  // reply_count'u artar.
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
  }, [data, patchLocal, updateItem]);

  // "Cevap geldi, görüşmeye geç" (PROMPT_V3 A2) — TEK aksiyon: son touch
  // outcome'ı replied + aday interview aşamasına. hub_stage_log'a TEK satır
  // (advanceStage'ten). Cevap ama görüşme ayarlanmadı diye ayrı durum yok.
  const replyAndAdvance = useCallback(async (candidateId) => {
    await markReplied(candidateId);
    const cand = data.candidates.find((c) => c.id === candidateId);
    if (cand && STAGE_ORDER.indexOf(cand.stage) < STAGE_ORDER.indexOf('interview')) {
      await advanceStage(candidateId, 'interview', { reason: 'cevap geldi, görüşmeye geçildi' });
    }
  }, [data, markReplied, advanceStage]);

  // Geri alma (PROMPT_V3 A3 + Blok A düzeltmeleri) — son GERÇEK ilerlemeyi geri
  // sarar (bkz. undoPlan: extendGate ve önceki geri-alma satırları atlanır).
  // Eski satır SİLİNMEZ; yeni satır yazılır.
  //   - arşivden geri alma → archive_reason temizlenir
  //   - ekibe alma geri alma → aşama trial'a, joined_at + vesting_start_date
  //     temizlenir, bağlı rol filled → shortlist + filled_at null olur, log
  //     reason'ı 'ekibe alma geri alındı'. (C4 öncesi Hub-içi etki olduğu için
  //     güvenli — HUB_SPEC v3 §2.4 notu.)
  const undoLastStage = useCallback(async (candidateId) => {
    const cand = data.candidates.find((c) => c.id === candidateId);
    if (!cand) return;
    const plan = undoPlan(cand, data.stageLog);
    if (!plan) throw new Error('Geri alınacak bir aşama değişikliği yok.');

    const wasMember = cand.stage === 'member';
    const extra = {};
    if (cand.stage === 'archived') extra.archiveReason = null;
    let reason = 'geri alındı';
    if (wasMember) {
      reason = 'ekibe alma geri alındı';
      extra.joinedAt = null;
      extra.vestingStartDate = null;
    }

    await advanceStage(candidateId, plan.toStage, { reason, extra });

    if (wasMember && cand.openRoleId) {
      const roleRow = data.openRoles.find((r) => r.id === cand.openRoleId);
      if (roleRow && roleRow.status === 'filled') {
        const patch = { status: 'shortlist', filledAt: null };
        patchLocal('openRoles', roleRow.id, patch);
        await updateItem('openRoles', roleRow.id, { ...roleRow, ...patch });
      }
    }
  }, [data, advanceStage, patchLocal, updateItem]);

  // D3 — hızlı elemede "Mesaj gönder"in geri alınması: son touch'ı sil, aday
  // sendTouch ile Havuz'dan Temas'a çıktıysa Havuz'a döndür.
  const undoSend = useCallback(async (candidateId) => {
    const last = data.touches
      .filter((t) => t.candidateId === candidateId)
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0];
    if (last) await deleteItem('touches', last.id);
    const cand = data.candidates.find((c) => c.id === candidateId);
    if (cand && cand.stage === 'contact') {
      const plan = undoPlan(cand, data.stageLog);
      if (plan && plan.toStage === 'pool') await undoLastStage(candidateId);
    }
  }, [data, deleteItem, undoLastStage]);

  // C2 / C3 — adaya giden onaylı mail (görüşme kararı, Kapı görevi …).
  // OTOMATİK DEĞİL: kullanıcı metni onaylayıp çağırır. send-mail (Resend)
  // üzerinden gider; gönderilen mail hub_touches'a channel:'email' kaydı düşer.
  const sendCandidateMail = useCallback(async (candidate, { subject, body }) => {
    if (!candidate?.email) throw new Error('Adayın e-postası yok.');
    const { data, error } = await supabase.functions.invoke('send-mail', {
      body: { to: candidate.email, subject, body },
    });
    if (error || data?.error) {
      throw new Error(error?.message || (data?.error ? JSON.stringify(data.error) : 'Mail gönderilemedi.'));
    }
    await addItem('touches', {
      candidateId: candidate.id,
      channel: 'email',
      senderId: currentMember?.id ?? null,
      sentAt: new Date().toISOString(),
      outcome: 'pending',
      note: subject,
    });
    return data;
  }, [addItem, currentMember]);

  // ── Kapılar (v2 §2.1–2.2) ─────────────────────────────────────
  // Kapı A/B ayrı AŞAMA değil — aday `trial`'da kalır, hub_gates satırı açılır.
  // Team sistemine yalnızca referansla bağlanır (startup_id + person_id).
  const startGate = useCallback(async (candidate, gate, { taskText = null, dueAt, startupId = null, personId = null }) => {
    await addItem('gates', {
      candidateId: candidate.id, gate, startupId, personId,
      taskText, startedAt: new Date().toISOString(), dueAt, extendedDays: 0, result: 'pending',
    });
    // Aday zaten trial'da; yalnızca ilk kez trial'a girecekse taşı.
    if (STAGE_ORDER.indexOf(candidate.stage) < STAGE_ORDER.indexOf('trial')) {
      await advanceStage(candidate.id, 'trial', { reason: `Kapı ${gate} başlatıldı` });
    }
  }, [addItem, advanceStage]);

  const markGate = useCallback((gateId, patch) => {
    const g = data.gates.find((x) => x.id === gateId);
    if (!g) return Promise.resolve();
    patchLocal('gates', gateId, patch);
    return updateItem('gates', gateId, { ...g, ...patch }).catch((e) => { patchLocal('gates', gateId, g); throw e; });
  }, [data, patchLocal, updateItem]);

  // Süre uzatma (v2 §2.2) — extended_days'e ekler, hub_stage_log'a OTOMATİK
  // not düşer (kim, ne zaman, ne kadar). İnsan metni girmez.
  const extendGate = useCallback(async (gateId, days) => {
    const g = data.gates.find((x) => x.id === gateId);
    if (!g) return;
    const next = (g.extendedDays || 0) + Number(days);
    patchLocal('gates', gateId, { extendedDays: next });
    try {
      await updateItem('gates', gateId, { ...g, extendedDays: next });
      await logStage(g.candidateId, 'trial', 'trial', `Kapı ${g.gate} süresi +${days} gün uzatıldı`);
    } catch (e) {
      patchLocal('gates', gateId, { extendedDays: g.extendedDays || 0 });
      throw e;
    }
  }, [data, patchLocal, updateItem, logStage]);

  // "Ekibe al" (C4) — gerçek team köprüsü, hub-move-to-team edge function'ı
  // (servis rolü): aşama→member, people roster kaydı, startups.member_ids,
  // invite-member(area:'team') + markalı davet maili, person_id geri yaz,
  // rol→filled. Client-side RLS bu tabloların çoğunu yazamadığı için fonksiyon
  // şart. Kısmi başarı → { warnings } döner; çağıran kullanıcıya gösterir.
  // Dönüş: { vestingStart, steps, warnings }.
  const moveToTeam = useCallback(async (candidateId) => {
    const { data: res, error } = await supabase.functions.invoke('hub-move-to-team', {
      body: { candidateId },
    });
    if (error || res?.error) {
      throw new Error(error?.message || res?.error || 'Ekibe aktarılamadı.');
    }
    // Yerel cache'i tazele (fonksiyon DB'yi doğrudan değiştirdi).
    const cand = data.candidates.find((c) => c.id === candidateId);
    if (cand) {
      patchLocal('candidates', candidateId, {
        stage: 'member',
        joinedAt: new Date().toISOString(),
        vestingStartDate: res?.vestingStart ?? null,
        personId: res?.personId ?? cand.personId ?? null,
      });
      if (cand.openRoleId && res?.steps?.roleFilled) {
        patchLocal('openRoles', cand.openRoleId, { status: 'filled', filledAt: new Date().toISOString() });
      }
    }
    return { vestingStart: res?.vestingStart ?? null, steps: res?.steps || {}, warnings: res?.warnings || [] };
  }, [data, patchLocal]);

  // ── Açık roller: durum makinesi (v2 §10.1 — talep akışı yok) ──
  const advanceRole = useCallback(async (roleId, toStatus, { assignTo } = {}) => {
    const role = data.openRoles.find((r) => r.id === roleId);
    if (!role) return;
    const now = new Date().toISOString();
    const patch = { status: toStatus };
    if (toStatus === 'sourcing' && !role.assignedTo) {
      patch.assignedTo = assignTo || currentMember?.id || null;
    }
    if (toStatus === 'filled') patch.filledAt = now;
    const prev = {};
    Object.keys(patch).forEach((k) => { prev[k] = role[k]; });
    patchLocal('openRoles', roleId, patch);
    try {
      await updateItem('openRoles', roleId, { ...role, ...patch });
    } catch (e) {
      patchLocal('openRoles', roleId, prev);
      throw e;
    }
  }, [data, patchLocal, updateItem, currentMember]);

  // §12.3 adım 5: eşiği geçen adayı proje sahibine sun. Aday `presented_at` +
  // owner_decision='pending' alır (eski karar/gerekçe SIFIRLANIR — reddedilen
  // aday yeniden sunulabilir), açık role bağlanır, rol `shortlist` olur.
  // presentGate kontrolü çağıran tarafta (canPresent).
  const presentCandidate = useCallback(async (candidateId, roleId) => {
    const cand = data.candidates.find((c) => c.id === candidateId);
    if (!cand) return;
    const role = data.openRoles.find((r) => r.id === roleId);
    const now = new Date().toISOString();
    const patch = {
      presentedAt: now, ownerDecision: 'pending', ownerDecisionNote: null,
      openRoleId: roleId, track: inheritedTrack(role, cand.track),   // §12.1 miras
    };
    patchLocal('candidates', candidateId, patch);
    await updateItem('candidates', candidateId, { ...cand, ...patch });
    if (role && role.status === 'sourcing') {
      await advanceRole(roleId, 'shortlist');
    }
  }, [data, patchLocal, updateItem, advanceRole]);

  // Proje sahibi kararı (v2 §10.1). GEREKÇE ZORUNLU.
  // Kabul → aday Deneme'ye (trial) + Kapı A başlar; rol shortlist'te kalır
  //   (aday member olunca filled).
  // Ret → aday hatta kalır. Rol ASILI BIRAKILMAZ: bu role bağlı başka
  //   `pending` sunulmuş aday yoksa rol `sourcing`'e döner; varsa shortlist.
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
      await advanceStage(candidateId, 'trial', { reason: 'proje sahibi kabul etti' });
      const due = new Date(Date.now() + 72 * 3600000).toISOString();
      await startGate({ ...c2, stage: 'trial' }, 'A', {
        taskText: role?.firstDeliverable || null, dueAt: due, startupId: role?.startupId ?? null,
      });
    } else if (decision === 'rejected' && role) {
      if (roleStatusAfterReject(role, data.candidates, candidateId) === 'sourcing') {
        await advanceRole(role.id, 'sourcing');
      }
    }
  }, [data, patchLocal, updateCandidate, advanceStage, advanceRole, startGate]);

  // ── İçe aktarma (v2 §6) — CSV/Excel, senkron ─────────────────
  // Ayrı `hub_import_batches` tablosu YOK — kabul edilen her satır pool'a yeni
  // aday olur, hepsine aynı serbest `importBatchLabel` yazılır (filtre amaçlı).
  const importCandidates = useCallback(async (batchInfo, rows) => {
    // D2 — _mode: 'new' (varsayılan) | 'update' (mevcut kartı doldur) | 'skip'
    const accepted = rows.filter((r) => r._take && r._mode !== 'skip');
    const retainUntil = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    const label = batchInfo.importBatchLabel || batchInfo.sourceDetail || null;
    const batchRoleId = batchInfo.roleId ?? null;
    const created = [];
    const updated = [];
    // Blok D düzeltmesi (mükerrer): önizleme yalnızca HAVUZa karşı bakıyordu;
    // aynı partide iki kez geçen kişi iki kayıt oluyordu. Burada büyüyen bir
    // havuza (mevcut + bu partide açılanlar) karşı tekrar bakılır.
    const pool = [...data.candidates, ...data.hiddenHub];
    for (const r of accepted) {
      // ── Mevcut kartı güncelle (yeni kayıt açma) ──────────────
      let dupId = (r._mode === 'update' && r._dupId) ? r._dupId : null;
      if (!dupId && r._mode !== 'skip') {
        const d = findDuplicate(r, pool);
        if (d) dupId = d.id;   // parti-içi veya önizlemede kaçmış mükerrer
      }
      if (dupId) {
        const ex = pool.find((c) => c.id === dupId) || data.candidates.find((c) => c.id === dupId);
        if (ex) {
          const patch = {};
          if (!ex.email && r.email) patch.email = r.email;
          if (!ex.linkedin && r.linkedin) patch.linkedin = r.linkedin;
          if (!ex.github && r.github) patch.github = r.github;
          if (!ex.university && r.university) patch.university = r.university;
          if (!ex.interest && (r.interest || batchInfo.interest)) patch.interest = r.interest || batchInfo.interest;
          if (!ex.folderId && (r.folderId || batchInfo.folderId)) patch.folderId = r.folderId || batchInfo.folderId;
          if (!ex.whyThisOne && r.whyThisOne) patch.whyThisOne = r.whyThisOne;
          if (!ex.sourceDetail && (r.sourceDetail || batchInfo.sourceDetail)) {
            patch.sourceDetail = r.sourceDetail || batchInfo.sourceDetail;
          }
          const have = new Set((ex.evidence || []).map((e) => e.url));
          const addEv = (r.evidence || []).filter((e) => e.url && !have.has(e.url));
          if (addEv.length) patch.evidence = [...(ex.evidence || []), ...addEv];
          if (Object.keys(patch).length) {
            patchLocal('candidates', ex.id, patch);
            await updateItem('candidates', ex.id, { ...ex, ...patch });
          }
          updated.push(ex.id);
          continue;
        }
      }
      // ── Yeni aday ───────────────────────────────────────────
      const roleId = r.roleId ?? batchRoleId;
      const role = roleId ? data.openRoles.find((x) => x.id === roleId) : null;
      const c = await addItem('candidates', {
        fullName: r.fullName || '(isimsiz)',
        email: r.email || null,
        linkedin: r.linkedin || null,
        github: r.github || null,
        university: r.university || null,
        interest: r.interest || batchInfo.interest || null,
        folderId: r.folderId || batchInfo.folderId || null,
        roleType: r.roleType || batchInfo.roleType || null,
        source: batchInfo.source || 'other',
        sourceDetail: r.sourceDetail || batchInfo.sourceDetail || null,
        sourceRef: r.sourceRef || null,
        importBatchLabel: label,
        openRoleId: roleId,
        track: role ? inheritedTrack(role) : undefined,
        whyThisOne: r.whyThisOne || null,
        evidence: r.evidence || [],
        // E5 — GitHub taramasından gelen ön puan / sinyaller (rubriğin yerine GEÇMEZ)
        city: r.city || null,
        enrichment: r.enrichment || undefined,
        enrichedAt: r.enrichedAt || (r.enrichment ? r.enrichment.fetched_at : undefined),
        aiScore: r.aiScore ?? undefined,
        aiScoreNote: r.aiScoreNote || undefined,
        stage: 'pool',
        createdBy: currentMember?.id ?? null,
        kvkkConsent: false,
        kvkkAt: null,
        retainUntil,
      });
      created.push(c);
      pool.push(c);   // sonraki satırlar bu adayı da mükerrer kontrolünde görsün
    }
    return { created, updated, label };
  }, [addItem, updateItem, patchLocal, currentMember, data]);

  // ── KVKK: adayı tamamen sil (v2 §13) ─────────────────────────
  // Bağlı kayıtlar (touches / interviews / gates / stage_log) FK on delete
  // cascade ile gider.
  const purgeCandidate = useCallback(async (id) => {
    const { error } = await supabase.from('hub_candidates').delete().eq('id', id);
    if (error) throw new Error(error.message);
    setData((prev) => ({ ...prev, candidates: prev.candidates.filter((c) => c.id !== id) }));
  }, []);

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
    sendTouch, markReplied, replyAndAdvance, undoLastStage, undoSend, sendCandidateMail,
    startGate, markGate, extendGate, moveToTeam,
    importCandidates, purgeCandidate,
    advanceRole, presentCandidate, ownerDecide, linkCandidateRole,
  };

  // Konsoldan aday ekle/güncelle/sil denemesi için (yalnızca geliştirme).
  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    window.__hubStore = value;
  }

  return <HubStoreContext.Provider value={value}>{children}</HubStoreContext.Provider>;
}
