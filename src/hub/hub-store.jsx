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
// Aday geçmişi (touches / interviews / gates / stageLog) tek aday için
// loadHistory() ile ihtiyaç anında çekilir.
const COLLECTIONS = ['candidates', 'members', 'openRoles', 'views', 'templates'];

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
    logStage, loadHistory,
  };

  // Konsoldan aday ekle/güncelle/sil denemesi için (yalnızca geliştirme).
  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    window.__hubStore = value;
  }

  return <HubStoreContext.Provider value={value}>{children}</HubStoreContext.Provider>;
}
