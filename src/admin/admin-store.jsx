// admin-store.jsx — Supabase CRUD for all collections; localStorage only for siteStats
import React, { useState as useStateS, useEffect as useEffectS, useCallback as useCallbackS, createContext as createContextS, useContext as useContextS } from 'react';
import { SH_DEFAULTS } from '../data';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'sh_admin_data';
const TRASH_KEY   = 'sh_admin_trash';

function loadStore() {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch(e) {}
  return null;
}
function saveStore(siteStats) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ siteStats })); return true; }
  catch(e) { console.warn('Kayıt başarısız:', e); return false; }
}
function loadTrash() {
  try { const s = localStorage.getItem(TRASH_KEY); if (s) return JSON.parse(s); } catch(e) {}
  return [];
}

const clone = (obj) => JSON.parse(JSON.stringify(obj));
const uid   = () => Date.now() + Math.random().toString(36).slice(2, 8);

// ── posts ──────────────────────────────────────────────────────────────
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
    status:      item.status      || 'published',
    published_at: item.publishedAt || null,
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
    homePinned:  row.home_pinned || false,
    recommended: row.recommended || false,
    status:      row.status      || 'published',
    publishedAt: row.published_at || null,
  };
}

// ── people ─────────────────────────────────────────────────────────────
function mapPersonToDb(item) {
  const db = {
    name:       item.name       || '',
    role_tr:    item.role_tr    || '',
    role_en:    item.role_en    || '',
    type:       item.type       || 'team',
    tier:       item.tier       ?? null,
    color:      item.color      || '#2563EB',
    photo:      item.photo      || null,
    linkedin:   item.linkedin   || '#',
    bio_tr:     item.bio_tr     || '',
    bio_en:     item.bio_en     || '',
    sort_order: item.sort_order ?? 99,
  };
  if (item.id) db.id = item.id;
  return db;
}
function mapPersonFromDb(row) {
  return {
    id:         row.id,
    name:       row.name         || '',
    role_tr:    row.role_tr      || '',
    role_en:    row.role_en      || '',
    type:       row.type         || 'team',
    tier:       row.tier         ?? null,
    color:      row.color        || '#2563EB',
    photo:      row.photo        || null,
    linkedin:   row.linkedin     || '#',
    bio_tr:     row.bio_tr       || '',
    bio_en:     row.bio_en       || '',
    sort_order: row.sort_order   ?? 99,
  };
}

// ── startups ───────────────────────────────────────────────────────────
function mapStartupToDb(item) {
  const db = {
    slug:               item.slug            || '',
    name:               item.name            || '',
    color:              item.color           || '#2563EB',
    stage:              item.stage           || 'idea',
    tagline_tr:         item.tagline_tr      || '',
    tagline_en:         item.tagline_en      || '',
    desc_tr:            item.desc_tr         || '',
    desc_en:            item.desc_en         || '',
    about_tr:           item.about_tr        || '',
    about_en:           item.about_en        || '',
    problem_tr:         item.problem_tr      || '',
    problem_en:         item.problem_en      || '',
    solution_tr:        item.solution_tr     || '',
    solution_en:        item.solution_en     || '',
    tags:               item.tags            || [],
    team:               item.team            || 0,
    open_roles:         item.openRoles       || 0,
    score:              item.score           || 0,
    updates:            item.updates         || 0,
    website:            item.website         || null,
    demo:               item.demo            || null,
    github:             item.github          || null,
    lead_id:            item.leadId          || null,
    member_ids:         item.memberIds       || [],
    mentor_id:          item.mentorId        || null,
    open_roles_list_tr: item.openRolesList_tr || [],
    open_roles_list_en: item.openRolesList_en || [],
    metrics:            item.metrics         || [],
    trending:           item.trending        || false,
    featured:           item.featured        || false,
    is_new:             item.isNew           || false,
  };
  if (item.id) db.id = item.id;
  return db;
}
function mapStartupFromDb(row) {
  return {
    id:               row.id,
    slug:             row.slug               || '',
    name:             row.name               || '',
    color:            row.color              || '#2563EB',
    stage:            row.stage              || 'idea',
    tagline_tr:       row.tagline_tr         || '',
    tagline_en:       row.tagline_en         || '',
    desc_tr:          row.desc_tr            || '',
    desc_en:          row.desc_en            || '',
    about_tr:         row.about_tr           || '',
    about_en:         row.about_en           || '',
    problem_tr:       row.problem_tr         || '',
    problem_en:       row.problem_en         || '',
    solution_tr:      row.solution_tr        || '',
    solution_en:      row.solution_en        || '',
    tags:             row.tags               || [],
    team:             row.team               || 0,
    openRoles:        row.open_roles         || 0,
    score:            row.score              || 0,
    updates:          row.updates            || 0,
    website:          row.website            || null,
    demo:             row.demo               || null,
    github:           row.github             || null,
    leadId:           row.lead_id            || null,
    memberIds:        row.member_ids         || [],
    mentorId:         row.mentor_id          || null,
    openRolesList_tr: row.open_roles_list_tr || [],
    openRolesList_en: row.open_roles_list_en || [],
    metrics:          row.metrics            || [],
    trending:         row.trending           || false,
    featured:         row.featured           || false,
    isNew:            row.is_new             || false,
  };
}

// ── sponsors ───────────────────────────────────────────────────────────
function mapSponsorToDb(item) {
  const db = {
    name:       item.name       || '',
    color:      item.color      || '#2563EB',
    logo:       item.logo       || null,
    url:        item.url        || '#',
    desc_tr:    item.desc_tr    || '',
    desc_en:    item.desc_en    || '',
    sort_order: item.sort_order ?? 99,
  };
  if (item.id) db.id = item.id;
  return db;
}
function mapSponsorFromDb(row) {
  return {
    id:         row.id,
    name:       row.name         || '',
    color:      row.color        || '#2563EB',
    logo:       row.logo         || null,
    url:        row.url          || '#',
    desc_tr:    row.desc_tr      || '',
    desc_en:    row.desc_en      || '',
    sort_order: row.sort_order   ?? 99,
  };
}

// ── events ─────────────────────────────────────────────────────────────
function mapEventToDb(item) {
  const db = {
    title_tr:    item.title_tr    || '',
    title_en:    item.title_en    || '',
    desc_tr:     item.desc_tr     || '',
    desc_en:     item.desc_en     || '',
    date:        item.date        || null,
    time:        item.time        || '00:00',
    location_tr: item.location_tr || '',
    location_en: item.location_en || '',
    organizer:   item.organizer   || '',
    type:        item.type        || 'meetup',
    link:        item.link        || '#',
    cover:       item.cover       || null,
    color:       item.color       || '#2563EB',
  };
  db.id = item.id || `ev${Date.now()}`;
  return db;
}
function mapEventFromDb(row) {
  return {
    id:          row.id,
    title_tr:    row.title_tr    || '',
    title_en:    row.title_en    || '',
    desc_tr:     row.desc_tr     || '',
    desc_en:     row.desc_en     || '',
    date:        row.date        || '',
    time:        row.time        || '00:00',
    location_tr: row.location_tr || '',
    location_en: row.location_en || '',
    organizer:   row.organizer   || '',
    type:        row.type        || 'meetup',
    link:        row.link        || '#',
    cover:       row.cover       || null,
    color:       row.color       || '#2563EB',
  };
}

// ── DB table map ────────────────────────────────────────────────────────
const DB_TABLE = {
  posts:    { table: 'posts',    toDb: mapPostToDb,    fromDb: mapPostFromDb    },
  people:   { table: 'people',   toDb: mapPersonToDb,  fromDb: mapPersonFromDb  },
  startups: { table: 'startups', toDb: mapStartupToDb, fromDb: mapStartupFromDb },
  sponsors: { table: 'sponsors', toDb: mapSponsorToDb, fromDb: mapSponsorFromDb },
  events:   { table: 'events',   toDb: mapEventToDb,   fromDb: mapEventFromDb   },
};

const COLLECTIONS = {
  startups: { idField: 'id',   label: 'Proje',     labelPlural: 'Projeler'        },
  posts:    { idField: 'id',   label: 'Yazı',      labelPlural: 'Yazılar'         },
  people:   { idField: 'id',   label: 'Kişi',      labelPlural: 'Ekip & Mentörler'},
  sponsors: { idField: 'id',   label: 'Destekçi',  labelPlural: 'Destekçiler'     },
  events:   { idField: 'id',   label: 'Etkinlik',  labelPlural: 'Etkinlikler'     },
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
  const saved = loadStore();
  const [data, setData] = useStateS({
    people:    [],
    startups:  [],
    posts:     [],
    sponsors:  [],
    events:    [],
    siteStats: { ...defaultStats, ...(saved?.siteStats || {}) },
  });
  const [contentLoading, setContentLoading] = useStateS(true);
  const [postsLoading,   setPostsLoading]   = useStateS(true);
  const [trash,    setTrash]    = useStateS(loadTrash);
  const [saveError,setSaveError]= useStateS(false);

  // Tüm koleksiyonları Supabase'den paralel yükle
  useEffectS(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('posts').select('*').order('date', { ascending: false }),
      supabase.from('people').select('*').order('sort_order'),
      supabase.from('startups').select('*').order('id'),
      supabase.from('sponsors').select('*').order('sort_order'),
      supabase.from('events').select('*').order('date'),
    ]).then(([postRes, peopleRes, startupRes, sponsorRes, eventRes]) => {
      if (cancelled) return;
      if (postRes.error)    console.error('[Admin] posts:', postRes.error.message);
      if (peopleRes.error)  console.error('[Admin] people:', peopleRes.error.message);
      if (startupRes.error) console.error('[Admin] startups:', startupRes.error.message);
      if (sponsorRes.error) console.error('[Admin] sponsors:', sponsorRes.error.message);
      if (eventRes.error)   console.error('[Admin] events:', eventRes.error.message);
      setData(prev => ({
        ...prev,
        posts:    (postRes.data    || []).map(mapPostFromDb),
        people:   (peopleRes.data  || []).map(mapPersonFromDb),
        startups: (startupRes.data || []).map(mapStartupFromDb),
        sponsors: (sponsorRes.data || []).map(mapSponsorFromDb),
        events:   (eventRes.data   || []).map(mapEventFromDb),
      }));
      setContentLoading(false);
      setPostsLoading(false);
    }).catch(err => {
      console.error('[Admin] Yükleme hatası:', err.message);
      if (!cancelled) { setContentLoading(false); setPostsLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  // Yalnızca siteStats localStorage'a yazılır
  useEffectS(() => { const ok = saveStore(data.siteStats); setSaveError(!ok); }, [data.siteStats]);
  useEffectS(() => { try { localStorage.setItem(TRASH_KEY, JSON.stringify(trash)); } catch(e) {} }, [trash]);

  // ── CRUD ──────────────────────────────────────────────────────────────
  const addItem = useCallbackS((collection, item) => {
    const entry = DB_TABLE[collection];
    if (!entry) return Promise.reject(new Error('Bilinmeyen koleksiyon'));
    return supabase.from(entry.table).insert(entry.toDb(item)).select().single()
      .then(({ data: row, error }) => {
        if (error) throw new Error(error.message);
        setData(prev => ({ ...prev, [collection]: [entry.fromDb(row), ...prev[collection]] }));
      });
  }, []);

  const updateItem = useCallbackS((collection, id, updates) => {
    const entry   = DB_TABLE[collection];
    const idField = COLLECTIONS[collection].idField;
    if (!entry) return Promise.reject(new Error('Bilinmeyen koleksiyon'));
    const dbRecord = { ...entry.toDb(updates) };
    delete dbRecord.id; // PK asla güncellenmez
    return supabase.from(entry.table).update(dbRecord).eq(idField, id).select().single()
      .then(({ data: row, error }) => {
        if (error) throw new Error(error.message);
        setData(prev => ({
          ...prev,
          [collection]: prev[collection].map(it => it[idField] === id ? entry.fromDb(row) : it),
        }));
      });
  }, []);

  const deleteItem = useCallbackS((collection, id) => {
    const entry   = DB_TABLE[collection];
    const idField = COLLECTIONS[collection].idField;
    if (!entry) return;
    const item = data[collection].find(it => it[idField] === id);
    if (item) setTrash(t => [{ _key: uid(), collection, item: clone(item), deletedAt: Date.now() }, ...t]);
    setData(prev => ({ ...prev, [collection]: prev[collection].filter(it => it[idField] !== id) }));
    return supabase.from(entry.table).delete().eq(idField, id)
      .then(({ error }) => {
        if (error) console.error(`[Admin] ${collection} silinemedi:`, error.message);
      });
  }, [data]);

  const clearFlagExcept = useCallbackS((collection, id, field) => {
    const idField = COLLECTIONS[collection].idField;
    setData(prev => ({
      ...prev,
      [collection]: prev[collection].map(it =>
        it[idField] === id ? it : (it[field] ? { ...it, [field]: false } : it)
      ),
    }));
  }, []);

  const countFlag = useCallbackS((collection, field, exceptId) => {
    const idField = COLLECTIONS[collection].idField;
    return data[collection].filter(it => it[field] && it[idField] !== exceptId).length;
  }, [data]);

  const restoreItem = useCallbackS((trashKey) => {
    setTrash(prev => {
      const entry = prev.find(t => t._key === trashKey);
      if (entry) {
        const dbEntry = DB_TABLE[entry.collection];
        if (dbEntry) {
          supabase.from(dbEntry.table).insert(dbEntry.toDb(entry.item)).select().single()
            .then(({ data: row, error }) => {
              if (error) { console.error(`[Admin] ${entry.collection} geri yüklenemedi:`, error.message); return; }
              setData(d => ({ ...d, [entry.collection]: [dbEntry.fromDb(row), ...d[entry.collection]] }));
            });
        }
      }
      return prev.filter(t => t._key !== trashKey);
    });
  }, []);

  const purgeItem  = useCallbackS((trashKey) => setTrash(prev => prev.filter(t => t._key !== trashKey)), []);
  const emptyTrash = useCallbackS(() => setTrash([]), []);

  const setStat = useCallbackS((key, patch) => {
    setData(prev => ({ ...prev, siteStats: { ...prev.siteStats, [key]: { ...prev.siteStats[key], ...patch } } }));
  }, []);

  const resetAll = useCallbackS(() => {
    setData(prev => ({ ...prev, siteStats: clone(defaultStats) }));
  }, []);

  const counts = {
    members:     data.people.length,
    teamCount:   data.people.filter(p => p.type === 'team').length,
    mentorCount: data.people.filter(p => p.type === 'mentor').length,
    authorCount: data.people.filter(p => p.type === 'author').length,
    projects:    data.startups.length,
    posts:       data.posts.length,
    sponsors:    data.sponsors.length,
    events:      data.events.length,
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
      data, trash, counts, saveError, postsLoading, contentLoading,
      addItem, updateItem, deleteItem,
      clearFlagExcept, countFlag,
      restoreItem, purgeItem, emptyTrash,
      setStat, statValue, resetAll,
      COLLECTIONS,
    }
  }, children);
}

export { AdminContext, useAdmin, AdminProvider, uid, COLLECTIONS };
