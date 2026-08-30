// use-perms.jsx — giriş yapan kullanıcının etkin yetkileri (my_permissions RPC).
// Menüler ve aksiyon butonları buna göre çizilir; asıl kapı RLS'tir.
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';

const PermsContext = createContext(null);

export function PermsProvider({ area, children }) {
  const [granted, setGranted] = useState(() => new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('my_permissions');
    const s = new Set();
    if (!error) {
      for (const r of data || []) {
        if (r.granted && (!area || r.area === area)) s.add(r.key);
      }
    }
    setGranted(s);
    setLoading(false);
  }, [area]);

  useEffect(() => { load(); }, [load]);

  const value = {
    loading,
    can: (key) => granted.has(key),
    canAny: (...keys) => keys.some((k) => granted.has(k)),
    reload: load,
  };
  return <PermsContext.Provider value={value}>{children}</PermsContext.Provider>;
}

export function usePerms() {
  const ctx = useContext(PermsContext);
  // Provider yoksa her şeyi kapalı say (güvenli varsayılan).
  return ctx || { loading: false, can: () => false, canAny: () => false, reload: () => {} };
}
