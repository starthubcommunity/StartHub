// app.jsx — Main App with routing, tweaks, and state management
import { useState as useStateApp, useEffect as useEffectApp, useCallback as useCallbackApp, useRef as useRefApp } from 'react';
import { LangProvider, usePosts, getPostBySlug, getPostSlug, getPost, getStartupSlug, useSiteSettings } from './data';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor } from './tweaks-panel';
import { Navbar, Footer } from './layout';
import { HomePage } from './home-page';
import { AboutPage, LabsPage } from './about-labs';
import { BlogPage, JoinPage } from './other-pages';
import { ProjectDetailPage, PostDetailPage } from './detail-pages';

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
const SIMPLE_PAGES = ['about', 'labs', 'blog', 'join'];

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

function pathFor(page, id) {
  if (!page || page === 'home') return '/';
  if (page === 'post' && id != null) {
    const slug = getPostSlug(id);
    return slug ? `/blog/${slug}` : `/blog/${id}`;
  }
  if (page === 'project' && id != null) {
    const slug = getStartupSlug(id);
    return slug ? `/labs/${slug}` : `/labs/${id}`;
  }
  return `/${page}`;
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

// ─── Initial state from sessionStorage → URL fallback ─────────────────────
function initFromStorage() {
  migrateLegacyHash();
  const saved = sessionStorage.getItem('sh_page');
  const savedId = sessionStorage.getItem('sh_id');
  if (saved) {
    const id = savedId ? (isNaN(+savedId) ? savedId : +savedId) : null;
    return { page: saved, id, pendingSlug: null };
  }
  const { page, param } = parsePath(window.location.pathname);
  if (page === 'post') return { page: 'home', id: null, pendingSlug: param };
  if (page === 'project') {
    const id = Number(param) || param;
    return { page, id, pendingSlug: null };
  }
  return { page, id: null, pendingSlug: null };
}

function App() {
  const { posts } = usePosts();
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

  // Dynamic document.title
  useEffectApp(() => {
    const post = (currentPage === 'post' && selectedId) ? getPost(selectedId) : null;
    const postTitle = post ? (lang === 'tr' ? post.title_tr : post.title_en) || post.title_tr : null;
    const titles = {
      home:    'Start-Hub — Türkiye Girişim Ekosistemi',
      about:   'Hakkımızda | Start-Hub',
      labs:    'Start-Hub Labs | Projeler ve Ekipler',
      blog:    'Yazılar | Start-Hub',
      join:    'Topluluğa Katıl | Start-Hub',
      post:    postTitle ? `${postTitle} | Start-Hub` : 'Start-Hub',
      project: 'Lab | Start-Hub',
    };
    document.title = titles[currentPage] || 'Start-Hub';
  }, [currentPage, selectedId, lang]);

  // Set direction data attribute
  useEffectApp(() => {
    document.body.parentElement.setAttribute('data-direction', tweaks.direction);
  }, [tweaks.direction]);

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
