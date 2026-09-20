// use-inbound.js — Inbound başvuruları: yükleme + aşama/not/puan/sahip güncelleme.
// Optimistik güncelleme: önce yerel state, sonra DB; hata olursa geri al.
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { mapApplication } from './inbound-model';

// Sol menüdeki rozetin yenilenmesi için (hub-app.jsx dinler).
export const INBOUND_CHANGED = 'hub-inbound-changed';
const announce = () => window.dispatchEvent(new Event(INBOUND_CHANGED));

export function useInbound() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [me, setMe] = useState(null);
  const appsRef = useRef(apps);
  appsRef.current = apps;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setMe(session?.user?.email?.toLowerCase() || null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.from('applications').select('*').order('created_at', { ascending: false });
    if (err) { setError(err.message); setApps([]); }
    else { setError(''); setApps((data || []).map(mapApplication)); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Sekmeye dönünce tazele (başka biri yeni başvuru almış olabilir).
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [load]);

  const patchLocal = useCallback((id, partial) => {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...partial } : a)));
  }, []);

  // patch: arayüz alanları ({stage, ownerEmail, rating, lastContactAt, activity, stageChangedAt});
  // dbPatch: karşılık gelen DB kolonları. Hata → geri al + mesaj döner ('' = başarılı).
  const save = useCallback(async (id, patch, dbPatch) => {
    const before = appsRef.current.find((a) => a.id === id);
    if (!before) return 'Kayıt bulunamadı.';
    const rollback = Object.fromEntries(Object.keys(patch).map((k) => [k, before[k]]));
    patchLocal(id, patch);
    const { error: err } = await supabase.from('applications').update(dbPatch).eq('id', id);
    if (err) { patchLocal(id, rollback); return err.message; }
    announce();
    return '';
  }, [patchLocal]);

  const entry = (type, extra = {}) => ({ at: new Date().toISOString(), by: me, type, ...extra });

  const changeStage = useCallback((id, to, reason) => {
    const a = appsRef.current.find((x) => x.id === id);
    if (!a || a.stage === to) return Promise.resolve('');
    const now = new Date().toISOString();
    const activity = [...a.activity, entry('stage', { from: a.stage, to, ...(reason ? { text: reason } : {}) })];
    return save(id, { stage: to, stageChangedAt: now, activity },
      { status: to, stage_changed_at: now, activity });
  }, [save, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const addNote = useCallback((id, text) => {
    const a = appsRef.current.find((x) => x.id === id);
    if (!a || !text.trim()) return Promise.resolve('');
    const activity = [...a.activity, entry('note', { text: text.trim() })];
    return save(id, { activity }, { activity });
  }, [save, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const logContact = useCallback((id, text) => {
    const a = appsRef.current.find((x) => x.id === id);
    if (!a) return Promise.resolve('');
    const now = new Date().toISOString();
    const activity = [...a.activity, entry('contact', { text })];
    return save(id, { lastContactAt: now, activity }, { last_contact_at: now, activity });
  }, [save, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const setOwner = useCallback((id, email) => {
    const a = appsRef.current.find((x) => x.id === id);
    if (!a) return Promise.resolve('');
    const activity = [...a.activity, entry('owner', { text: email ? `Üstlenen: ${email}` : 'Sahiplik kaldırıldı' })];
    return save(id, { ownerEmail: email || null, activity }, { owner_email: email || null, activity });
  }, [save, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleOnboard = useCallback((id, key, label, done) => {
    const a = appsRef.current.find((x) => x.id === id);
    if (!a) return Promise.resolve('');
    const activity = [...a.activity, entry('onboard', { key, done, text: `${done ? '✓' : '↺'} ${label}` })];
    return save(id, { activity }, { activity });
  }, [save, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const setRating = useCallback((id, rating) => save(id, { rating }, { rating }), [save]);

  const remove = useCallback(async (id) => {
    const { error: err } = await supabase.from('applications').delete().eq('id', id);
    if (err) return err.message;
    setApps((prev) => prev.filter((a) => a.id !== id));
    announce();
    return '';
  }, []);

  return { apps, loading, error, me, reload: load, changeStage, addNote, logContact, setOwner, setRating, toggleOnboard, remove };
}
