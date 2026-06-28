// admin-store.jsx — localStorage for people/startups/sponsors/events; Supabase for posts
import React, { useState as useStateS, useEffect as useEffectS, useCallback as useCallbackS, createContext as createContextS, useContext as useContextS } from 'react';
import { SH_DEFAULTS, people, startups, sponsors, events } from '../data';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'sh_admin_data';
const TRASH_KEY = 'sh_admin_trash';

function loadStore() {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch(e) {}
  return null;
}
function saveStore(data) {
  // posts excluded — managed by Supabase
  const { posts: _posts, ...rest } = data;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rest)); return true; }
  catch(e) { console.warn('Kayıt başarısız (depolama dolu olabilir):', e); return false; }
}
function loadTrash() {
  try { const s = localStorage.getItem(TRASH_KEY); if (s) return JSON.parse(s); } catch(e) {}
  return [];
}

const clone = (obj) => JSON.parse(JSON.stringify(obj));
const uid = () => Date.now() + Math.random().toString(36).slice(2, 8);
const SEED = () => (SH_DEFAULTS || { people, startups, sponsors, events: events || [] });

function mapPostToDb(item) {
  return {
    slug:        item.slug        || '',
    tag:         item.tag         || 'blog',
    author_id:   item.authorId    || null,
    project_id:  item.projectId   || null,
    date:        item.date        || null,
    read_time:   item.readTime    || 5,
    bg:          item.bg          || null,
    image_url:   item.cover       || null,
    source:      item.source?.name || null,
    source_url:  item.source?.url  || null,
    title_tr:    item.title_tr    || '',
    title_en:    item.title_en    || null,
    excerpt_tr:  item.excerpt_tr  || null,
    excerpt_en:  item.excerpt_en  || null,
    body_tr:     item.body_tr     || [],
    body_en:     item.body_en     || [],
    home_pinned: item.homePinned  || false,
    recommended: item.recommended || false,
  };
}

function mapPostFromDb(row) {
  return {
    id:          row.id,
    slug:        row.slug        || '',
    tag:         row.tag         || 'blog',
    authorId:    row.author_id   || null,
    projectId:   row.project_id  || null,
    date:        row.date        || '',
    readTime:    row.read_time   || 5,
    bg:          row.bg          || 'var(--blue-light)',
    cover:       row.image_url   || null,
    source:      row.source ? { name: row.source, url: row.source_url || '#' } : null,
    title_tr:    row.title_tr    || '',
    title_en:    row.title_en    || '',
    excerpt_tr:  row.excerpt_tr  || '',
    excerpt_en:  row.excerpt_en  || '',
    body_tr:     row.body_tr     || [],
    body_en:     row.body_en     || [],
    homePinned:  row.home_pinned  || false,
    recommended: row.recommended  || false,
  };
}

function reconcileSponsors(saved) {
  const def = SEED().sponsors || [];
  let sp = saved ? clone(saved) : clone(def);
  sp.forEach(s => {
    const d = def.find(x => x.name === s.name);
    if (d) ['logo', 'url', 'desc_tr', 'desc_en'].forEach(k => { if (s[k] === undefined) s[k] = d[k]; });
  });
  if (!localStorage.getItem('sh_sponsors_restored_v1')) {
    def.forEach(d => { if (!sp.find(s => s.name === d.name)) sp.push(clone(d)); });
    try { localStorage.setItem('sh_sponsors_restored_v1', '1'); } catch (e) {}
  }
  return sp;
}

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
      people:    saved?.people    || clone(SEED().people),
      startups:  saved?.startups  || clone(SEED().startups),
      posts:     [],
      sponsors:  reconcileSponsors(saved?.sponsors),
      events:    saved?.events    || clone(SEED().events || []),
      siteStats: { ...defaultStats, ...(saved?.siteStats || {}) },
    };
  });
  const [postsLoading, setPostsLoading] = useStateS(true);
  const [trash, setTrash] = useStateS(loadTrash);
  const [saveError, setSaveError] = useStateS(false);

  useEffectS(() => {
    let cancelled = false;
    supabase.from('posts').select('*').order('date', { ascending: false })
      .then(({ data: rows, error }) => {
        if (cancelled) return;
        if (error) console.error('[Admin] Posts yüklenemedi:', error.message);
        else setData(prev => ({ ...prev, posts: (rows || []).map(mapPostFromDb) }));
        setPostsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffectS(() => { const ok = saveStore(data); setSaveError(!ok); }, [data]);
  useEffectS(() => { try { localStorage.setItem(TRASH_KEY, JSON.stringify(trash)); } catch(e) {} }, [trash]);

  const updateCollection = useCallbackS((collection, updater) => {
    setData(prev => ({ ...prev, [collection]: updater(prev[collection]) }));
  }, []);

  const addItem = useCallbackS((collection, item) => {
    if (collection === 'posts') {
      return supabase.from('posts').insert(mapPostToDb(item)).select().single()
        .then(({ data: row, error }) => {
          if (error) { console.error('[Admin] Yazı eklenemedi:', error.message); return; }
          setData(prev => ({ ...prev, posts: [mapPostFromDb(row), ...prev.posts] }));
        });
    }
    updateCollection(collection, items => [item, ...items]);
  }, [updateCollection]);

  const updateItem = useCallbackS((collection, id, updates) => {
    if (collection === 'posts') {
      return supabase.from('posts').update(mapPostToDb(updates)).eq('id', id).select().single()
        .then(({ data: row, error }) => {
          if (error) { console.error('[Admin] Yazı güncellenemedi:', error.message); return; }
          setData(prev => ({
            ...prev,
            posts: prev.posts.map(p => p.id === id ? mapPostFromDb(row) : p),
          }));
        });
    }
    const idField = COLLECTIONS[collection].idField;
    updateCollection(collection, items => items.map(it => it[idField] === id ? { ...it, ...updates } : it));
  }, [updateCollection]);

  const clearFlagExcept = useCallbackS((collection, id, field) => {
    const idField = COLLECTIONS[collection].idField;
    updateCollection(collection, items => items.map(it =>
      it[idField] === id ? it : (it[field] ? { ...it, [field]: false } : it)
    ));
  }, [updateCollection]);

  const countFlag = useCallbackS((collection, field, exceptId) => {
    const idField = COLLECTIONS[collection].idField;
    return data[collection].filter(it => it[field] && it[idField] !== exceptId).length;
  }, [data]);

  const deleteItem = useCallbackS((collection, id) => {
    const idField = COLLECTIONS[collection].idField;
    if (collection === 'posts') {
      const item = data.posts.find(p => p.id === id);
      if (item) setTrash(t => [{ _key: uid(), collection, item: clone(item), deletedAt: Date.now() }, ...t]);
      setData(prev => ({ ...prev, posts: prev.posts.filter(p => p.id !== id) }));
      return supabase.from('posts').delete().eq('id', id)
        .then(({ error }) => {
          if (error) console.error('[Admin] Yazı silinemedi:', error.message);
        });
    }
    setData(prev => {
      const item = prev[collection].find(it => it[idField] === id);
      if (item) setTrash(t => [{ _key: uid(), collection, item: clone(item), deletedAt: Date.now() }, ...t]);
      return { ...prev, [collection]: prev[collection].filter(it => it[idField] !== id) };
    });
  }, [data]);

  const restoreItem = useCallbackS((trashKey) => {
    setTrash(prev => {
      const entry = prev.find(t => t._key === trashKey);
      if (entry) {
        if (entry.collection === 'posts') {
          const { id: _id, ...withoutId } = entry.item;
          supabase.from('posts').insert(mapPostToDb(withoutId)).select().single()
            .then(({ data: row, error }) => {
              if (error) { console.error('[Admin] Yazı geri yüklenemedi:', error.message); return; }
              setData(d => ({ ...d, posts: [mapPostFromDb(row), ...d.posts] }));
            });
        } else {
          setData(d => ({ ...d, [entry.collection]: [entry.item, ...d[entry.collection]] }));
        }
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
      people:    clone(SEED().people),
      startups:  clone(SEED().startups),
      posts:     data.posts,
      sponsors:  clone(SEED().sponsors),
      events:    clone(SEED().events || []),
      siteStats: clone(defaultStats),
    };
    setData(fresh); saveStore(fresh);
    setTrash([]);
  }, [data.posts]);

  const counts = {
    members:     data.people.length,
    teamCount:   data.people.filter(p => p.type === 'team').length,
    mentorCount: data.people.filter(p => p.type === 'mentor').length,
    authorCount: data.people.filter(p => p.type === 'author').length,
    projects:    data.startups.length,
    posts:       data.posts.length,
    sponsors:    data.sponsors.length,
    events:      (data.events || []).length,
    openRoles:   data.startups.reduce((s, x) => s + (x.openRoles || 0), 0),
  };

  const statValue = useCallbackS((key) => {
    const s = data.siteStats[key];
    if (!s) return 0;
    if (s.mode === 'auto') {
      if (key === 'members')   return counts.members;
      if (key === 'projects')  return counts.projects;
      if (key === 'posts')     return counts.posts;
      if (key === 'sponsors')  return counts.sponsors;
      if (key === 'openRoles') return counts.openRoles;
    }
    return s.value;
  }, [data.siteStats, counts]);

  return React.createElement(AdminContext.Provider, {
    value: {
      data, trash, counts, saveError, postsLoading,
      addItem, updateItem, deleteItem,
      clearFlagExcept, countFlag,
      restoreItem, purgeItem, emptyTrash,
      setStat, statValue, resetAll,
      COLLECTIONS,
    }
  }, children);
}

export { AdminContext, useAdmin, AdminProvider, uid, COLLECTIONS };
