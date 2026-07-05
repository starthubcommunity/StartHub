// app.jsx — Main App with routing, tweaks, and state management
import { useState as useStateApp, useEffect as useEffectApp, useCallback as useCallbackApp, useRef as useRefApp } from 'react';
import { LangProvider, usePosts, getPostBySlug, getPostSlug, getPost, useSiteSettings } from './data';
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

// ─── Hash routing helpers ──────────────────────────────────────────────────
const SIMPLE_PAGES = ['about', 'labs', 'blog', 'join'];

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (!raw) return { page: 'home', param: null };
  const slash = raw.indexOf('/');
  const seg   = slash === -1 ? raw : raw.slice(0, slash);
  const param = slash === -1 ? null : (raw.slice(slash + 1) || null);
  if (!seg || seg === 'home')             return { page: 'home',    param: null };
  if (SIMPLE_PAGES.includes(seg))         return { page: seg,       param: null };
  if (seg === 'post'    && param)         return { page: 'post',    param };
  if (seg === 'project' && param)         return { page: 'project', param };
  return { page: 'home', param: null };
}

function hashFor(page, id) {
  if (!page || page === 'home') return '#/';
  if (page === 'post' && id != null) {
    const slug = getPostSlug(id);
    return slug ? `#/post/${slug}` : `#/post/${id}`;
  }
  if (page === 'project' && id != null) return `#/project/${id}`;
  return `#/${page}`;
}

// ─── Initial state from sessionStorage → hash fallback ────────────────────
function initFromStorage() {
  const saved = sessionStorage.getItem('sh_page');
  const savedId = sessionStorage.getItem('sh_id');
  if (saved) {
    const id = savedId ? (isNaN(+savedId) ? savedId : +savedId) : null;
    return { page: saved, id, pendingSlug: null };
  }
  const { page, param } = parseHash();
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

  // Track ONE programmatic hash change so hashchange listener skips it
  const skipHash = useRefApp(null);

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

  // hashchange → browser back/forward navigation
  useEffectApp(() => {
    const onHashChange = () => {
      // If this is a hash we just set programmatically, skip once and clear
      if (skipHash.current !== null && window.location.hash === skipHash.current) {
        skipHash.current = null;
        return;
      }
      skipHash.current = null;
      const { page, param } = parseHash();
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
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [posts]);

  // Sync language with tweaks
  useEffectApp(() => { setLangState(tweaks.language); }, [tweaks.language]);

  // Save current page + selection to sessionStorage, update hash
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
    // Update hash (track it so hashchange listener ignores)
    const newHash = hashFor(page, id);
    if (window.location.hash !== newHash) {
      skipHash.current = newHash;
      window.location.hash = newHash;
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
      <AppShell lang={lang} currentPage={currentPage} selectedId={selectedId} navigate={navigate} renderPage={renderPage} />
    </LangProvider>
  );
}

function AppShell({ lang, currentPage, selectedId, navigate, renderPage }) {
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
      {settings.announcement_active && settings.announcement_text && (
        <div style={{ background: '#DC2626', color: '#fff', textAlign: 'center', padding: '10px 16px', fontSize: 14, fontWeight: 500, position: 'relative', zIndex: 200 }}>
          {settings.announcement_text}
        </div>
      )}
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
