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

// Ana ekranların ihtiyaç duyduğu koleksiyonlar (paralel yüklenir).
// interviews / stageLog tek aday için loadHistory() ile ihtiyaç anında çekilir;
// touches ve gates ise Bugün ekranı + temas/kapı akışları için global tutulur.
const COLLECTIONS = ['candidates', 'members', 'openRoles', 'views', 'templates', 'touches', 'gates'];

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

  // "Ekibe aktar" — aşama joined; hak ediş başlangıcı Kapı A'nın ilk günü
  // (geriye dönük, §2.5). Ayrı kolon yok — stage_log.reason'a yazılır.
  const moveToTeam = useCallback(async (candidateId) => {
    const gatesA = data.gates
      .filter((g) => g.candidateId === candidateId && g.gate === 'A' && g.startedAt)
      .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
    const vestingStart = gatesA[0] ? String(gatesA[0].startedAt).slice(0, 10) : null;
    await advanceStage(candidateId, 'joined', {
      reason: vestingStart ? `hak ediş başlangıcı: ${vestingStart} (Kapı A ilk günü)` : 'ekibe aktarıldı',
    });
    return vestingStart;
  }, [data, advanceStage]);

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
  };

  // Konsoldan aday ekle/güncelle/sil denemesi için (yalnızca geliştirme).
  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    window.__hubStore = value;
  }

  return <HubStoreContext.Provider value={value}>{children}</HubStoreContext.Provider>;
}
