// admin-automation.jsx — Otomasyon Kontrol Merkezi
// Tab yapısı: Taslaklar | Kaynaklar | Kelimeler | Ton & Ayarlar | Loglar
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AIcon, Modal, Field, Input, Select, PageHead, TagInput, PostCoverUpload } from './admin-ui';
import { supabase } from '../lib/supabase';

// ── Sabitler ─────────────────────────────────────────────────────────────────
const GITHUB_REPO     = 'starthubcommunity/StartHub';
const GITHUB_WORKFLOW = 'content-automation.yml';
const GEMINI_LIMIT    = 20; // ücretsiz günlük istek limiti

const TONE_LEVELS = [
  { level: 1, label: 'Resmi Haber',    desc: 'Nesnel, olgusal, abartısız haber dili' },
  { level: 2, label: 'Bilgilendirici', desc: 'Net ve anlaşılır, teknik terimleri açıklar' },
  { level: 3, label: 'Dengeli',        desc: 'Samimi ama profesyonel (varsayılan)' },
  { level: 4, label: 'Sıcak',          desc: 'Topluluk odaklı, ilham verici örnekler' },
  { level: 5, label: 'Coşkulu',        desc: 'Motivasyonel, enerjik, harekete geçirici' },
];

const ALL_CATEGORIES = ['AI', 'Teknoloji', 'Girişim', 'Yatırım', 'Fintech', 'SaaS', 'E-Ticaret', 'Sağlık'];

// image_stock.category seçenekleri — image_matcher.py'deki CATEGORY_ALIAS ile
// makale kategorilerine (AI/Girişim/Teknoloji/Yatırım) eşleniyor.
const IMAGE_STOCK_CATEGORIES = ['Fon', 'Yapay Zeka', 'Girişim', 'Fintech', 'SaaS', 'E-Ticaret', 'Sağlık', 'Teknoloji', 'Ortaklık', 'Genel'];

const TABS = [
  { id: 'drafts',      label: 'Taslaklar',    icon: 'layers'   },
  { id: 'imagestock',  label: 'Görsel Stoğu', icon: 'image'    },
  { id: 'sources',     label: 'Kaynaklar',    icon: 'globe'    },
  { id: 'keywords',    label: 'Kelimeler',    icon: 'search'   },
  { id: 'settings',    label: 'Ton & Ayarlar', icon: 'settings' },
  { id: 'logs',        label: 'Loglar',       icon: 'list'     },
];

// ── Yardımcılar ───────────────────────────────────────────────────────────────
// Admin panel yalnızca admin.css'i yükler — sitenin --blue-light gibi CSS
// değişkenleri burada tanımlı değil, bu yüzden dominant hex olmayan bg
// değerlerini (kategori varsayılanı) somut bir hex'e çeviriyoruz.
const SITE_BG_HEX = {
  'var(--blue-light)':   '#EFF6FF',
  'var(--red-light)':    '#FEF2F2',
  'var(--green-light)':  '#F0FDF4',
  'var(--purple-light)': '#F5F3FF',
  'var(--orange-light)': '#FFF7ED',
};
const previewCoverBg = (bg) => (bg?.startsWith('#') ? bg : (SITE_BG_HEX[bg] || '#EFF6FF'));

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—';

const getPacificMidnightUTC = () => {
  // PDT = UTC-7 (yaz saati). Pasifik gece yarısı = 07:00 UTC
  const PACIFIC_OFFSET_H = 7;
  const now = new Date();
  const pacificNow = new Date(now.getTime() - PACIFIC_OFFSET_H * 3600000);
  pacificNow.setUTCHours(0, 0, 0, 0);
  return new Date(pacificNow.getTime() + PACIFIC_OFFSET_H * 3600000);
};

const getNextResetUTC = () => {
  const midnight = getPacificMidnightUTC();
  const next = new Date(midnight.getTime() + 24 * 3600000);
  return next;
};

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
function AutomationPage() {
  const [activeTab, setActiveTab] = useState('drafts');
  const [toast, setToast]         = useState(null);

  const flash = useCallback((msg, kind = 'green') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3800);
  }, []);

  // ── Site ayarları (Supabase site_settings) ───────────────────────────────
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [autoPublish,       setAutoPublish]        = useState(false);
  const [preferredHours,    setPreferredHours]     = useState([5]);
  const [enabledCategories, setEnabledCategories]  = useState([]);
  const [toneLevel,         setToneLevel]          = useState(3);
  const [toneExtra,         setToneExtra]          = useState({});
  const [toneBanned,        setToneBanned]         = useState([]);
  const [settingsLoaded,    setSettingsLoaded]     = useState(false);
  const [savingSettings,    setSavingSettings]     = useState(false);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from('site_settings').select('*').eq('id', 1).single();
    if (!data) return;
    setAutomationEnabled(data.automation_enabled ?? true);
    setAutoPublish(data.auto_publish ?? false);
    const hoursArr = Array.isArray(data.preferred_run_hours) && data.preferred_run_hours.length
      ? [...new Set(data.preferred_run_hours.map(Number))].sort((a, b) => a - b)
      : [Number(data.preferred_run_hour ?? 5)];
    setPreferredHours(hoursArr);
    setEnabledCategories(data.enabled_categories || []);
    setToneLevel(data.tone_level ?? 3);
    setToneExtra(data.tone_extra_instructions || {});
    setToneBanned(data.tone_banned_phrases || []);
    setSettingsLoaded(true);
  }, []);

  const saveSettings = useCallback(async (updates) => {
    setSavingSettings(true);
    const { error } = await supabase.from('site_settings')
      .upsert({ id: 1, ...updates, updated_at: new Date().toISOString() });
    setSavingSettings(false);
    if (error) flash('Kaydedilemedi: ' + error.message, 'orange');
    else flash('Ayarlar kaydedildi.');
  }, [flash]);

  // Toggle'lar anında kaydedilir
  const toggleAutomation = async (val) => {
    setAutomationEnabled(val);
    await saveSettings({ automation_enabled: val });
  };
  const toggleAutoPublish = async (val) => {
    setAutoPublish(val);
    await saveSettings({ auto_publish: val });
  };

  // ── Görsel Stoğu (Supabase image_stock) ───────────────────────────────────
  const [imageStock,   setImageStock]   = useState([]);
  const [imgLoading,   setImgLoading]   = useState(true);
  const [imgModal,     setImgModal]     = useState(null); // null | {mode:'add'} | {mode:'edit',row}
  const [imgForm,      setImgForm]      = useState({ url: '', category: '', tags: [], alt_tr: '', alt_en: '' });
  const [imgSaving,    setImgSaving]    = useState(false);

  const loadImageStock = useCallback(async () => {
    setImgLoading(true);
    const { data, error } = await supabase
      .from('image_stock').select('*').order('id', { ascending: false });
    if (error) flash('Görsel stoğu yüklenemedi: ' + error.message, 'orange');
    setImageStock(data || []);
    setImgLoading(false);
  }, [flash]);

  const openAddImage = () => {
    setImgForm({ url: '', category: '', tags: [], alt_tr: '', alt_en: '' });
    setImgModal({ mode: 'add' });
  };
  const openEditImage = (row) => {
    setImgForm({ url: row.url, category: row.category || '', tags: row.tags || [], alt_tr: row.alt_tr || '', alt_en: row.alt_en || '' });
    setImgModal({ mode: 'edit', row });
  };
  const saveImage = async () => {
    if (!imgForm.url) { flash('Önce bir görsel yükleyin.', 'orange'); return; }
    setImgSaving(true);
    const payload = {
      url: imgForm.url,
      category: imgForm.category || null,
      tags: imgForm.tags,
      alt_tr: imgForm.alt_tr || null,
      alt_en: imgForm.alt_en || null,
    };
    if (imgModal.mode === 'add') {
      const { error } = await supabase.from('image_stock').insert(payload);
      if (error) flash('Eklenemedi: ' + error.message, 'orange');
      else { flash('Görsel stoğa eklendi.'); setImgModal(null); loadImageStock(); }
    } else {
      const { error } = await supabase.from('image_stock').update(payload).eq('id', imgModal.row.id);
      if (error) flash('Güncellenemedi: ' + error.message, 'orange');
      else { flash('Görsel güncellendi.'); setImgModal(null); loadImageStock(); }
    }
    setImgSaving(false);
  };
  const deleteImage = async (row) => {
    if (!confirm('Bu görseli stoktan kalıcı olarak silmek istediğine emin misin?')) return;
    const marker = '/post-images/';
    const idx = (row.url || '').indexOf(marker);
    if (idx !== -1) {
      const path = row.url.slice(idx + marker.length);
      await supabase.storage.from('post-images').remove([path]);
    }
    const { error } = await supabase.from('image_stock').delete().eq('id', row.id);
    if (error) flash('Silinemedi: ' + error.message, 'orange');
    else { setImageStock(prev => prev.filter(r => r.id !== row.id)); flash('Görsel silindi.', 'orange'); }
  };

  // ── RSS Kaynakları (Supabase automation_sources) ──────────────────────────
  const [sources,       setSources]      = useState([]);
  const [srcLoading,    setSrcLoading]   = useState(true);
  const [sourceModal,   setSourceModal]  = useState(null); // null | {mode:'add'} | {mode:'edit',row}
  const [infoOpen,      setInfoOpen]     = useState(false);
  const [srcForm,       setSrcForm]      = useState({ name: '', url: '', weight: 5 });
  const [srcSaving,     setSrcSaving]    = useState(false);

  const loadSources = useCallback(async () => {
    setSrcLoading(true);
    const { data } = await supabase
      .from('automation_sources').select('*').order('id');
    setSources(data || []);
    setSrcLoading(false);
  }, []);

  const openAddSource = () => {
    setSrcForm({ name: '', url: '', weight: 5 });
    setSourceModal({ mode: 'add' });
  };
  const openEditSource = (row) => {
    setSrcForm({ name: row.name, url: row.url, weight: row.weight });
    setSourceModal({ mode: 'edit', row });
  };
  const saveSource = async () => {
    if (!srcForm.name.trim() || !srcForm.url.trim()) {
      flash('Kaynak adı ve URL zorunlu.', 'orange'); return;
    }
    setSrcSaving(true);
    if (sourceModal.mode === 'add') {
      const { error } = await supabase.from('automation_sources').insert({
        name: srcForm.name.trim(), url: srcForm.url.trim(),
        weight: Number(srcForm.weight) || 5, enabled: true,
      });
      if (error) flash('Eklenemedi: ' + error.message, 'orange');
      else { flash('Kaynak eklendi.'); setSourceModal(null); loadSources(); }
    } else {
      const { error } = await supabase.from('automation_sources')
        .update({ name: srcForm.name.trim(), url: srcForm.url.trim(), weight: Number(srcForm.weight) || 5 })
        .eq('id', sourceModal.row.id);
      if (error) flash('Güncellenemedi: ' + error.message, 'orange');
      else { flash('Kaynak güncellendi.'); setSourceModal(null); loadSources(); }
    }
    setSrcSaving(false);
  };
  const toggleSource = async (row) => {
    await supabase.from('automation_sources').update({ enabled: !row.enabled }).eq('id', row.id);
    setSources(prev => prev.map(s => s.id === row.id ? { ...s, enabled: !s.enabled } : s));
  };
  const deleteSource = async (id) => {
    if (!confirm('Bu kaynağı silmek istediğine emin misin?')) return;
    await supabase.from('automation_sources').delete().eq('id', id);
    setSources(prev => prev.filter(s => s.id !== id));
    flash('Kaynak silindi.', 'orange');
  };

  // ── Anahtar Kelimeler (Supabase automation_keywords) ─────────────────────
  const [keywords,    setKeywords]   = useState([]);
  const [kwLoading,   setKwLoading]  = useState(true);
  const [newKw,       setNewKw]      = useState({ keyword: '', score: 5, group_type: 'medium' });
  const [kwSaving,    setKwSaving]   = useState(false);

  const loadKeywords = useCallback(async () => {
    setKwLoading(true);
    const { data } = await supabase
      .from('automation_keywords').select('*').order('score', { ascending: false });
    setKeywords(data || []);
    setKwLoading(false);
  }, []);

  const addKeyword = async () => {
    if (!newKw.keyword.trim()) { flash('Kelime boş olamaz.', 'orange'); return; }
    setKwSaving(true);
    const { error } = await supabase.from('automation_keywords').insert({
      keyword: newKw.keyword.trim().toLowerCase(),
      score: Number(newKw.score) || 5,
      group_type: newKw.group_type,
    });
    setKwSaving(false);
    if (error) flash('Eklenemedi: ' + error.message, 'orange');
    else { flash('Kelime eklendi.'); setNewKw({ keyword: '', score: 5, group_type: 'medium' }); loadKeywords(); }
  };
  const deleteKeyword = async (id) => {
    await supabase.from('automation_keywords').delete().eq('id', id);
    setKeywords(prev => prev.filter(k => k.id !== id));
  };

  // ── Taslaklar (Supabase posts status='draft') ─────────────────────────────
  const [draftsView,   setDraftsView]  = useState('pending'); // 'pending' | 'rejected'
  const [drafts,       setDrafts]      = useState([]);
  const [draftsLoad,   setDraftsLoad]  = useState(true);
  const [rejected,     setRejected]    = useState([]);
  const [rejectedLoad, setRejectedLoad]= useState(false);
  const [actingId,     setActingId]    = useState(null);
  const [preview,      setPreview]     = useState(null);

  const loadDrafts = useCallback(async () => {
    setDraftsLoad(true);
    const { data, error } = await supabase
      .from('posts').select('*').eq('status', 'draft').order('date', { ascending: false });
    setDraftsLoad(false);
    if (error) { flash('Taslaklar yüklenemedi: ' + error.message, 'orange'); return; }
    setDrafts(data || []);
  }, [flash]);

  const loadRejected = useCallback(async () => {
    setRejectedLoad(true);
    const { data, error } = await supabase
      .from('posts').select('*').eq('status', 'rejected').order('date', { ascending: false });
    setRejectedLoad(false);
    if (error) { flash('Reddedilenler yüklenemedi: ' + error.message, 'orange'); return; }
    setRejected(data || []);
  }, [flash]);

  const approve = async (draft) => {
    if (actingId) return;
    setActingId(draft.id);
    const { error } = await supabase.from('posts')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', draft.id);
    setActingId(null);
    if (error) { flash('Onaylama başarısız: ' + error.message, 'orange'); return; }
    setDrafts(prev => prev.filter(d => d.id !== draft.id));
    flash(`Yayınlandı: ${draft.title_tr}`);
  };
  const reject = async (draft) => {
    if (actingId) return;
    setActingId(draft.id);
    const { error } = await supabase.from('posts')
      .update({ status: 'rejected' }).eq('id', draft.id);
    setActingId(null);
    if (error) { flash('Reddetme başarısız: ' + error.message, 'orange'); return; }
    setDrafts(prev => prev.filter(d => d.id !== draft.id));
    flash(`Reddedildi: ${draft.title_tr}`, 'orange');
  };
  const restore = async (post) => {
    if (actingId) return;
    setActingId(post.id);
    const { error } = await supabase.from('posts')
      .update({ status: 'draft', published_at: null }).eq('id', post.id);
    setActingId(null);
    if (error) { flash('Geri alma başarısız: ' + error.message, 'orange'); return; }
    setRejected(prev => prev.filter(r => r.id !== post.id));
    flash(`Taslağa geri alındı: ${post.title_tr}`);
    loadDrafts();
  };
  const deletePermanently = async (post) => {
    if (!confirm(`"${post.title_tr}" kalıcı olarak silinecek. Emin misin?`)) return;
    if (actingId) return;
    setActingId(post.id);
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    setActingId(null);
    if (error) { flash('Silme başarısız: ' + error.message, 'orange'); return; }
    setRejected(prev => prev.filter(r => r.id !== post.id));
    flash('Kalıcı olarak silindi.', 'orange');
  };

  // ── Taslak düzenleme ─────────────────────────────────────────────────────
  const [editDraft,  setEditDraft]  = useState(null);
  const [draftForm,  setDraftForm]  = useState({});
  const [editSaving, setEditSaving] = useState(false);

  const openEditDraft = (d) => {
    setDraftForm({
      title_tr:   d.title_tr   || '',
      excerpt_tr: d.excerpt_tr || '',
      body_tr:    Array.isArray(d.body_tr) ? [...d.body_tr] : [],
      tag:        d.tag        || 'gundem',
    });
    setEditDraft(d);
  };
  const saveDraftEdit = async () => {
    if (!draftForm.title_tr.trim()) { flash('Başlık zorunlu.', 'orange'); return; }
    setEditSaving(true);
    const { error } = await supabase.from('posts')
      .update({ title_tr: draftForm.title_tr, excerpt_tr: draftForm.excerpt_tr, body_tr: draftForm.body_tr, tag: draftForm.tag })
      .eq('id', editDraft.id).eq('status', 'draft');
    setEditSaving(false);
    if (error) { flash('Güncelleme başarısız: ' + error.message, 'orange'); return; }
    flash('Taslak güncellendi.');
    setEditDraft(null);
    loadDrafts();
  };
  const setBodyParagraph = (i, val) => setDraftForm(p => {
    const arr = [...p.body_tr];
    arr[i] = val;
    return { ...p, body_tr: arr };
  });
  const addBodyParagraph  = () => setDraftForm(p => ({ ...p, body_tr: [...p.body_tr, ''] }));
  const removeBodyParagraph = (i) => setDraftForm(p => ({ ...p, body_tr: p.body_tr.filter((_, idx) => idx !== i) }));

  // ── Toplu işlem ───────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkActing,  setBulkActing]  = useState(false);

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => {
    if (selectedIds.size === drafts.length && drafts.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(drafts.map(d => d.id)));
  };
  const bulkApprove = async () => {
    if (!selectedIds.size || bulkActing) return;
    setBulkActing(true);
    const ids = [...selectedIds];
    const { error } = await supabase.from('posts')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .in('id', ids);
    setBulkActing(false);
    if (error) { flash('Toplu onaylama başarısız: ' + error.message, 'orange'); return; }
    setDrafts(prev => prev.filter(d => !selectedIds.has(d.id)));
    setSelectedIds(new Set());
    flash(`${ids.length} taslak yayınlandı.`);
  };
  const bulkReject = async () => {
    if (!selectedIds.size || bulkActing) return;
    setBulkActing(true);
    const ids = [...selectedIds];
    const { error } = await supabase.from('posts')
      .update({ status: 'rejected' })
      .in('id', ids);
    setBulkActing(false);
    if (error) { flash('Toplu reddetme başarısız: ' + error.message, 'orange'); return; }
    setDrafts(prev => prev.filter(d => !selectedIds.has(d.id)));
    setSelectedIds(new Set());
    flash(`${ids.length} taslak reddedildi.`, 'orange');
  };

  // ── Loglar & Seen URLs ────────────────────────────────────────────────────
  const [runLogs,    setRunLogs]    = useState([]);
  const [seenCount,  setSeenCount]  = useState(0);
  const [todayUsage, setTodayUsage] = useState(0);
  const [logsLoad,   setLogsLoad]   = useState(true);

  const loadLogs = useCallback(async () => {
    setLogsLoad(true);
    const [logsRes, seenRes, todayRes] = await Promise.all([
      supabase.from('automation_logs').select('*').order('run_at', { ascending: false }).limit(10),
      supabase.from('automation_seen_urls').select('id', { count: 'exact', head: true }),
      supabase.from('automation_logs')
        .select('draft_count')
        .gte('run_at', getPacificMidnightUTC().toISOString()),
    ]);
    setRunLogs(logsRes.data || []);
    setSeenCount(seenRes.count || 0);
    const usage = (todayRes.data || []).reduce((s, r) => s + (r.draft_count || 0), 0);
    setTodayUsage(usage);
    setLogsLoad(false);
  }, []);

  const clearSeenUrls = async () => {
    if (!confirm('Tüm görülmüş URL geçmişi silinecek. Devam?')) return;
    await supabase.from('automation_seen_urls').delete().neq('id', 0);
    setSeenCount(0);
    flash('URL geçmişi temizlendi.', 'orange');
  };

  // ── GitHub Actions tetikleme ──────────────────────────────────────────────
  const [ghToken,     setGhToken]    = useState(() => localStorage.getItem('sh_gh_token') || '');
  const [triggering,  setTriggering] = useState(false);
  const [triggerMsg,  setTriggerMsg] = useState(null);
  const [patModal,    setPatModal]   = useState(false);
  const [patInput,    setPatInput]   = useState('');
  // Tetikleme sonrası bekleme süresi (sn) — üretim arka planda dakikalarca
  // sürdüğü için buton bu süre boyunca kilitli kalır, aynı çalışma tekrar
  // tetiklenemez.
  const TRIGGER_COOLDOWN = 180;
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => { localStorage.setItem('sh_gh_token', ghToken); }, [ghToken]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown > 0]);

  const cooldownLabel = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const triggerWorkflow = async (token) => {
    const tok = (token || ghToken).trim();
    if (!tok) { setPatModal(true); return; }
    if (todayUsage >= GEMINI_LIMIT) { flash('Günlük Gemini kotası doldu.', 'orange'); return; }
    if (cooldown > 0) return;
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization:  `token ${tok}`,
            Accept:         'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main', inputs: { mode: 'all' } }),
        }
      );
      if (res.status === 204) {
        flash('Otomasyon tetiklendi! Birkaç dakika içinde taslaklar oluşur.');
        setTriggerMsg({ ok: true, text: 'Tetiklendi! GitHub Actions loglarını kontrol edebilirsin.' });
        setTimeout(() => setTriggerMsg(null), 8000);
        setCooldown(TRIGGER_COOLDOWN);
      } else {
        const d = await res.json().catch(() => ({}));
        const msg = `GitHub API hatası ${res.status}: ${d?.message || ''}`;
        setTriggerMsg({ ok: false, text: msg });
        flash(msg, 'orange');
      }
    } catch (e) {
      setTriggerMsg({ ok: false, text: 'Bağlantı hatası: ' + e.message });
      flash('Bağlantı hatası: ' + e.message, 'orange');
    } finally {
      setTriggering(false);
    }
  };

  const confirmPat = () => {
    if (!patInput.trim()) return;
    setGhToken(patInput.trim());
    setPatModal(false);
    triggerWorkflow(patInput.trim());
    setPatInput('');
  };

  // ── Kota geri sayım ───────────────────────────────────────────────────────
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = getNextResetUTC() - new Date();
      if (diff <= 0) { setCountdown('Sıfırlanıyor…'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Yükle ────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadSettings();
    loadImageStock();
    loadSources();
    loadKeywords();
    loadDrafts();
    loadLogs();
  }, [loadSettings, loadImageStock, loadSources, loadKeywords, loadDrafts, loadLogs]);

  useEffect(() => {
    if (draftsView === 'rejected') loadRejected();
  }, [draftsView, loadRejected]);

  // ── Grouped keywords ─────────────────────────────────────────────────────
  const kwHigh    = keywords.filter(k => k.group_type === 'high');
  const kwMedium  = keywords.filter(k => k.group_type === 'medium');
  const kwBlocked = keywords.filter(k => k.group_type === 'blocked');

  const quotaPercent = Math.min(100, (todayUsage / GEMINI_LIMIT) * 100);
  const quotaColor   = todayUsage >= GEMINI_LIMIT ? 'var(--adm-red)' : todayUsage >= 15 ? 'var(--adm-orange)' : 'var(--adm-green)';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Başlık + Ana Toggle */}
      <PageHead
        title="İçerik Otomasyonu"
        desc="GitHub Actions pipeline yönetimi — RSS → Gemini → Supabase"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="adm-btn adm-btn--primary"
              onClick={() => triggerWorkflow()}
              disabled={triggering || cooldown > 0 || todayUsage >= GEMINI_LIMIT}
              title={cooldown > 0 ? 'Önceki çalışma sürüyor olabilir, kısa süre sonra tekrar dene' : ghToken ? 'GitHub Actions tetikle' : 'GitHub PAT gerekli'}
              style={{ opacity: (todayUsage >= GEMINI_LIMIT || cooldown > 0) ? 0.5 : 1 }}
            >
              {triggering
                ? <><span className="adm-spinner"></span> Tetikleniyor…</>
                : cooldown > 0
                ? <><AIcon name="clock" size={15} /> Bekle ({cooldownLabel(cooldown)})</>
                : <><AIcon name="zap" size={15} /> Şimdi Çalıştır</>}
            </button>
            <div style={{ width: 1, height: 24, background: 'var(--adm-border-light)' }} />
            <span style={{ fontSize: 13, color: automationEnabled ? 'var(--adm-green)' : 'var(--adm-red)', fontWeight: 700 }}>
              {automationEnabled ? 'Otomasyon AÇIK' : 'KAPALI'}
            </span>
            <label className="adm-switch" style={{ transform: 'scale(1.25)', transformOrigin: 'right' }}>
              <input type="checkbox" checked={automationEnabled} onChange={e => toggleAutomation(e.target.checked)} />
              <span style={{ background: automationEnabled ? 'var(--adm-green)' : 'var(--adm-red)' }}></span>
            </label>
          </div>
        }
      />

      {/* Toast */}
      {toast && (
        <div className="adm-auto-status" style={{
          background: toast.kind === 'orange' ? 'var(--adm-orange-light)' : 'var(--adm-green-light)',
          color: toast.kind === 'orange' ? 'var(--adm-orange)' : 'var(--adm-green)',
        }}>
          <AIcon name="check" size={14} /><span>{toast.msg}</span>
        </div>
      )}

      {/* Tab çubuğu */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`adm-chip${activeTab === t.id ? ' adm-chip--active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13 }}
            onClick={() => setActiveTab(t.id)}
          >
            <AIcon name={t.icon} size={14} />{t.label}
            {t.id === 'drafts' && drafts.length > 0 && (
              <span style={{ background: 'var(--adm-blue)', color: '#fff', borderRadius: 99, fontSize: 11, padding: '1px 7px', fontWeight: 700 }}>
                {drafts.length}
              </span>
            )}
            {t.id === 'drafts' && rejected.length > 0 && (
              <span style={{ background: 'var(--adm-red)', color: '#fff', borderRadius: 99, fontSize: 11, padding: '1px 7px', fontWeight: 700 }}>
                {rejected.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: TASLAKLAR ─────────────────────────────────────────────── */}
      {activeTab === 'drafts' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            {/* Görünüm toggle */}
            <div style={{ display: 'flex', background: 'var(--adm-bg-secondary, #f3f4f6)', borderRadius: 8, padding: 3, gap: 2 }}>
              <button
                onClick={() => setDraftsView('pending')}
                style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: draftsView === 'pending' ? '#fff' : 'transparent',
                  color: draftsView === 'pending' ? 'var(--adm-blue)' : 'var(--adm-text-dim)',
                  boxShadow: draftsView === 'pending' ? '0 1px 4px rgba(0,0,0,.10)' : 'none' }}
              >
                Bekleyenler {drafts.length > 0 && <span style={{ background: 'var(--adm-blue)', color: '#fff', borderRadius: 99, fontSize: 10, padding: '1px 6px', marginLeft: 4 }}>{drafts.length}</span>}
              </button>
              <button
                onClick={() => setDraftsView('rejected')}
                style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: draftsView === 'rejected' ? '#fff' : 'transparent',
                  color: draftsView === 'rejected' ? 'var(--adm-red)' : 'var(--adm-text-dim)',
                  boxShadow: draftsView === 'rejected' ? '0 1px 4px rgba(0,0,0,.10)' : 'none' }}
              >
                Reddedilenler {rejected.length > 0 && <span style={{ background: 'var(--adm-red)', color: '#fff', borderRadius: 99, fontSize: 10, padding: '1px 6px', marginLeft: 4 }}>{rejected.length}</span>}
              </button>
            </div>
            <button
              className="adm-btn adm-btn--ghost"
              onClick={draftsView === 'pending' ? loadDrafts : loadRejected}
              disabled={draftsView === 'pending' ? draftsLoad : rejectedLoad}
            >
              {(draftsView === 'pending' ? draftsLoad : rejectedLoad)
                ? <><span className="adm-spinner"></span> Yükleniyor…</>
                : <><AIcon name="refresh" size={15} /> Yenile</>}
            </button>
          </div>

          {/* Bekleyenler */}
          {draftsView === 'pending' && <>
          <div className="adm-note" style={{ background: 'var(--adm-blue-light)', color: 'var(--adm-blue)', marginBottom: 16 }}>
            <AIcon name="settings" size={14} />
            <span>
              GitHub Actions her saat çalışır, tercih edilen saatlerden biri geçtiğinde devreye girer
              (GitHub'ın tetiklemesi gecikirse bile bir sonraki çalışmada telafi eder).
              Üretilen taslaklar burada listelenir — <strong>Onayla</strong> ile yayına girer.
              {autoPublish && <strong> Otomatik yayın AÇIK — onay gerekmez.</strong>}
            </span>
          </div>
          <div className="adm-card">
            <div className="adm-card__header"><h3>Onay Bekleyen Taslaklar</h3></div>
            <div className="adm-card__body" style={{ padding: 0 }}>
              {draftsLoad ? (
                <div className="adm-empty"><span className="adm-spinner" style={{ width: 28, height: 28 }}></span></div>
              ) : drafts.length === 0 ? (
                <div className="adm-empty" style={{ padding: '32px 24px', textAlign: 'center' }}>
                  <AIcon name="layers" size={40} style={{ opacity: 0.15, marginBottom: 12 }} />
                  <p style={{ marginBottom: 16, color: 'var(--adm-text-dim)' }}>Onay bekleyen taslak yok.</p>
                  <button
                    className="adm-btn adm-btn--primary"
                    onClick={() => triggerWorkflow()}
                    disabled={triggering || cooldown > 0 || todayUsage >= GEMINI_LIMIT}
                  >
                    {triggering
                      ? <><span className="adm-spinner"></span> Tetikleniyor…</>
                      : cooldown > 0
                      ? <><AIcon name="clock" size={15} /> Bekle ({cooldownLabel(cooldown)})</>
                      : <><AIcon name="zap" size={15} /> Otomasyonu Tetikle</>}
                  </button>
                  {todayUsage >= GEMINI_LIMIT && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--adm-orange)' }}>Günlük Gemini kotası doldu, yarın sıfırlanır.</div>
                  )}
                  {cooldown > 0 && todayUsage < GEMINI_LIMIT && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--adm-text-dim)' }}>Önceki çalışma birkaç dakika sürebilir, bu yüzden buton geçici olarak kilitli.</div>
                  )}
                </div>
              ) : (
                <>
                  {selectedIds.size > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--adm-blue-light)', borderBottom: '1px solid var(--adm-border-light)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--adm-blue)' }}>{selectedIds.size} taslak seçildi</span>
                      <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={bulkApprove} disabled={bulkActing}>
                        {bulkActing ? <span className="adm-spinner"></span> : <><AIcon name="check" size={14} /> Seçilenleri Onayla</>}
                      </button>
                      <button className="adm-btn adm-btn--sm" onClick={bulkReject} disabled={bulkActing} style={{ background: 'var(--adm-red-light)', color: 'var(--adm-red)', border: 'none' }}>
                        <AIcon name="x" size={14} /> Seçilenleri Reddet
                      </button>
                      <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setSelectedIds(new Set())}>Seçimi Temizle</button>
                    </div>
                  )}
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>
                            <input type="checkbox" checked={selectedIds.size === drafts.length && drafts.length > 0} onChange={toggleAll}
                              style={{ cursor: 'pointer' }} title="Tümünü seç" />
                          </th>
                          <th>Başlık</th><th>Etiket</th><th>Üretildi</th><th>Kaynak</th><th style={{ textAlign: 'right' }}>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drafts.map(d => (
                          <tr key={d.id} style={{ background: selectedIds.has(d.id) ? 'var(--adm-blue-light)' : undefined }}>
                            <td>
                              <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleSelect(d.id)} style={{ cursor: 'pointer' }} />
                            </td>
                            <td style={{ maxWidth: 340 }}>
                              <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{d.title_tr}</div>
                              <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>/{d.slug}</div>
                              {d.excerpt_tr && <div style={{ fontSize: 12, color: 'var(--adm-text-secondary)', marginTop: 2 }}>{d.excerpt_tr.slice(0, 90)}{d.excerpt_tr.length > 90 ? '…' : ''}</div>}
                            </td>
                            <td><span className="adm-badge adm-badge--tag">{d.tag || 'gundem'}</span></td>
                            <td style={{ whiteSpace: 'nowrap', color: 'var(--adm-text-secondary)' }}>{d.generated_at ? fmtDateTime(d.generated_at) : fmtDate(d.date)}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {d.source ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--adm-text-secondary)' }}>
                                  <AIcon name="globe" size={13} />
                                  {d.source_url ? <a href={d.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{d.source}</a> : d.source}
                                </span>
                              ) : '—'}
                            </td>
                            <td>
                              <div className="adm-table__actions" style={{ justifyContent: 'flex-end' }}>
                                <button className="adm-icon-btn" title="Önizle" onClick={() => setPreview(d)}><AIcon name="eye" size={15} /></button>
                                <button className="adm-icon-btn" title="Düzenle" onClick={() => openEditDraft(d)}><AIcon name="edit" size={15} /></button>
                                <button
                                  className="adm-btn adm-btn--primary adm-btn--sm"
                                  onClick={() => approve(d)}
                                  disabled={actingId !== null}
                                  style={{ opacity: actingId !== null && actingId !== d.id ? 0.5 : 1 }}
                                >
                                  {actingId === d.id ? <><span className="adm-spinner"></span> İşleniyor…</> : <><AIcon name="check" size={14} /> Onayla</>}
                                </button>
                                <button className="adm-icon-btn adm-icon-btn--danger" title="Reddet" onClick={() => reject(d)} disabled={actingId !== null}>
                                  <AIcon name="x" size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
          </>}

          {/* Reddedilenler */}
          {draftsView === 'rejected' && (
            <div className="adm-card">
              <div className="adm-card__header">
                <h3>Reddedilen Taslaklar</h3>
                <span style={{ fontSize: 12.5, color: 'var(--adm-text-dim)', fontWeight: 400 }}>
                  Geri Al → taslağa döner · Sil → kalıcı olarak kaldırılır
                </span>
              </div>
              <div className="adm-card__body" style={{ padding: 0 }}>
                {rejectedLoad ? (
                  <div className="adm-empty"><span className="adm-spinner" style={{ width: 28, height: 28 }}></span></div>
                ) : rejected.length === 0 ? (
                  <div className="adm-empty">
                    <AIcon name="check" size={40} style={{ opacity: 0.15 }} />
                    <p style={{ color: 'var(--adm-text-dim)' }}>Reddedilen taslak yok.</p>
                  </div>
                ) : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr><th>Başlık</th><th>Etiket</th><th>Üretildi</th><th>Kaynak</th><th style={{ textAlign: 'right' }}>İşlem</th></tr>
                      </thead>
                      <tbody>
                        {rejected.map(r => (
                          <tr key={r.id} style={{ opacity: actingId === r.id ? 0.5 : 1 }}>
                            <td style={{ maxWidth: 340 }}>
                              <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{r.title_tr}</div>
                              <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>/{r.slug}</div>
                              {r.excerpt_tr && <div style={{ fontSize: 12, color: 'var(--adm-text-secondary)', marginTop: 2 }}>{r.excerpt_tr.slice(0, 90)}{r.excerpt_tr.length > 90 ? '…' : ''}</div>}
                            </td>
                            <td><span className="adm-badge adm-badge--tag">{r.tag || 'gundem'}</span></td>
                            <td style={{ whiteSpace: 'nowrap', color: 'var(--adm-text-secondary)' }}>{r.generated_at ? fmtDateTime(r.generated_at) : fmtDate(r.date)}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {r.source ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--adm-text-secondary)' }}>
                                  <AIcon name="globe" size={13} />
                                  {r.source_url ? <a href={r.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{r.source}</a> : r.source}
                                </span>
                              ) : '—'}
                            </td>
                            <td>
                              <div className="adm-table__actions" style={{ justifyContent: 'flex-end' }}>
                                <button className="adm-icon-btn" title="Önizle" onClick={() => setPreview(r)}><AIcon name="eye" size={15} /></button>
                                <button
                                  className="adm-btn adm-btn--sm"
                                  onClick={() => restore(r)}
                                  disabled={actingId !== null}
                                  style={{ background: 'var(--adm-green-light)', color: 'var(--adm-green)', border: 'none' }}
                                  title="Taslağa geri al"
                                >
                                  {actingId === r.id ? <span className="adm-spinner"></span> : <><AIcon name="refresh" size={14} /> Geri Al</>}
                                </button>
                                <button
                                  className="adm-icon-btn adm-icon-btn--danger"
                                  title="Kalıcı sil"
                                  onClick={() => deletePermanently(r)}
                                  disabled={actingId !== null}
                                >
                                  <AIcon name="trash" size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: GÖRSEL STOĞU ──────────────────────────────────────────── */}
      {activeTab === 'imagestock' && (
        <div>
          <div className="adm-note" style={{ background: 'var(--adm-blue-light)', color: 'var(--adm-blue)', marginBottom: 16 }}>
            <AIcon name="settings" size={14} />
            <span>
              Otomasyon artık kaynak sitelerden görsel indirmiyor — her taslak için buradaki
              havuzdan başlığa/özete ve kategoriye en uygun stok görsel otomatik seçiliyor.
              Kaliteli sonuçlar için farklı kategori ve etiketlerde yeterli sayıda görsel yükleyin.
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="adm-btn adm-btn--primary" onClick={openAddImage}>
              <AIcon name="plus" size={15} /> Görsel Ekle
            </button>
          </div>
          <div className="adm-card">
            <div className="adm-card__header"><h3>Görsel Stoğu</h3></div>
            <div className="adm-card__body" style={{ padding: 0 }}>
              {imgLoading ? (
                <div className="adm-empty"><span className="adm-spinner" style={{ width: 28, height: 28 }}></span></div>
              ) : imageStock.length === 0 ? (
                <div className="adm-empty" style={{ padding: '32px 24px', textAlign: 'center' }}>
                  <AIcon name="image" size={40} style={{ opacity: 0.15, marginBottom: 12 }} />
                  <p style={{ color: 'var(--adm-text-dim)' }}>Henüz stok görsel yok. "Görsel Ekle" ile başla.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, padding: 16 }}>
                  {imageStock.map(row => (
                    <div key={row.id} style={{ border: '1px solid var(--adm-border-light)', borderRadius: 'var(--adm-r)', overflow: 'hidden' }}>
                      <div style={{ width: '100%', aspectRatio: '1200/630', background: 'var(--adm-bg)', overflow: 'hidden' }}>
                        <img src={row.url} alt={row.alt_tr || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span className="adm-badge" style={{ background: 'var(--adm-blue-light)', color: 'var(--adm-blue)' }}>{row.category || '—'}</span>
                          <span style={{ fontSize: 11.5, color: 'var(--adm-text-dim)' }}>{row.usage_count || 0}× kullanıldı</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8, minHeight: 20 }}>
                          {(row.tags || []).slice(0, 4).map((tag, i) => (
                            <span key={i} style={{ fontSize: 11, background: 'var(--adm-bg)', color: 'var(--adm-text-secondary)', padding: '2px 7px', borderRadius: 6 }}>{tag}</span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="adm-icon-btn" title="Düzenle" onClick={() => openEditImage(row)}><AIcon name="edit" size={14} /></button>
                          <button className="adm-icon-btn adm-icon-btn--danger" title="Sil" onClick={() => deleteImage(row)}><AIcon name="trash" size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: KAYNAKLAR ─────────────────────────────────────────────── */}
      {activeTab === 'sources' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="adm-btn adm-btn--primary" onClick={openAddSource}>
                <AIcon name="plus" size={15} /> Kaynak Ekle
              </button>
              <button className="adm-icon-btn" title="Kaynaklar hakkında bilgi" onClick={() => setInfoOpen(true)}>
                <AIcon name="info" size={16} />
              </button>
            </div>
            <button className="adm-btn adm-btn--ghost" onClick={loadSources} disabled={srcLoading}>
              <AIcon name="refresh" size={15} /> Yenile
            </button>
          </div>

          <div className="adm-card">
            <div className="adm-card__header"><h3>RSS Kaynakları</h3></div>
            <div className="adm-card__body" style={{ padding: 0 }}>
              {srcLoading ? (
                <div className="adm-empty"><span className="adm-spinner" style={{ width: 24, height: 24 }}></span></div>
              ) : sources.length === 0 ? (
                <div className="adm-empty">
                  <AIcon name="globe" size={36} style={{ opacity: 0.2 }} />
                  <p>Henüz kaynak yok. "Kaynak Ekle" ile başla.</p>
                </div>
              ) : (
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr><th>Kaynak Adı</th><th>Feed URL</th><th>Ağırlık</th><th>Durum</th><th style={{ textAlign: 'right' }}>İşlem</th></tr>
                    </thead>
                    <tbody>
                      {sources.map(s => (
                        <tr key={s.id} style={{ opacity: s.enabled ? 1 : 0.5 }}>
                          <td style={{ fontWeight: 600 }}>{s.name}</td>
                          <td style={{ fontSize: 12, color: 'var(--adm-text-secondary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{s.url}</a>
                          </td>
                          <td>
                            <span className="adm-badge" style={{ background: 'var(--adm-blue-light)', color: 'var(--adm-blue)', minWidth: 32, justifyContent: 'center' }}>
                              {s.weight}/10
                            </span>
                          </td>
                          <td>
                            <label className="adm-switch">
                              <input type="checkbox" checked={s.enabled} onChange={() => toggleSource(s)} />
                              <span></span>
                            </label>
                          </td>
                          <td>
                            <div className="adm-table__actions" style={{ justifyContent: 'flex-end' }}>
                              <button className="adm-icon-btn" title="Düzenle" onClick={() => openEditSource(s)}><AIcon name="edit" size={15} /></button>
                              <button className="adm-icon-btn adm-icon-btn--danger" title="Sil" onClick={() => deleteSource(s.id)}><AIcon name="trash" size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: KELIMELER ─────────────────────────────────────────────── */}
      {activeTab === 'keywords' && (
        <div>
          {/* Kelime ekle formu */}
          <div className="adm-card" style={{ marginBottom: 20 }}>
            <div className="adm-card__header"><h3>Kelime Ekle</h3></div>
            <div className="adm-card__body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'end' }}>
                <Field label="Anahtar Kelime">
                  <Input value={newKw.keyword} onChange={v => setNewKw(p => ({ ...p, keyword: v }))} placeholder="örn. yapay zeka" onKeyDown={e => e.key === 'Enter' && addKeyword()} />
                </Field>
                <Field label="Puan (1-10)">
                  <Input type="number" value={String(newKw.score)} onChange={v => setNewKw(p => ({ ...p, score: Math.min(10, Math.max(1, parseInt(v) || 5)) }))} style={{ width: 70 }} />
                </Field>
                <Field label="Grup">
                  <select className="adm-select" value={newKw.group_type} onChange={e => setNewKw(p => ({ ...p, group_type: e.target.value }))}>
                    <option value="high">Yüksek Değer</option>
                    <option value="medium">Orta Değer</option>
                    <option value="blocked">Engel Listesi</option>
                  </select>
                </Field>
                <button className="adm-btn adm-btn--primary" onClick={addKeyword} disabled={kwSaving} style={{ marginBottom: 0 }}>
                  {kwSaving ? <span className="adm-spinner"></span> : <><AIcon name="plus" size={14} /> Ekle</>}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--adm-text-dim)', margin: '8px 0 0' }}>
                <strong>Yüksek / Orta Değer:</strong> Bu kelimeleri içeren haberler puana göre sıralamada öne geçer. &nbsp;
                <strong>Engel Listesi:</strong> Bu kelimeleri içeren haberler tamamen elenir.
              </p>
            </div>
          </div>

          <div className="adm-grid-2" style={{ gap: 16 }}>
            {/* Yüksek Değer */}
            <div className="adm-card">
              <div className="adm-card__header">
                <h3>Yüksek Değer</h3>
                <span style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>{kwHigh.length} kelime</span>
              </div>
              <div className="adm-card__body" style={{ padding: 0 }}>
                {kwHigh.length === 0
                  ? <div style={{ padding: 16, color: 'var(--adm-text-dim)', fontSize: 13 }}>Henüz kelime yok.</div>
                  : kwHigh.map(k => <KwRow key={k.id} kw={k} color="var(--adm-green)" bg="var(--adm-green-light)" onDelete={deleteKeyword} />)}
              </div>
            </div>

            {/* Orta Değer */}
            <div className="adm-card">
              <div className="adm-card__header">
                <h3>Orta Değer</h3>
                <span style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>{kwMedium.length} kelime</span>
              </div>
              <div className="adm-card__body" style={{ padding: 0 }}>
                {kwMedium.length === 0
                  ? <div style={{ padding: 16, color: 'var(--adm-text-dim)', fontSize: 13 }}>Henüz kelime yok.</div>
                  : kwMedium.map(k => <KwRow key={k.id} kw={k} color="var(--adm-blue)" bg="var(--adm-blue-light)" onDelete={deleteKeyword} />)}
              </div>
            </div>
          </div>

          {/* Engel Listesi */}
          <div className="adm-card" style={{ marginTop: 16 }}>
            <div className="adm-card__header">
              <h3>Engel Listesi</h3>
              <span style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>{kwBlocked.length} kelime — bu kelimeleri içeren haberler tamamen elenir</span>
            </div>
            <div className="adm-card__body" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {kwBlocked.length === 0
                ? <span style={{ color: 'var(--adm-text-dim)', fontSize: 13 }}>Engel kelimesi yok.</span>
                : kwBlocked.map(k => (
                  <span key={k.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--adm-red-light)', color: 'var(--adm-red)', borderRadius: 8, padding: '4px 10px', fontSize: 13 }}>
                    {k.keyword}
                    <button onClick={() => deleteKeyword(k.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1 }}><AIcon name="x" size={12} /></button>
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: TON & AYARLAR ─────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div>
          {/* Yazı Tonu */}
          <div className="adm-card" style={{ marginBottom: 20 }}>
            <div className="adm-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Yazı Tonu</h3>
              {savingSettings && <span style={{ fontSize: 12, color: 'var(--adm-text-dim)', display: 'flex', gap: 6 }}><span className="adm-spinner"></span> Kaydediliyor…</span>}
            </div>
            <div className="adm-card__body">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                {TONE_LEVELS.map(({ level, label, desc }) => {
                  const active = toneLevel === level;
                  return (
                    <button key={level} onClick={() => { setToneLevel(level); saveSettings({ tone_level: level }); }}
                      style={{ flex: '1 1 130px', padding: '10px 12px', borderRadius: 10, border: `2px solid ${active ? 'var(--adm-blue)' : 'var(--adm-border-light)'}`, background: active ? 'var(--adm-blue-light)' : 'var(--adm-bg)', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: active ? 'var(--adm-blue)' : 'var(--adm-border)', color: active ? '#fff' : 'var(--adm-text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{level}</span>
                        <span style={{ fontWeight: 700, fontSize: 13, color: active ? 'var(--adm-blue)' : 'var(--adm-text)' }}>{label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', lineHeight: 1.4 }}>{desc}</div>
                    </button>
                  );
                })}
              </div>

              <Field label={`Ton ${toneLevel} İçin Ek Talimat`} hint="Opsiyonel — bu seviyeye özgü kurallar">
                <textarea
                  className="adm-textarea"
                  rows={3}
                  value={toneExtra[String(toneLevel)] || ''}
                  onChange={e => setToneExtra(prev => ({ ...prev, [String(toneLevel)]: e.target.value }))}
                  placeholder="örn. Türk girişimcilere somut etki analizi mutlaka eklensin"
                />
              </Field>

              <div style={{ marginTop: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Yasaklı İfadeler</label>
                <p style={{ fontSize: 12, color: 'var(--adm-text-dim)', margin: '0 0 8px' }}>Gemini bu ifadeleri hiç kullanmaz. Enter ile ekle.</p>
                <TagInput tags={toneBanned} onChange={setToneBanned} />
              </div>

              <button
                className="adm-btn adm-btn--primary"
                style={{ marginTop: 16 }}
                onClick={() => saveSettings({ tone_extra_instructions: toneExtra, tone_banned_phrases: toneBanned })}
                disabled={savingSettings}
              >
                <AIcon name="check" size={15} /> Ton Ayarlarını Kaydet
              </button>
            </div>
          </div>

          {/* Otomasyon Ayarları */}
          <div className="adm-card" style={{ marginBottom: 20 }}>
            <div className="adm-card__header"><h3>Otomasyon Ayarları</h3></div>
            <div className="adm-card__body">
              {/* Auto-publish toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16, borderBottom: '1px solid var(--adm-border-light)', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Otomatik Yayın</div>
                  <div style={{ fontSize: 12.5, color: 'var(--adm-text-dim)', maxWidth: 420 }}>
                    Açıkken GitHub Actions ürettiği makaleyi direkt yayınlar — admin onayı gerekmez.
                  </div>
                  {autoPublish && (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--adm-orange)', background: 'var(--adm-orange-light)', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
                      ⚠ Açıkken AI içeriği editörsüz yayınlanır, kalite kontrolü yapılmaz.
                    </div>
                  )}
                </div>
                <label className="adm-switch">
                  <input type="checkbox" checked={autoPublish} onChange={e => toggleAutoPublish(e.target.checked)} />
                  <span></span>
                </label>
              </div>

              {/* Tercih edilen saat(ler) */}
              <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--adm-border-light)', marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Tercih Edilen Çalışma Saatleri (UTC)</div>
                <div style={{ fontSize: 12.5, color: 'var(--adm-text-dim)', marginBottom: 12 }}>
                  GitHub Actions her saat çalışır; seçtiğiniz saatlerden biri geçtiğinde ve o saat için henüz
                  üretim yapılmadıysa devreye girer. GitHub'ın tetiklemesi tam saatinde çalışmaz/gecikirse bile
                  bir sonraki çalışmada telafi eder — taslak birkaç dakika/saat geç de olsa üretilir.
                  Birden fazla saat seçerek üretimi güne yayabilirsiniz — her seçili saatte ayrı bir üretim turu çalışır (günlük kota her turda ayrı ayrı uygulanır).
                  <br />UTC+3 (TRT) = seçilen saat + 3s
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {Array.from({ length: 24 }, (_, h) => {
                    const on = preferredHours.includes(h);
                    return (
                      <button
                        key={h}
                        onClick={() => setPreferredHours(prev => on ? prev.filter(x => x !== h) : [...prev, h].sort((a, b) => a - b))}
                        title={`${String((h + 3) % 24).padStart(2, '0')}:00 TRT`}
                        style={{ padding: '6px 10px', borderRadius: 8, border: `2px solid ${on ? 'var(--adm-blue)' : 'var(--adm-border-light)'}`, background: on ? 'var(--adm-blue-light)' : 'var(--adm-bg)', cursor: 'pointer', fontSize: 12.5, fontWeight: on ? 700 : 400, color: on ? 'var(--adm-blue)' : 'var(--adm-text)' }}
                      >
                        {String(h).padStart(2, '0')}:00
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--adm-text-dim)' }}>
                    {preferredHours.length === 0
                      ? 'Hiç saat seçilmedi — otomasyon hiç çalışmaz.'
                      : `Seçili: ${preferredHours.map(h => `${String(h).padStart(2, '0')}:00`).join(', ')} UTC (TRT: ${preferredHours.map(h => String((h + 3) % 24).padStart(2, '0') + ':00').join(', ')})`}
                  </span>
                  <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => saveSettings({ preferred_run_hours: preferredHours })} style={{ flexShrink: 0 }}>
                    Kaydet
                  </button>
                </div>
              </div>

              {/* Kategori filtresi */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Kategori Filtresi</div>
                <div style={{ fontSize: 12.5, color: 'var(--adm-text-dim)', marginBottom: 12 }}>
                  Boş bırakılırsa tüm kategoriler kabul edilir. Seçilenlerin dışındaki kategoriler elenir.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {ALL_CATEGORIES.map(cat => {
                    const on = enabledCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        onClick={() => setEnabledCategories(prev => on ? prev.filter(c => c !== cat) : [...prev, cat])}
                        style={{ padding: '6px 14px', borderRadius: 8, border: `2px solid ${on ? 'var(--adm-blue)' : 'var(--adm-border-light)'}`, background: on ? 'var(--adm-blue-light)' : 'var(--adm-bg)', cursor: 'pointer', fontSize: 13, color: on ? 'var(--adm-blue)' : 'var(--adm-text)', fontWeight: on ? 700 : 400 }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => saveSettings({ enabled_categories: enabledCategories })}>
                  <AIcon name="check" size={14} /> Kategori Filtresini Kaydet
                </button>
              </div>
            </div>
          </div>

          {/* Manuel Tetikleme + Kota */}
          <div className="adm-card">
            <div className="adm-card__header"><h3>Manuel Tetikleme</h3></div>
            <div className="adm-card__body">
              {/* Kota */}
              <div style={{ background: 'var(--adm-bg-secondary, #f9fafb)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Gemini API Kota (Ücretsiz)</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: quotaColor }}>{todayUsage} / {GEMINI_LIMIT} istek</div>
                </div>
                <div style={{ height: 8, background: 'var(--adm-border-light)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${quotaPercent}%`, height: '100%', background: quotaColor, borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--adm-text-dim)' }}>Sıfırlanma: 10:00 TRT (Pasifik gece yarısı)</span>
                  <span style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', fontFamily: 'monospace' }}>{countdown}</span>
                </div>
              </div>

              <Field label="GitHub Personal Access Token" hint="Actions: Read & write izni gerekli — tarayıcında şifreli saklanır">
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input type="password" value={ghToken} onChange={setGhToken} placeholder="github_pat_... veya ghp_..." />
                  {ghToken && (
                    <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => { setGhToken(''); localStorage.removeItem('sh_gh_token'); }} title="Token'ı sil">
                      <AIcon name="x" size={14} />
                    </button>
                  )}
                </div>
              </Field>

              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="adm-btn adm-btn--primary"
                  onClick={() => triggerWorkflow()}
                  disabled={triggering || cooldown > 0 || !ghToken.trim() || todayUsage >= GEMINI_LIMIT}
                  style={{ opacity: (todayUsage >= GEMINI_LIMIT || cooldown > 0) ? 0.5 : 1 }}
                >
                  {triggering
                    ? <><span className="adm-spinner"></span> Tetikleniyor…</>
                    : cooldown > 0
                    ? <><AIcon name="clock" size={15} /> Bekle ({cooldownLabel(cooldown)})</>
                    : <><AIcon name="zap" size={15} /> Şimdi Çalıştır</>}
                </button>
                <a
                  href={`https://github.com/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="adm-btn adm-btn--ghost"
                >
                  <AIcon name="arrowUpRight" size={15} /> GitHub Actions Logları
                </a>
              </div>

              {triggerMsg && (
                <div style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, fontSize: 13, background: triggerMsg.ok ? 'var(--adm-green-light)' : 'var(--adm-red-light)', color: triggerMsg.ok ? 'var(--adm-green)' : 'var(--adm-red)' }}>
                  {triggerMsg.text}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: LOGLAR ────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="adm-btn adm-btn--ghost" onClick={loadLogs} disabled={logsLoad}>
              {logsLoad ? <><span className="adm-spinner"></span></> : <><AIcon name="refresh" size={15} /> Yenile</>}
            </button>
          </div>

          {/* Son çalışmalar */}
          <div className="adm-card" style={{ marginBottom: 20 }}>
            <div className="adm-card__header"><h3>Son Çalışmalar</h3></div>
            <div className="adm-card__body" style={{ padding: 0 }}>
              {logsLoad ? (
                <div className="adm-empty"><span className="adm-spinner" style={{ width: 24, height: 24 }}></span></div>
              ) : runLogs.length === 0 ? (
                <div className="adm-empty"><p>Henüz çalışma logu yok.</p></div>
              ) : (
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr><th>Tarih / Saat</th><th>Bulunan</th><th>Elenen</th><th>Üretilen</th><th>Hata</th></tr>
                    </thead>
                    <tbody>
                      {runLogs.map(l => (
                        <tr key={l.id} style={l.error_text ? { background: 'var(--adm-red-light)' } : undefined}>
                          <td style={{ whiteSpace: 'nowrap', color: 'var(--adm-text-secondary)' }}>{fmtDateTime(l.run_at)}</td>
                          <td><span className="adm-badge adm-badge--tag">{l.found_count}</span></td>
                          <td><span className="adm-badge" style={{ background: 'var(--adm-orange-light)', color: 'var(--adm-orange)' }}>{l.filtered_count}</span></td>
                          <td><span className="adm-badge" style={{ background: 'var(--adm-green-light)', color: 'var(--adm-green)' }}>{l.draft_count}</span></td>
                          <td style={{ fontSize: 12, color: l.error_text ? 'var(--adm-red)' : 'var(--adm-text-dim)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.error_text || ''}>
                            {l.error_text ? <strong>{l.error_text.slice(0, 80)}{l.error_text.length > 80 ? '…' : ''}</strong> : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Görülmüş URL'ler */}
          <div className="adm-card">
            <div className="adm-card__header"><h3>Tekrar Engeli (Görülmüş URL'ler)</h3></div>
            <div className="adm-card__body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--adm-blue)' }}>{seenCount}</div>
                  <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>URL daha önce işlendi, bir daha getirilmez</div>
                </div>
                <button className="adm-btn adm-btn--ghost" onClick={clearSeenUrls} style={{ color: 'var(--adm-red)' }}>
                  <AIcon name="trash" size={15} /> Geçmişi Temizle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALLER ─────────────────────────────────────────────────────── */}

      {/* Kaynak ekle/düzenle */}
      {sourceModal && (
        <Modal open onClose={() => setSourceModal(null)} title={sourceModal.mode === 'add' ? 'Kaynak Ekle' : 'Kaynağı Düzenle'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Kaynak Adı">
              <Input value={srcForm.name} onChange={v => setSrcForm(p => ({ ...p, name: v }))} placeholder="örn. TechCrunch" />
            </Field>
            <Field label="RSS Feed URL">
              <Input value={srcForm.url} onChange={v => setSrcForm(p => ({ ...p, url: v }))} placeholder="https://techcrunch.com/feed" />
            </Field>
            <Field label="Ağırlık Puanı (1-10)" hint="Yüksek puan → bu kaynaktan gelen haberler öne geçer">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="range" min={1} max={10} value={srcForm.weight}
                  onChange={e => setSrcForm(p => ({ ...p, weight: Number(e.target.value) }))}
                  style={{ flex: 1 }} />
                <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{srcForm.weight}</span>
              </div>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--adm-border-light)' }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setSourceModal(null)}>İptal</button>
              <button className="adm-btn adm-btn--primary" onClick={saveSource} disabled={srcSaving}>
                {srcSaving ? <><span className="adm-spinner"></span> Kaydediliyor…</> : <><AIcon name="check" size={15} /> Kaydet</>}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Görsel stoğu ekle/düzenle */}
      {imgModal && (
        <Modal open onClose={() => setImgModal(null)} title={imgModal.mode === 'add' ? 'Görsel Ekle' : 'Görseli Düzenle'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Görsel">
              <PostCoverUpload
                value={imgForm.url}
                onChange={v => setImgForm(p => ({ ...p, url: v }))}
                postSlug=""
                pathPrefix="stock/"
              />
            </Field>
            <Field label="Kategori">
              <Select
                value={imgForm.category}
                onChange={v => setImgForm(p => ({ ...p, category: v }))}
                placeholder="Seç..."
                options={IMAGE_STOCK_CATEGORIES.map(c => ({ value: c, label: c }))}
              />
            </Field>
            <Field label="Etiketler" hint="Enter ile ekle — örn. anlaşma, el sıkışma, iş insanı, toplantı, yatırım">
              <TagInput tags={imgForm.tags} onChange={v => setImgForm(p => ({ ...p, tags: v }))} />
            </Field>
            <div className="adm-form-grid">
              <Field label="Alt Metin (TR)" hint="Opsiyonel, SEO/erişilebilirlik için">
                <Input value={imgForm.alt_tr} onChange={v => setImgForm(p => ({ ...p, alt_tr: v }))} />
              </Field>
              <Field label="Alt Metin (EN)" hint="Opsiyonel">
                <Input value={imgForm.alt_en} onChange={v => setImgForm(p => ({ ...p, alt_en: v }))} />
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--adm-border-light)' }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setImgModal(null)}>İptal</button>
              <button className="adm-btn adm-btn--primary" onClick={saveImage} disabled={imgSaving}>
                {imgSaving ? <><span className="adm-spinner"></span> Kaydediliyor…</> : <><AIcon name="check" size={15} /> Kaydet</>}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Kaynak bilgi modalı */}
      {infoOpen && (
        <Modal open onClose={() => setInfoOpen(false)} title="RSS Kaynakları Hakkında">
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--adm-text)' }}>
            <p>Bu panel, Python otomasyonunun haber çekeceği RSS kaynaklarını yönetir.</p>
            <ul style={{ paddingLeft: 18, margin: '12px 0' }}>
              <li><strong>Feed URL:</strong> Haberlerin çekileceği RSS/Atom adresi. Feed testini tarayıcıda açarak doğrulayabilirsin.</li>
              <li><strong>Ağırlık Puanı:</strong> 1-10 arası. Puan yükseldikçe bu kaynaktan gelen haberler sıralamada öne geçer; düşük puanlı kaynaklar sadece başka kaynaklarda çok iyi haber yoksa seçilir.</li>
              <li><strong>Toggle:</strong> Kapalıyken kaynak RSS taramasına dahil edilmez — silinmez, devre dışı kalır.</li>
            </ul>
            <p style={{ color: 'var(--adm-text-dim)', fontSize: 12.5 }}>Değişiklikler bir sonraki GitHub Actions çalışmasında geçerli olur.</p>
          </div>
        </Modal>
      )}

      {/* Taslak önizleme */}
      {preview && (
        <Modal open onClose={() => setPreview(null)} title="Taslak Önizleme" wide>
          <div className="adm-pv-article">
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span className="adm-badge adm-badge--tag">{preview.tag || 'gundem'}</span>
              {preview.source && (
                <span className="adm-badge" style={{ background: 'var(--adm-blue-light)', color: 'var(--adm-blue)' }}>
                  <AIcon name="globe" size={12} /> {preview.source}
                </span>
              )}
            </div>
            <div className="adm-pv-article__title">{preview.title_tr}</div>
            {preview.image_url && (
              <div className="adm-pv-article__cover" style={{ background: previewCoverBg(preview.bg), position: 'relative' }}>
                <img
                  src={preview.image_url}
                  alt={preview.title_tr}
                  onError={e => { e.currentTarget.parentElement.style.display = 'none'; }}
                />
                {preview.source && (
                  <span style={{
                      position: 'absolute', bottom: 8, right: 12,
                      fontSize: 10, color: 'rgba(255,255,255,0.7)',
                      background: 'rgba(0,0,0,0.35)', padding: '2px 8px', borderRadius: 20,
                    }}>
                    Görsel: {preview.source}
                  </span>
                )}
              </div>
            )}
            <div className="adm-pv-article__lead">{preview.excerpt_tr}</div>
            <div className="adm-pv-article__body">
              {(preview.body_tr || []).map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <div className="adm-pv-article__src">
              Kaynak:{' '}
              {preview.source_url
                ? <a href={preview.source_url} target="_blank" rel="noopener noreferrer">{preview.source}</a>
                : preview.source} · /{preview.slug}
            </div>
          </div>
        </Modal>
      )}

      {/* Taslak düzenleme */}
      {editDraft && (
        <Modal open onClose={() => setEditDraft(null)} title="Taslağı Düzenle" wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Başlık">
              <Input
                value={draftForm.title_tr}
                onChange={e => setDraftForm(p => ({ ...p, title_tr: e.target.value }))}
                placeholder="Makale başlığı"
              />
            </Field>
            <Field label="Özet">
              <textarea
                className="adm-input"
                rows={3}
                value={draftForm.excerpt_tr}
                onChange={e => setDraftForm(p => ({ ...p, excerpt_tr: e.target.value }))}
                placeholder="Kısa özet"
                style={{ resize: 'vertical' }}
              />
            </Field>
            <Field label="İçerik (paragraflar)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {draftForm.body_tr.map((para, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <textarea
                      className="adm-input"
                      rows={3}
                      value={para}
                      onChange={e => setBodyParagraph(i, e.target.value)}
                      placeholder={`Paragraf ${i + 1}`}
                      style={{ flex: 1, resize: 'vertical' }}
                    />
                    <button
                      className="adm-icon-btn adm-icon-btn--danger"
                      onClick={() => removeBodyParagraph(i)}
                      title="Paragrafı sil"
                      style={{ marginTop: 4, flexShrink: 0 }}
                    >
                      <AIcon name="x" size={14} />
                    </button>
                  </div>
                ))}
                <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={addBodyParagraph} style={{ alignSelf: 'flex-start' }}>
                  <AIcon name="plus" size={13} /> Paragraf Ekle
                </button>
              </div>
            </Field>
            <Field label="Etiket">
              <select
                className="adm-input"
                value={draftForm.tag}
                onChange={e => setDraftForm(p => ({ ...p, tag: e.target.value }))}
              >
                <option value="gundem">Gündem</option>
                <option value="blog">Blog</option>
                <option value="etkinlik">Etkinlik</option>
              </select>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--adm-border-light)' }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => setEditDraft(null)}>İptal</button>
              <button className="adm-btn adm-btn--primary" onClick={saveDraftEdit} disabled={editSaving}>
                {editSaving ? <><span className="adm-spinner"></span> Kaydediliyor…</> : <><AIcon name="check" size={15} /> Kaydet</>}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* GitHub PAT Girişi */}
      {patModal && (
        <Modal open onClose={() => { setPatModal(false); setPatInput(''); }} title="GitHub Token Gerekli">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--adm-text)' }}>
              Otomasyonu panelden tetiklemek için bir <strong>GitHub Personal Access Token</strong> gerekli.
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--adm-blue-light)', borderRadius: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Token nasıl alınır?</div>
                <ol style={{ paddingLeft: 18, margin: 0, lineHeight: 2 }}>
                  <li>GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens</li>
                  <li>Repository: <strong>starthubcommunity/StartHub</strong> seç</li>
                  <li>İzin: <strong>Actions → Read and write</strong></li>
                  <li>Token'ı kopyalayıp aşağıya yapıştır</li>
                </ol>
              </div>
            </div>
            <Field label="Personal Access Token">
              <Input
                type="password"
                value={patInput}
                onChange={v => setPatInput(v)}
                placeholder="github_pat_... veya ghp_..."
              />
            </Field>
            <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>
              Token tarayıcında şifreli olarak saklanır, sunucuya gönderilmez.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--adm-border-light)' }}>
              <button className="adm-btn adm-btn--ghost" onClick={() => { setPatModal(false); setPatInput(''); }}>İptal</button>
              <button className="adm-btn adm-btn--primary" onClick={confirmPat} disabled={!patInput.trim()}>
                <AIcon name="zap" size={15} /> Kaydet & Çalıştır
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Alt bileşen: Kelime satırı ────────────────────────────────────────────────
function KwRow({ kw, color, bg, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--adm-border-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 500, fontSize: 13 }}>{kw.keyword}</span>
        <span style={{ fontSize: 11, background: bg, color, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
          {kw.score} puan
        </span>
      </div>
      <button className="adm-icon-btn adm-icon-btn--danger" onClick={() => onDelete(kw.id)} title="Sil">
        <AIcon name="trash" size={13} />
      </button>
    </div>
  );
}

export { AutomationPage };
