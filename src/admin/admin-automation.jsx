// admin-automation.jsx — İçerik Otomasyonu kontrol paneli
// Pipeline: RSS Tarama → Filtre → Gemini Üretimi → Editöryel Takvim (taslak/onaylı/yayında) → Yayın
// Bu panel "kontrol yüzeyi"dir. Gerçek RSS çekme + Gemini çağrıları GitHub Actions
// backend'inde (automation/ klasörü) çalışır. Buradaki ayarlar o backend'i besler.
import React, { useState as useStateAU, useEffect as useEffectAU, useMemo as useMemoAU } from 'react';
import { useAdmin, uid } from './admin-store';
import { AIcon, Modal, Field, Input, Textarea, Select, PageHead, ConfirmDialog, TagInput } from './admin-ui';
import { supabase } from '../lib/supabase';

// ---- Sabit varsayılanlar (spec'ten) ----
const RSS_SOURCES_DEFAULT = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed', on: true },
  { name: 'VentureBeat', url: 'https://feeds.feedburner.com/venturebeat/SZYF', on: true },
  { name: 'The Next Web', url: 'https://thenextweb.com/feed', on: true },
  { name: 'Webrazzi', url: 'https://webrazzi.com/feed', on: true },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed', on: false },
];

const KEYWORDS_DEFAULT = ['startup', 'girişim', 'funding', 'AI', 'artificial intelligence', 'yapay zeka', 'tech', 'teknoloji', 'venture'];

const GEMINI_PROMPT_DEFAULT = `Sen Start-Hub için içerik üreten bir editörsün. Start-Hub, Türkiye'deki girişimcilere yönelik bir haber ve analiz platformudur.

Yazı üslubu:
- Samimi ama profesyonel
- Türk girişim ekosistemine bağlantı kurarak anlat
- Teknik terimleri Türkçeyle açıkla
- Başlık merak uyandırıcı olsun
- 400-600 kelime

Çıktı formatı (JSON olarak ver):
{
  "title": "Türkçe başlık",
  "slug": "url-uyumlu-baslik",
  "summary": "2 cümlelik özet",
  "content": "Tam makale metni (markdown)",
  "category": "AI/Girişim/Teknoloji/Yatırım",
  "source_url": "kaynak link",
  "source_name": "kaynak adı",
  "tags": ["tag1", "tag2"]
}`;

const TONE_LEVELS = [
  { level: 1, label: 'Resmi Haber',   desc: 'Nesnel, olgusal, abartısız haber dili' },
  { level: 2, label: 'Bilgilendirici', desc: 'Net ve anlaşılır, teknik terimleri açıklar' },
  { level: 3, label: 'Dengeli',        desc: 'Samimi ama profesyonel (varsayılan)' },
  { level: 4, label: 'Sıcak',          desc: 'Topluluk odaklı, ilham verici örnekler' },
  { level: 5, label: 'Coşkulu',        desc: 'Motivasyonel, enerjik, harekete geçirici' },
];

const CATEGORIES = ['AI', 'Girişim', 'Teknoloji', 'Yatırım'];

const QUEUE_STATUS = {
  draft:     { label: 'Taslak',      color: '#B45309', bg: '#FEF6E7' },
  approved:  { label: 'Onaylı',      color: 'var(--adm-blue)',  bg: 'var(--adm-blue-light)' },
  published: { label: 'Yayında',     color: 'var(--adm-green)', bg: 'var(--adm-green-light)' },
  rejected:  { label: 'Reddedildi',  color: 'var(--adm-red)',   bg: 'var(--adm-red-light)' },
};

// ---- Haber havuzu: backend'in RSS'ten çekip Gemini ile ürettiğini simüle eder ----
const NEWS_POOL = [
  {
    category: 'AI', slug: 'anthropic-yeni-claude-startup-etkisi',
    title_tr: 'Anthropic yeni nesil Claude modelini duyurdu — startup ekosistemi nasıl etkilenecek?',
    title_en: 'Anthropic announces next-gen Claude model — how will startups be affected?',
    excerpt_tr: 'Yeni model, erken aşama girişimler için güçlü otomasyon araçları sunuyor.',
    excerpt_en: 'The new model offers powerful automation tools for early-stage startups.',
    body_tr: ['Anthropic, Claude ailesinin en güçlü modelini duyurdu.', 'Yeni model, çok adımlı görevlerde otonom çalışabiliyor.', 'Erken aşama startup ekipleri için ürün geliştirme süresini ciddi biçimde kısaltabilir.'],
    body_en: ['Anthropic announced the most powerful model in the Claude family.', 'The new model can work autonomously on multi-step tasks.', 'It could significantly shorten product development time for early-stage startup teams.'],
    source: { name: 'TechCrunch', url: 'https://techcrunch.com/feed' },
    bg: 'var(--blue-light)',
  },
  {
    category: 'Girişim', slug: 'yc-2026-yazilim-trendleri',
    title_tr: 'Y Combinator 2026 yazılım trendleri raporunu yayınladı',
    title_en: 'Y Combinator publishes 2026 software trends report',
    excerpt_tr: "YC'nin yeni raporu, gelecek yılın en önemli startup trendlerini ortaya koyuyor.",
    excerpt_en: "YC's new report reveals the most important startup trends for the coming year.",
    body_tr: ["Y Combinator, portföyündeki 400+ startup'ın verilerini analiz ederek 2026 trendlerini çıkardı.", 'AI-native ürünler, dikey SaaS ve regülasyon-teknik çözümler öne çıkıyor.'],
    body_en: ['Y Combinator analyzed data from 400+ portfolio startups to identify 2026 trends.', 'AI-native products, vertical SaaS, and reg-tech solutions are leading.'],
    source: { name: 'VentureBeat', url: 'https://feeds.feedburner.com/venturebeat/SZYF' },
    bg: 'var(--orange-light)',
  },
  {
    category: 'Yatırım', slug: 'avrupa-startup-yatirimlari-arttı',
    title_tr: "Avrupa'da startup yatırımları %34 arttı — Türkiye nasıl konumlanıyor?",
    title_en: 'Startup investments in Europe rise 34% — where does Turkey stand?',
    excerpt_tr: 'Avrupa risk sermayesi piyasası toparlanırken Türk girişimciler için fırsatlar artıyor.',
    excerpt_en: 'As the European VC market recovers, opportunities for Turkish entrepreneurs are growing.',
    body_tr: ["2026'nın ilk çeyreğinde Avrupa'da startup yatırımları bir önceki yıla göre %34 arttı.", 'Türkiye, bölgedeki en hızlı büyüyen ekosistemlerden biri olarak öne çıkıyor.'],
    body_en: ['In Q1 2026, startup investments in Europe rose 34% year-over-year.', 'Turkey stands out as one of the fastest-growing ecosystems in the region.'],
    source: { name: 'The Next Web', url: 'https://thenextweb.com/feed' },
    bg: 'var(--green-light)',
  },
  {
    category: 'Girişim', slug: 'google-for-startups-ai-akseleratör',
    title_tr: 'Google for Startups yeni AI akseleratör programını açtı',
    title_en: 'Google for Startups launches new AI accelerator program',
    excerpt_tr: 'Program, AI odaklı erken aşama girişimlere mentorluk ve kredi desteği sunuyor.',
    excerpt_en: 'The program offers mentorship and credits to AI-focused early-stage startups.',
    body_tr: ["Google for Startups, yapay zeka odaklı startup'lar için yeni bir akseleratör programı başlattı.", 'Seçilen ekipler 100.000$ Google Cloud kredisi ve 12 haftalık mentorluk alacak.'],
    body_en: ['Google for Startups launched a new accelerator program for AI-focused startups.', 'Selected teams will receive $100K in Google Cloud credits and 12 weeks of mentorship.'],
    source: { name: 'Webrazzi', url: 'https://webrazzi.com/feed' },
    bg: 'var(--red-light)',
  },
  {
    category: 'Teknoloji', slug: 'notion-ai-otomatik-proje-yonetimi',
    title_tr: 'Notion, AI ile otomatik proje yönetimi özelliğini duyurdu',
    title_en: 'Notion announces AI-powered automatic project management',
    excerpt_tr: "Notion'ın yeni özelliği, startup ekipleri için proje takibini otomatikleştiriyor.",
    excerpt_en: "Notion's new feature automates project tracking for startup teams.",
    body_tr: ['Notion, AI destekli otomatik görev oluşturma ve önceliklendirme özelliğini tanıttı.', "Özellikle küçük ekiplerle çalışan startup'lar için zaman tasarrufu vaat ediyor."],
    body_en: ['Notion introduced AI-powered automatic task creation and prioritization.', 'It promises time savings especially for startups working with small teams.'],
    source: { name: 'TechCrunch', url: 'https://techcrunch.com/feed' },
    bg: 'var(--purple-light)',
  },
  {
    category: 'Yatırım', slug: 'microsoft-azure-ai-kredileri-3-kat',
    title_tr: "Microsoft, startup'lar için Azure AI kredilerini 3 katına çıkardı",
    title_en: 'Microsoft triples Azure AI credits for startups',
    excerpt_tr: 'Microsoft for Startups programı, AI geliştirme için bulut kredilerini artırıyor.',
    excerpt_en: 'Microsoft for Startups program increases cloud credits for AI development.',
    body_tr: ["Microsoft, startup programındaki Azure AI kredilerini 150.000$'a çıkardı.", 'Hedef, erken aşama girişimlerin AI altyapı maliyetlerini düşürmek.'],
    body_en: ['Microsoft increased Azure AI credits in its startup program to $150K.', 'The goal is to lower AI infrastructure costs for early-stage ventures.'],
    source: { name: 'VentureBeat', url: 'https://feeds.feedburner.com/venturebeat/SZYF' },
    bg: 'var(--blue-light)',
  },
];

// ---- localStorage yardımcıları ----
const lsGet = (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => { try { return new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }); } catch (e) { return d; } };

function AutomationPage() {
  const { addItem } = useAdmin();

  // Ayarlar
  const [settings, setSettings] = useStateAU(() => ({ enabled: false, runTime: '08:00', dailyLimit: 2, autoApprove: false, geminiModel: 'gemini-2.0-flash', ...lsGet('sh_auto_settings', {}) }));
  const [sources, setSources] = useStateAU(() => lsGet('sh_auto_sources', RSS_SOURCES_DEFAULT));
  const [keywords, setKeywords] = useStateAU(() => lsGet('sh_auto_keywords', KEYWORDS_DEFAULT));
  const [prompt, setPrompt] = useStateAU(() => lsGet('sh_auto_prompt', GEMINI_PROMPT_DEFAULT));
  // Editöryel takvim kuyruğu: { [poolIndex]: { status, date } }
  const [queue, setQueue] = useStateAU(() => {
    const q = lsGet('sh_auto_queue', null);
    if (q) return q;
    // Eski demodan göç: sh_auto_published kadarını "yayında" işaretle
    const old = parseInt(localStorage.getItem('sh_auto_published') || '0');
    const seed = {};
    for (let i = 0; i < old && i < NEWS_POOL.length; i++) seed[i] = { status: 'published', date: todayStr() };
    return seed;
  });

  // Ton seviyesi — Supabase site_settings tablosundan okunur/yazılır
  const [toneLevel, setToneLevel] = useStateAU(3);
  const [toneSaving, setToneSaving] = useStateAU(false);

  useEffectAU(() => {
    supabase.from('site_settings').select('tone_level').single()
      .then(({ data }) => { if (data?.tone_level) setToneLevel(data.tone_level); });
  }, []);

  const saveToneLevel = async (level) => {
    setToneLevel(level);
    setToneSaving(true);
    const { error } = await supabase
      .from('site_settings')
      .upsert({ id: 1, tone_level: level, updated_at: new Date().toISOString() });
    setToneSaving(false);
    if (error) flash('Ton seviyesi kaydedilemedi: ' + error.message, 'orange');
    else flash(`Ton seviyesi güncellendi: ${TONE_LEVELS[level - 1].label}`);
  };

  const [running, setRunning] = useStateAU(false);
  const [regenId, setRegenId] = useStateAU(null);
  const [toast, setToast] = useStateAU(null);
  const [preview, setPreview] = useStateAU(null);
  const [statusFilter, setStatusFilter] = useStateAU('all');
  const [showPrompt, setShowPrompt] = useStateAU(false);

  useEffectAU(() => lsSet('sh_auto_settings', settings), [settings]);
  useEffectAU(() => lsSet('sh_auto_sources', sources), [sources]);
  useEffectAU(() => lsSet('sh_auto_keywords', keywords), [keywords]);
  useEffectAU(() => lsSet('sh_auto_prompt', prompt), [prompt]);
  useEffectAU(() => lsSet('sh_auto_queue', queue), [queue]);

  const flash = (msg, kind = 'green') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 3200); };
  const setS = (k, v) => setSettings(p => ({ ...p, [k]: v }));

  // Kuyruk türetmeleri
  const entries = useMemoAU(() => Object.entries(queue).map(([i, v]) => ({ i: +i, ...v, art: NEWS_POOL[+i] })).filter(e => e.art), [queue]);
  const counts = useMemoAU(() => {
    const c = { draft: 0, approved: 0, published: 0, rejected: 0 };
    entries.forEach(e => { c[e.status] = (c[e.status] || 0) + 1; });
    return c;
  }, [entries]);
  const activeSources = sources.filter(s => s.on).length;
  const untouched = NEWS_POOL.map((_, i) => i).filter(i => !queue[i]);

  const filtered = entries
    .filter(e => statusFilter === 'all' ? true : e.status === statusFilter)
    .sort((a, b) => b.i - a.i);

  // ---- Eylemler ----
  const runPipeline = () => {
    if (running) return;
    if (untouched.length === 0) { flash('Havuzda işlenecek yeni kaynak kalmadı.', 'orange'); return; }
    setRunning(true);
    // Backend'in sabah çalışmasını simüle eder: tarama → filtre → Gemini → taslak
    setTimeout(() => {
      const batch = untouched.slice(0, settings.dailyLimit);
      const status = settings.autoApprove ? 'approved' : 'draft';
      setQueue(prev => {
        const next = { ...prev };
        batch.forEach(i => { next[i] = { status, date: todayStr() }; });
        return next;
      });
      setRunning(false);
      flash(`${batch.length} haber çekildi ve Gemini ile üretildi → ${settings.autoApprove ? 'otomatik onaylandı' : 'taslak olarak takvime eklendi'}.`);
    }, 1400);
  };

  const setStatus = (i, status) => setQueue(prev => ({ ...prev, [i]: { ...prev[i], status } }));

  // Backend'e (automation/run.py regenerate <slug>) yeniden üretim isteği gönderir.
  // Panel kontrol yüzeyi olduğundan burada çağrı simüle edilir; gerçek istek
  // GitHub Actions / backend endpoint'ine düşer.
  const regenerate = (i) => {
    if (regenId !== null) return;
    const art = NEWS_POOL[i];
    setRegenId(i);
    // POST /api/regenerate { slugs: [art.slug] }  →  backend: run.py regenerate <slug>
    setTimeout(() => {
      setQueue(prev => ({ ...prev, [i]: { ...prev[i], status: 'draft', date: todayStr(), regenAt: Date.now() } }));
      setRegenId(null);
      flash(`Yeniden üretildi: ${art.title_tr} — Gemini taslağı güncelledi.`);
    }, 1600);
  };

  const publish = (i) => {
    const art = NEWS_POOL[i];
    const newPost = {
      id: parseInt(uid()), tag: 'gundem', authorId: 'sude', projectId: null,
      date: todayStr(), readTime: 4, bg: art.bg, cover: null,
      title_tr: art.title_tr, title_en: art.title_en,
      excerpt_tr: art.excerpt_tr, excerpt_en: art.excerpt_en,
      body_tr: art.body_tr, body_en: art.body_en,
      source: art.source, recommended: false, homePinned: false,
    };
    addItem('posts', newPost);
    setStatus(i, 'published');
    flash(`Yayınlandı: ${art.title_tr}`);
  };

  return (
    <div>
      <PageHead title="İçerik Otomasyonu" desc="RSS tarama → filtre → Gemini üretimi → editöryel takvim → yayın"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="adm-badge" style={{ background: settings.enabled ? 'var(--adm-green-light)' : 'var(--adm-bg-hover)', color: settings.enabled ? 'var(--adm-green)' : 'var(--adm-text-dim)', padding: '5px 12px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: settings.enabled ? 'var(--adm-green)' : 'var(--adm-text-dim)' }}></span>
              {settings.enabled ? `Zamanlı — her gün ${settings.runTime}` : 'Zamanlama kapalı'}
            </span>
            <button className="adm-btn adm-btn--primary" onClick={runPipeline} disabled={running} style={{ opacity: running ? 0.6 : 1 }}>
              {running ? <><span className="adm-spinner"></span> Çalışıyor…</> : <><AIcon name="zap" size={16} /> Hattı Çalıştır</>}
            </button>
          </div>
        } />

      {/* Backend dürüstlük notu */}
      <div className="adm-note" style={{ background: 'var(--adm-blue-light)', color: 'var(--adm-blue)' }}>
        <AIcon name="settings" size={15} />
        <span>Bu panel kontrol yüzeyidir. Gerçek RSS çekme ve Gemini çağrıları <strong>GitHub Actions</strong> backend'inde (automation/ klasörü) çalışır — buradaki ayarlar o hattı besler. “Hattı Çalıştır” bir sabah çalışmasını simüle eder.</span>
      </div>

      {/* Pipeline stepper */}
      <div className="adm-card" style={{ marginBottom: 20 }}>
        <div className="adm-card__body">
          <div className="adm-auto-flow">
            {[
              { ic: 'globe', label: 'Kaynak Tarama', val: `${activeSources} aktif kaynak` },
              { ic: 'filter', label: 'Filtre', val: `${keywords.length} kelime` },
              { ic: 'zap', label: 'Gemini Üretimi', val: settings.geminiModel },
              { ic: 'check', label: 'Onay', val: `${counts.draft} bekliyor` },
              { ic: 'arrowUpRight', label: 'Yayın', val: `${counts.published} yayında` },
            ].map((s, idx, arr) => (
              <React.Fragment key={s.label}>
                <div className="adm-auto-flow__step">
                  <div className="adm-auto-flow__icon"><AIcon name={s.ic} size={18} /></div>
                  <div className="adm-auto-flow__label">{s.label}</div>
                  <div className="adm-auto-flow__val">{s.val}</div>
                </div>
                {idx < arr.length - 1 && <div className="adm-auto-flow__arrow"><AIcon name="chevronRight" size={16} /></div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {toast && (
        <div className="adm-auto-status" style={{ marginBottom: 20, background: toast.kind === 'orange' ? 'var(--adm-orange-light)' : 'var(--adm-green-light)', color: toast.kind === 'orange' ? 'var(--adm-orange)' : 'var(--adm-green)' }}>
          <AIcon name="check" size={14} /><span>{toast.msg}</span>
        </div>
      )}

      {/* Stat row */}
      <div className="adm-stats-grid" style={{ marginBottom: 20 }}>
        {[
          { v: counts.draft, l: 'Onay bekleyen taslak', ic: 'layers', c: '#B45309', bg: '#FEF6E7' },
          { v: counts.approved, l: 'Onaylı (yayın sırası)', ic: 'check', c: 'var(--adm-blue)', bg: 'var(--adm-blue-light)' },
          { v: counts.published, l: 'Yayınlanan', ic: 'arrowUpRight', c: 'var(--adm-green)', bg: 'var(--adm-green-light)' },
          { v: untouched.length, l: 'Havuzda bekleyen kaynak', ic: 'globe', c: 'var(--adm-purple)', bg: 'var(--adm-purple-light)' },
        ].map(s => (
          <div className="adm-stat" key={s.l}>
            <div className="adm-stat__icon" style={{ background: s.bg, color: s.c }}><AIcon name={s.ic} size={20} /></div>
            <div className="adm-stat__info"><div className="adm-stat__value">{s.v}</div><div className="adm-stat__label">{s.l}</div></div>
          </div>
        ))}
      </div>

      {/* Editöryel takvim / onay kuyruğu */}
      <div className="adm-card" style={{ marginBottom: 20 }}>
        <div className="adm-card__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3>Editöryel Takvim</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['all', 'Tümü'], ['draft', 'Taslak'], ['approved', 'Onaylı'], ['published', 'Yayında'], ['rejected', 'Reddedilen']].map(([k, lbl]) => (
              <button key={k} className={`adm-chip ${statusFilter === k ? 'adm-chip--active' : ''}`} style={{ padding: '5px 12px', fontSize: 12.5 }} onClick={() => setStatusFilter(k)}>{lbl}</button>
            ))}
          </div>
        </div>
        <div className="adm-card__body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div className="adm-empty">
              <AIcon name="calendar" size={40} style={{ opacity: 0.25 }} />
              <p>{entries.length === 0 ? 'Henüz haber işlenmedi. “Hattı Çalıştır” ile başla.' : 'Bu durumda kayıt yok.'}</p>
            </div>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr><th>Başlık</th><th>Kategori</th><th>Tarih</th><th>Kaynak</th><th>Durum</th><th style={{ textAlign: 'right' }}>İşlem</th></tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const st = QUEUE_STATUS[e.status];
                    return (
                      <tr key={e.i}>
                        <td style={{ maxWidth: 340 }}>
                          <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{e.art.title_tr}</div>
                          <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', fontFamily: 'var(--font-body)' }}>/{e.art.slug}.json</div>
                        </td>
                        <td><span className="adm-badge adm-badge--tag">{e.art.category}</span></td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--adm-text-secondary)' }}>{fmtDate(e.date)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--adm-text-secondary)' }}><AIcon name="globe" size={13} /> {e.art.source.name}</span></td>
                        <td><span className="adm-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                        <td>
                          <div className="adm-table__actions" style={{ justifyContent: 'flex-end' }}>
                            <button className="adm-icon-btn" title="Önizle" onClick={() => setPreview(e.i)}><AIcon name="eye" size={15} /></button>
                            {e.status === 'draft' && <>
                              <button className="adm-btn adm-btn--ghost adm-btn--sm" title="Gemini ile yeniden üret" onClick={() => regenerate(e.i)} disabled={regenId !== null} style={{ opacity: regenId !== null && regenId !== e.i ? 0.5 : 1 }}>
                                {regenId === e.i ? <><span className="adm-spinner"></span> Üretiliyor…</> : <><AIcon name="restore" size={14} /> Yeniden Üret</>}
                              </button>
                              <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setStatus(e.i, 'approved')}><AIcon name="check" size={14} /> Onayla</button>
                              <button className="adm-icon-btn adm-icon-btn--danger" title="Reddet" onClick={() => setStatus(e.i, 'rejected')}><AIcon name="x" size={15} /></button>
                            </>}
                            {e.status === 'approved' && <>
                              <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => publish(e.i)}><AIcon name="zap" size={14} /> Yayınla</button>
                              <button className="adm-icon-btn" title="Taslağa al" onClick={() => setStatus(e.i, 'draft')}><AIcon name="restore" size={15} /></button>
                            </>}
                            {(e.status === 'published' || e.status === 'rejected') && (
                              <button className="adm-icon-btn" title="Geri al" onClick={() => setStatus(e.i, e.status === 'published' ? 'approved' : 'draft')}><AIcon name="restore" size={15} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {counts.approved > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid var(--adm-border-light)' }}>
              <button className="adm-btn adm-btn--primary" onClick={() => { entries.filter(e => e.status === 'approved').forEach(e => publish(e.i)); }}>
                <AIcon name="zap" size={16} /> Onaylananları yayınla ({counts.approved})
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="adm-grid-2">
        {/* Zamanlama & Ayarlar */}
        <div className="adm-card">
          <div className="adm-card__header"><h3>Zamanlama & Ayarlar</h3></div>
          <div className="adm-card__body">
            <div className="adm-pin-box">
              <div className="adm-pin-row">
                <div>
                  <div className="adm-pin-row__title"><AIcon name="clock" size={14} /> Zamanlı Çalışma</div>
                  <div className="adm-pin-row__sub">GitHub Actions her gün belirlenen saatte hattı çalıştırır</div>
                </div>
                <label className="adm-switch"><input type="checkbox" checked={settings.enabled} onChange={e => setS('enabled', e.target.checked)} /><span></span></label>
              </div>
              <div className="adm-pin-row">
                <div>
                  <div className="adm-pin-row__title"><AIcon name="check" size={14} /> Otomatik Onay</div>
                  <div className="adm-pin-row__sub">Üretilen taslaklar editör onayı beklemeden “onaylı”ya geçer</div>
                </div>
                <label className="adm-switch"><input type="checkbox" checked={settings.autoApprove} onChange={e => setS('autoApprove', e.target.checked)} /><span></span></label>
              </div>
            </div>
            <div className="adm-form-grid" style={{ marginTop: 14 }}>
              <Field label="Çalışma Saati"><Input type="time" value={settings.runTime} onChange={v => setS('runTime', v)} /></Field>
              <Field label="Günlük Limit" hint="Her çalışmada üretilecek max haber"><Input type="number" value={String(settings.dailyLimit)} onChange={v => setS('dailyLimit', Math.max(1, parseInt(v) || 1))} /></Field>
            </div>
            <Field label="Gemini Modeli">
              <Select value={settings.geminiModel} onChange={v => setS('geminiModel', v)} options={[
                { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash (hızlı, ücretsiz tier)' },
                { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
                { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
              ]} />
            </Field>
          </div>
        </div>

        {/* RSS Kaynakları */}
        <div className="adm-card">
          <div className="adm-card__header"><h3>RSS Kaynakları</h3></div>
          <div className="adm-card__body" style={{ padding: 0 }}>
            {sources.map((s, idx) => (
              <div key={idx} className="adm-pin-row" style={{ borderTop: idx ? '1px solid var(--adm-border-light)' : 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="adm-pin-row__title">{s.name}</div>
                  <div className="adm-pin-row__sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</div>
                </div>
                <label className="adm-switch"><input type="checkbox" checked={s.on} onChange={e => setSources(prev => prev.map((x, i) => i === idx ? { ...x, on: e.target.checked } : x))} /><span></span></label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filtre kelimeleri */}
      <div className="adm-card" style={{ marginTop: 20 }}>
        <div className="adm-card__header"><h3>Filtre Kelimeleri</h3></div>
        <div className="adm-card__body">
          <p style={{ fontSize: 13, color: 'var(--adm-text-dim)', margin: '0 0 12px' }}>Başlık veya özette bu kelimelerden biri geçen haberler işlenir. Enter ile ekle.</p>
          <TagInput tags={keywords} onChange={setKeywords} />
        </div>
      </div>

      {/* Yazı Tonu */}
      <div className="adm-card" style={{ marginTop: 20 }}>
        <div className="adm-card__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3>Yazı Tonu</h3>
          {toneSaving && <span style={{ fontSize: 12, color: 'var(--adm-text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}><span className="adm-spinner"></span> Kaydediliyor…</span>}
        </div>
        <div className="adm-card__body">
          <p style={{ fontSize: 13, color: 'var(--adm-text-dim)', margin: '0 0 16px' }}>
            Gemini'nin ürettiği haberlerde kullanacağı üslup. Seçim Supabase'e kaydedilir ve otomasyon bir sonraki çalışmasında bu tonu kullanır.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {TONE_LEVELS.map(({ level, label, desc }) => {
              const active = toneLevel === level;
              return (
                <button
                  key={level}
                  onClick={() => saveToneLevel(level)}
                  style={{
                    flex: '1 1 140px',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `2px solid ${active ? 'var(--adm-blue)' : 'var(--adm-border-light)'}`,
                    background: active ? 'var(--adm-blue-light)' : 'var(--adm-bg)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: active ? 'var(--adm-blue)' : 'var(--adm-border)',
                      color: active ? '#fff' : 'var(--adm-text-dim)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                    }}>{level}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: active ? 'var(--adm-blue)' : 'var(--adm-text)' }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', lineHeight: 1.4 }}>{desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gemini sistem promptu */}
      <div className="adm-card" style={{ marginTop: 20 }}>
        <div className="adm-card__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setShowPrompt(p => !p)}>
          <h3>Gemini Sistem Promptu</h3>
          <AIcon name="chevronDown" size={16} style={{ transform: showPrompt ? 'rotate(180deg)' : 'none', transition: '0.2s', color: 'var(--adm-text-dim)' }} />
        </div>
        {showPrompt && (
          <div className="adm-card__body">
            <p style={{ fontSize: 13, color: 'var(--adm-text-dim)', margin: '0 0 12px' }}>Backend her haber için bu promptu Gemini'ye gönderir. JSON çıktı formatını koru.</p>
            <textarea className="adm-input adm-textarea" style={{ minHeight: 280, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, lineHeight: 1.6 }} value={prompt} onChange={e => setPrompt(e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setPrompt(GEMINI_PROMPT_DEFAULT)}><AIcon name="refresh" size={14} /> Varsayılana dön</button>
            </div>
          </div>
        )}
      </div>

      {/* Önizleme modal */}
      {preview != null && (() => {
        const art = NEWS_POOL[preview];
        return (
          <Modal open onClose={() => setPreview(null)} title="Taslak Önizleme" wide>
            <div className="adm-pv-article">
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <span className="adm-badge adm-badge--tag">{art.category}</span>
                <span className="adm-badge" style={{ background: 'var(--adm-blue-light)', color: 'var(--adm-blue)' }}><AIcon name="globe" size={12} /> {art.source.name}</span>
              </div>
              <div className="adm-pv-article__title">{art.title_tr}</div>
              <div className="adm-pv-article__lead">{art.excerpt_tr}</div>
              <div className="adm-pv-article__body">
                {art.body_tr.map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <div className="adm-pv-article__src">Kaynak: {art.source.name} · /posts/{art.slug}.json</div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

export { AutomationPage, NEWS_POOL };
