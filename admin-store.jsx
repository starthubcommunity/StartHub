// admin-store.jsx — Data store with localStorage persistence + trash + site stats
const { useState: useStateS, useEffect: useEffectS, useCallback: useCallbackS, createContext: createContextS, useContext: useContextS } = React;

const STORAGE_KEY = 'sh_admin_data';
const TRASH_KEY = 'sh_admin_trash';

function loadStore() {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch(e) {}
  return null;
}
function saveStore(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch(e) { console.warn('Kayıt başarısız (depolama dolu olabilir):', e); return false; }
}
function loadTrash() {
  try { const s = localStorage.getItem(TRASH_KEY); if (s) return JSON.parse(s); } catch(e) {}
  return [];
}

const clone = (obj) => JSON.parse(JSON.stringify(obj));
const uid = () => Date.now() + Math.random().toString(36).slice(2, 8);
const SEED = () => (window.SH_DEFAULTS || { people: window.people, startups: window.startups, posts: window.posts, sponsors: window.sponsors, events: window.events || [] });

// Bring sponsors up to the current schema, and one-time re-add any seed
// sponsors that are missing (so previously-removed defaults come back once).
function reconcileSponsors(saved) {
  const def = SEED().sponsors || [];
  let sp = saved ? clone(saved) : clone(def);
  // always backfill new fields (logo / url / desc) by matching name
  sp.forEach(s => {
    const d = def.find(x => x.name === s.name);
    if (d) ['logo', 'url', 'desc_tr', 'desc_en'].forEach(k => { if (s[k] === undefined) s[k] = d[k]; });
  });
  // one-time restore of any seed sponsor not present
  if (!localStorage.getItem('sh_sponsors_restored_v1')) {
    def.forEach(d => { if (!sp.find(s => s.name === d.name)) sp.push(clone(d)); });
    try { localStorage.setItem('sh_sponsors_restored_v1', '1'); } catch (e) {}
  }
  return sp;
}

// Collection meta — idField + Turkish label
const COLLECTIONS = {
  startups: { idField: 'id',   label: 'Proje',     labelPlural: 'Projeler' },
  posts:    { idField: 'id',   label: 'Yazı',      labelPlural: 'Yazılar' },
  people:   { idField: 'id',   label: 'Kişi',      labelPlural: 'Ekip & Mentörler' },
  sponsors: { idField: 'name', label: 'Destekçi',  labelPlural: 'Destekçiler' },
  events:   { idField: 'id',   label: 'Etkinlik',  labelPlural: 'Etkinlikler' },
};

const defaultStats = {
  members:  { mode: 'manual', value: 240, suffix: '+' },
  projects: { mode: 'auto',   value: 18,  suffix: ''  },
  posts:    { mode: 'auto',   value: 35,  suffix: '+' },
  sponsors: { mode: 'manual', value: 12,  suffix: ''  },
  openRoles:{ mode: 'auto',   value: 0,   suffix: ''  },
};

const AdminContext = createContextS(null);
function useAdmin() { return useContextS(AdminContext); }

function AdminProvider({ children }) {
  const [data, setData] = useStateS(() => {
    const saved = loadStore();
    return {
      people:   saved?.people   || clone(SEED().people),
      startups: saved?.startups || clone(SEED().startups),
      posts:    saved?.posts    || clone(SEED().posts),
      sponsors: reconcileSponsors(saved?.sponsors),
      events:   saved?.events   || clone(SEED().events || []),
      siteStats: { ...defaultStats, ...(saved?.siteStats || {}) },
    };
  });
  const [trash, setTrash] = useStateS(loadTrash);
  const [saveError, setSaveError] = useStateS(false);

  useEffectS(() => { const ok = saveStore(data); setSaveError(!ok); }, [data]);
  useEffectS(() => { try { localStorage.setItem(TRASH_KEY, JSON.stringify(trash)); } catch(e) {} }, [trash]);

  const updateCollection = useCallbackS((collection, updater) => {
    setData(prev => ({ ...prev, [collection]: updater(prev[collection]) }));
  }, []);

  const addItem = useCallbackS((collection, item) => {
    updateCollection(collection, items => [item, ...items]);
  }, [updateCollection]);

  const updateItem = useCallbackS((collection, id, updates) => {
    const idField = COLLECTIONS[collection].idField;
    updateCollection(collection, items => items.map(it => it[idField] === id ? { ...it, ...updates } : it));
  }, [updateCollection]);

  // Make a boolean flag exclusive: keep it on `id`, turn it off everywhere else (max 1).
  const clearFlagExcept = useCallbackS((collection, id, field) => {
    const idField = COLLECTIONS[collection].idField;
    updateCollection(collection, items => items.map(it =>
      it[idField] === id ? it : (it[field] ? { ...it, [field]: false } : it)
    ));
  }, [updateCollection]);

  // How many items currently have `field` truthy (optionally excluding one id).
  const countFlag = useCallbackS((collection, field, exceptId) => {
    const idField = COLLECTIONS[collection].idField;
    return data[collection].filter(it => it[field] && it[idField] !== exceptId).length;
  }, [data]);

  // Soft delete → trash
  const deleteItem = useCallbackS((collection, id) => {
    const idField = COLLECTIONS[collection].idField;
    setData(prev => {
      const item = prev[collection].find(it => it[idField] === id);
      if (item) {
        setTrash(t => [{ _key: uid(), collection, item: clone(item), deletedAt: Date.now() }, ...t]);
      }
      return { ...prev, [collection]: prev[collection].filter(it => it[idField] !== id) };
    });
  }, []);

  const restoreItem = useCallbackS((trashKey) => {
    setTrash(prev => {
      const entry = prev.find(t => t._key === trashKey);
      if (entry) {
        setData(d => ({ ...d, [entry.collection]: [entry.item, ...d[entry.collection]] }));
      }
      return prev.filter(t => t._key !== trashKey);
    });
  }, []);

  const purgeItem = useCallbackS((trashKey) => {
    setTrash(prev => prev.filter(t => t._key !== trashKey));
  }, []);

  const emptyTrash = useCallbackS(() => setTrash([]), []);

  const setStat = useCallbackS((key, patch) => {
    setData(prev => ({ ...prev, siteStats: { ...prev.siteStats, [key]: { ...prev.siteStats[key], ...patch } } }));
  }, []);

  const resetAll = useCallbackS(() => {
    const fresh = {
      people: clone(SEED().people), startups: clone(SEED().startups),
      posts: clone(SEED().posts), sponsors: clone(SEED().sponsors),
      events: clone(SEED().events || []),
      siteStats: clone(defaultStats),
    };
    setData(fresh); saveStore(fresh);
    setTrash([]);
  }, []);

  // Live computed counts
  const counts = {
    members:  data.people.length,
    teamCount: data.people.filter(p => p.type === 'team').length,
    mentorCount: data.people.filter(p => p.type === 'mentor').length,
    authorCount: data.people.filter(p => p.type === 'author').length,
    projects: data.startups.length,
    posts:    data.posts.length,
    sponsors: data.sponsors.length,
    events:   (data.events || []).length,
    openRoles: data.startups.reduce((s, x) => s + (x.openRoles || 0), 0),
  };

  // Resolve a stat's effective value
  const statValue = useCallbackS((key) => {
    const s = data.siteStats[key];
    if (!s) return 0;
    if (s.mode === 'auto') {
      if (key === 'members') return counts.members;
      if (key === 'projects') return counts.projects;
      if (key === 'posts') return counts.posts;
      if (key === 'sponsors') return counts.sponsors;
      if (key === 'openRoles') return counts.openRoles;
    }
    return s.value;
  }, [data.siteStats, counts]);

  return React.createElement(AdminContext.Provider, {
    value: {
      data, trash, counts, saveError,
      addItem, updateItem, deleteItem,
      clearFlagExcept, countFlag,
      restoreItem, purgeItem, emptyTrash,
      setStat, statValue, resetAll,
      COLLECTIONS,
    }
  }, children);
}

Object.assign(window, { AdminContext, useAdmin, AdminProvider, uid, COLLECTIONS });
