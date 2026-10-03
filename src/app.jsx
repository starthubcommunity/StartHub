// app.jsx — Main App with routing, tweaks, and state management
import { useState as useStateApp, useEffect as useEffectApp, useCallback as useCallbackApp, useRef as useRefApp } from 'react';
import { LangProvider, usePosts, useStartups, getPostBySlug, getPostSlug, getPost, useSiteSettings, people } from './data';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor } from './tweaks-panel';
import { Navbar, Footer } from './layout';
import { HomePage } from './home-page';
import { AboutPage, LabsPage } from './about-labs';
import { BlogPage, JoinPage } from './other-pages';
import { ProjectDetailPage, PostDetailPage } from './detail-pages';
import { setSEO, setOrganizationSchema, setArticleSchema, setFAQSchema, SITE_NAME, SITE_URL } from './lib/seo';
import { pathFor } from './lib/routes';
import { initGA, trackPageView } from './lib/analytics';
import { STATIC_SEO, SIMPLE_PAGES } from './lib/seo-content';
import { FAQ_ITEMS } from './lib/faq-content';

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "direction": "minimal",
  "language": "tr",
  "accentColor": "#DC2626"
}/*EDITMODE-END*/;

// ─── History API routing helpers ───────────────────────────────────────────
// 2026-09-29 (SEO Aşama 1): eskiden window.location.hash (#/post/x) ile
// çalışıyordu — arama motorları/AI tarayıcılar hash parçasını görmez, tüm
// sayfalar tek bir URL (/) gibi indekslenirdi. Artık gerçek path'ler:
// /, /about, /labs, /labs/:slug, /blog, /blog/:slug, /join — History API
// (pushState/popstate). Eski hash linkleri initFromStorage'daki
// migrateLegacyHash() ile bir kerelik history.replaceState'e taşınır.
function parsePath(pathname) {
  const raw = String(pathname || '/').replace(/^\/|\/$/g, '');
  if (!raw) return { page: 'home', param: null };
  const slash = raw.indexOf('/');
  const seg   = slash === -1 ? raw : raw.slice(0, slash);
  const param = slash === -1 ? null : (raw.slice(slash + 1) || null);
  if (!seg || seg === 'home')      return { page: 'home', param: null };
  if (seg === 'blog' && param)     return { page: 'post',    param };
  if (seg === 'labs' && param)     return { page: 'project', param };
  if (SIMPLE_PAGES.includes(seg))  return { page: seg, param: null };
  return { page: 'home', param: null };
}


// Eski hash biçimindeki bir link/yer imiyle gelindiyse (#/post/x, #/about,
// #/ vb.) adres çubuğunu YENİ path'e taşır (history.replaceState — geri
// tuşuna yeni bir kayıt eklemez) ve hash'i temizler. Sayfa yenilenmeden
// gelen doğrudan URL'lerde (arama motoru, paylaşılan link, yer imi) çalışır.
function migrateLegacyHash() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#/')) return;
  const raw = hash.replace(/^#\/?/, '');
  const slash = raw.indexOf('/');
  const seg   = slash === -1 ? raw : raw.slice(0, slash);
  const param = slash === -1 ? null : (raw.slice(slash + 1) || null);
  let path = '/';
  if (seg === 'post' && param)         path = `/blog/${param}`;
  else if (seg === 'project' && param) path = `/labs/${param}`;
  else if (SIMPLE_PAGES.includes(seg)) path = `/${seg}`;
  window.history.replaceState(null, '', path + window.location.search);
}

// ─── Initial state: gerçek URL → yalnızca kökte sessionStorage ────────────
// 2026-09-29 düzeltmesi (SEO/GEO): eskiden sessionStorage HER ZAMAN URL'den
// önce kontrol ediliyordu — aynı sekmede önce başka bir sayfa gezilip SONRA
// adres çubuğuna elle farklı bir path yazılırsa (gerçek tam sayfa
// navigasyonu), eski önbelleklenmiş sayfa yanlışlıkla geri geliyordu (CDP
// ile doğrulandı, "Aşama 2" notunda kullanıcıya bildirilmişti). Artık: URL
// zaten '/' dışında belirli bir sayfaya işaret ediyorsa HER ZAMAN o kullanılır
// — sessionStorage yalnızca çıplak kök ('/') yüklemesinde "kaldığın yerden
// devam et" için devrede. Bir crawler/ilk ziyaretçi zaten sessionStorage
// taşımadığından onlar için davranış hiç değişmedi.
function initFromStorage() {
  migrateLegacyHash();
  const { page, param } = parsePath(window.location.pathname);

  if (window.location.pathname !== '/') {
    if (page === 'post') return { page: 'home', id: null, pendingSlug: param };
    if (page === 'project') {
      const id = Number(param) || param;
      return { page, id, pendingSlug: null };
    }
    return { page, id: null, pendingSlug: null };
  }

  const saved = sessionStorage.getItem('sh_page');
  const savedId = sessionStorage.getItem('sh_id');
  if (saved) {
    const id = savedId ? (isNaN(+savedId) ? savedId : +savedId) : null;
    return { page: saved, id, pendingSlug: null };
  }
  return { page: 'home', id: null, pendingSlug: null };
}

function App() {
  const { posts } = usePosts();
  const { startups, contentLoading } = useStartups();
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const init = initFromStorage;
  const [currentPage, setCurrentPage] = useStateApp(() => init().page);
  const [selectedId,  setSelectedId]  = useStateApp(() => init().id);
  const [pendingSlug, setPendingSlug] = useStateApp(() => init().pendingSlug);
  const [lang, setLangState] = useStateApp(tweaks.language || 'tr');

  // Resolve pending slug once posts are loaded
  useEffectApp(() => {
    if (!pendingSlug || !posts.length) return;
    const post = posts.find(p => p.slug === pendingSlug);
    if (post) {
      setCurrentPage('post');
      setSelectedId(post.id);
      setPendingSlug(null);
    }
  }, [posts, pendingSlug]);

  // popstate → yalnızca gerçek geri/ileri tuşu (pushState kendi başına
  // tetiklemez, bu yüzden navigate()'in kendi yazdığı geçişi es geçme
  // hilesine — eski skipHash deseni — artık gerek yok).
  useEffectApp(() => {
    const onPopState = () => {
      const { page, param } = parsePath(window.location.pathname);
      if (page === 'post' && param) {
        const post = posts.find(p => p.slug === param);
        if (post) { setCurrentPage('post'); setSelectedId(post.id); }
        else { setPendingSlug(param); setCurrentPage('home'); setSelectedId(null); }
      } else if (page === 'project' && param) {
        setCurrentPage('project');
        setSelectedId(Number(param) || param);
      } else {
        setCurrentPage(page);
        setSelectedId(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [posts]);

  // Sync language with tweaks
  useEffectApp(() => { setLangState(tweaks.language); }, [tweaks.language]);

  // Save current page + selection to sessionStorage (URL itself already
  // reflects the page — bkz. navigate() — bu yalnızca aynı sekme içindeki
  // hızlı state kurtarma için).
  useEffectApp(() => {
    sessionStorage.setItem('sh_page', currentPage);
    if (selectedId != null) sessionStorage.setItem('sh_id', String(selectedId));
    else sessionStorage.removeItem('sh_id');
  }, [currentPage, selectedId]);

  // Organization JSON-LD — her sayfada sabit kimlik sinyali (yalnızca
  // ana sayfada değil: GEO'da bir tarayıcı doğrudan bir yazıya/projeye
  // gelebilir, o sayfada da "bu site Start-Hub'a ait" bilgisi bulunsun).
  useEffectApp(() => {
    setOrganizationSchema({ description: STATIC_SEO.home[lang].desc });
  }, [lang]);

  // Sayfa bazlı SEO metadata (SEO Aşama 2) — title/description/canonical/
  // og:*/twitter:* hepsi burada, tek yerden, her sayfa geçişinde (React
  // navigasyonu dahil — sayfa yenilemeye gerek yok, bkz. src/lib/seo.js).
  useEffectApp(() => {
    const path = pathFor(currentPage, selectedId);

    if (currentPage === 'post' && selectedId) {
      const post = getPost(selectedId);
      const postTitle = post ? ((lang === 'tr' ? post.title_tr : post.title_en) || post.title_tr) : null;
      const postDesc = post ? ((lang === 'tr' ? post.excerpt_tr : post.excerpt_en) || post.excerpt_tr) : null;
      setSEO({
        title: postTitle ? `${postTitle} | Start-Hub` : 'Start-Hub',
        description: postDesc || STATIC_SEO.blog[lang].desc,
        path,
        image: post?.cover || null,
        imageAlt: postTitle || null,
        // posts.length > 0 → veri zaten geldi, gerçekten yok demektir
        // (yalnızca yüklenirken geçici null değil — bkz. yukarıdaki not).
        // posts.is_indexable=false → arama motorundan gizli (bkz. prerender.mjs).
        noindex: (!post && posts.length > 0) || post?.isIndexable === false,
      });
      // Article schema yalnızca gerçek bir yazı bulunduğunda; sayfadan
      // ayrılınca (post null) bir sonraki dal zaten setArticleSchema(null)
      // çağırıyor (aşağıdaki genel temizleme).
      if (post) {
        const author = people.find(p => p.id === post.authorId);
        const authorName = author?.name || post.guestAuthor?.name || SITE_NAME;
        setArticleSchema({
          headline: postTitle,
          description: postDesc || STATIC_SEO.blog[lang].desc,
          image: post.cover || undefined,
          datePublished: post.date || undefined,
          author: { '@type': 'Person', name: authorName },
          mainEntityOfPage: `${SITE_URL}${path}`,
        });
      } else {
        setArticleSchema(null);
      }
      return;
    }
    setArticleSchema(null);
    setFAQSchema(currentPage === 'about' ? FAQ_ITEMS.map(item => ({ question: item.q[lang] || item.q.tr, answer: item.a[lang] || item.a.tr })) : null);

    if (currentPage === 'project' && selectedId) {
      const project = startups.find(s => s.id === selectedId || s.slug === selectedId);
      const projName = project?.name || null;
      const projDesc = project
        ? ((lang === 'tr' ? project.desc_tr : project.desc_en) || project.desc_tr
          || (lang === 'tr' ? project.tagline_tr : project.tagline_en) || project.tagline_tr)
        : null;
      // Opsiyonel özel <title> (startups.seo_title_tr/en) — doluysa anahtar
      // kelime zengin özel başlığı kullan, boşsa otomatik desene düş.
      const projSeoTitle = project ? ((lang === 'tr' ? project.seoTitle_tr : project.seoTitle_en) || project.seoTitle_tr) : null;
      setSEO({
        title: projSeoTitle || (projName ? `${projName} | Start-Hub Lab` : 'Lab | Start-Hub'),
        description: projDesc || STATIC_SEO.labs[lang].desc,
        path,
        image: project?.logo || null,
        imageAlt: projName || null,
        // startups DEMO tohum verisiyle başlar (data.jsx) — length>0 her zaman
        // gerçek veri geldi demek değil, contentLoading false olmalı.
        noindex: !project && !contentLoading,
      });
      return;
    }

    const s = STATIC_SEO[currentPage] || STATIC_SEO.home;
    setSEO({ title: s[lang].title, description: s[lang].desc, path });
  }, [currentPage, selectedId, lang, startups, contentLoading, posts]);

  // GA4 — her sayfa geçişinde (ilk yükleme dahil) tek page_view. Ölçüm kimliği
  // yoksa veya production dışındaysa analytics.js hiçbir şey yapmaz.
  useEffectApp(() => {
    initGA();
    trackPageView(pathFor(currentPage, selectedId));
  }, [currentPage, selectedId]);

  // Set direction data attribute
  useEffectApp(() => {
    document.body.parentElement.setAttribute('data-direction', tweaks.direction);
  }, [tweaks.direction]);

  // <html lang="tr|en"> — SEO/erişilebilirlik sinyali, gösterilen dille
  // eşleşsin diye (index.html'de statik "tr" yazıyordu, EN'e geçilince
  // hiç güncellenmiyordu).
  useEffectApp(() => {
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'tr');
  }, [lang]);

  // Set accent color
  useEffectApp(() => {
    document.documentElement.style.setProperty('--accent', tweaks.accentColor);
    const hoverColors = { '#DC2626': '#B91C1C', '#2563EB': '#1D4ED8', '#7C3AED': '#6D28D9' };
    document.documentElement.style.setProperty('--accent-hover', hoverColors[tweaks.accentColor] || tweaks.accentColor);
    const lightColors = { '#DC2626': '#FEF2F2', '#2563EB': '#EFF6FF', '#7C3AED': '#F5F3FF' };
    document.documentElement.style.setProperty('--accent-light', lightColors[tweaks.accentColor] || '#FEF2F2');
  }, [tweaks.accentColor]);

  const setLang = useCallbackApp((l) => {
    setLangState(l);
    setTweak('language', l);
  }, [setTweak]);

  const navigate = useCallbackApp((page, id = null) => {
    setCurrentPage(page);
    setSelectedId(id);
    // pushState hiçbir olay TETİKLEMEZ (yalnızca gerçek geri/ileri popstate
    // fırlatır) — eski skipHash "kendi yazdığımı yok say" hilesine gerek yok.
    const newPath = pathFor(page, id);
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  }, []);

  const renderPage = () => {
    if (pendingSlug) {
      // Waiting for posts to load to resolve slug → show loading briefly
      return null;
    }
    switch (currentPage) {
      case 'about':   return <AboutPage navigate={navigate} />;
      case 'labs':    return <LabsPage navigate={navigate} />;
      case 'blog':    return <BlogPage navigate={navigate} />;
      case 'join':    return <JoinPage navigate={navigate} projectId={selectedId} />;
      case 'project': return <ProjectDetailPage projectId={selectedId} navigate={navigate} />;
      case 'post':    return <PostDetailPage postId={selectedId} navigate={navigate} />;
      default:        return <HomePage navigate={navigate} />;
    }
  };

  return (
    <LangProvider lang={lang} setLang={setLang}>
      <AppShell lang={lang} currentPage={currentPage} selectedId={selectedId} navigate={navigate} renderPage={renderPage} tweaks={tweaks} setTweak={setTweak} />
    </LangProvider>
  );
}

// Duyuru bandı — sabit üstte durur, navbar'ı ve sayfa içeriğini gerçek
// yüksekliği kadar aşağı iter (--announce-h), kapatılabilir (oturum bazlı,
// aynı metin bir daha gösterilmez ama yeni bir duyuru her zaman görünür).
function AnnouncementBar({ lang, active, text }) {
  const STORAGE_KEY = 'sh_announce_dismissed';
  const [dismissedText, setDismissedText] = useStateApp(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
  });
  const ref = useRefApp(null);
  const visible = active && !!text && text !== dismissedText;

  useEffectApp(() => {
    const setH = () => {
      document.documentElement.style.setProperty('--announce-h', visible && ref.current ? `${ref.current.offsetHeight}px` : '0px');
    };
    setH();
    window.addEventListener('resize', setH);
    return () => window.removeEventListener('resize', setH);
  }, [visible, text]);

  useEffectApp(() => () => { document.documentElement.style.setProperty('--announce-h', '0px'); }, []);

  if (!visible) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(STORAGE_KEY, text); } catch {}
    setDismissedText(text);
  };

  return (
    <div className="announce-bar" ref={ref}>
      <div className="container announce-bar__inner">
        <span className="announce-bar__badge">
          <span className="announce-bar__dot" />
          {lang === 'tr' ? 'Duyuru' : 'News'}
        </span>
        <span className="announce-bar__text">{text}</span>
        <button className="announce-bar__close" onClick={dismiss} aria-label={lang === 'tr' ? 'Kapat' : 'Dismiss'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

function AppShell({ lang, currentPage, selectedId, navigate, renderPage, tweaks, setTweak }) {
  const settings = useSiteSettings();

  if (settings.maintenance_mode) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 48 }}>🔧</div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 800 }}>
          {lang === 'tr' ? 'Site Bakımda' : 'Site Under Maintenance'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>
          {lang === 'tr'
            ? 'Sitemiz şu an bakım çalışması nedeniyle geçici olarak kapalıdır. Kısa süre içinde geri döneceğiz.'
            : 'Our site is temporarily down for maintenance. We\'ll be back shortly.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <AnnouncementBar lang={lang} active={settings.announcement_active} text={settings.announcement_text} />
      <Navbar currentPage={currentPage} navigate={navigate} />
      <main key={currentPage + ':' + selectedId}>
        {renderPage()}
      </main>
      <Footer navigate={navigate} />

      <TweaksPanel>
        <TweakSection label="Design Direction" />
        <TweakRadio
          label={lang === 'tr' ? 'Tasarım Yönü' : 'Style'}
          value={tweaks.direction}
          options={['minimal', 'dynamic']}
          onChange={(v) => setTweak('direction', v)}
        />
        <TweakColor
          label={lang === 'tr' ? 'Vurgu Rengi' : 'Accent Color'}
          value={tweaks.accentColor}
          options={['#DC2626', '#2563EB', '#7C3AED']}
          onChange={(v) => setTweak('accentColor', v)}
        />
        <TweakSection label={lang === 'tr' ? 'Dil' : 'Language'} />
        <TweakRadio
          label={lang === 'tr' ? 'Dil' : 'Language'}
          value={tweaks.language}
          options={['tr', 'en']}
          onChange={(v) => setTweak('language', v)}
        />
      </TweaksPanel>
    </>
  );
}

export default App;
