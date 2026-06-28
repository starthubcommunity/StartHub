// app.jsx — Main App with routing, tweaks, and state management
import { useState as useStateApp, useEffect as useEffectApp, useCallback as useCallbackApp } from 'react';
import { LangProvider } from './data';
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

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [currentPage, setCurrentPage] = useStateApp(() => {
    const saved = sessionStorage.getItem('sh_page');
    return saved || 'home';
  });
  const [selectedId, setSelectedId] = useStateApp(() => {
    const s = sessionStorage.getItem('sh_id');
    return s ? (isNaN(+s) ? s : +s) : null;
  });
  const [lang, setLangState] = useStateApp(tweaks.language || 'tr');

  // Sync language with tweaks
  useEffectApp(() => {
    setLangState(tweaks.language);
  }, [tweaks.language]);

  // Save current page + selection
  useEffectApp(() => {
    sessionStorage.setItem('sh_page', currentPage);
    if (selectedId != null) sessionStorage.setItem('sh_id', String(selectedId));
    else sessionStorage.removeItem('sh_id');
  }, [currentPage, selectedId]);

  // Set direction data attribute
  useEffectApp(() => {
    document.body.parentElement.setAttribute('data-direction', tweaks.direction);
  }, [tweaks.direction]);

  // Set accent color
  useEffectApp(() => {
    document.documentElement.style.setProperty('--accent', tweaks.accentColor);
    // Compute hover color (darken)
    const hoverColors = {
      '#DC2626': '#B91C1C',
      '#2563EB': '#1D4ED8',
      '#7C3AED': '#6D28D9',
    };
    document.documentElement.style.setProperty('--accent-hover', hoverColors[tweaks.accentColor] || tweaks.accentColor);
    // Compute light color
    const lightColors = {
      '#DC2626': '#FEF2F2',
      '#2563EB': '#EFF6FF',
      '#7C3AED': '#F5F3FF',
    };
    document.documentElement.style.setProperty('--accent-light', lightColors[tweaks.accentColor] || '#FEF2F2');
  }, [tweaks.accentColor]);

  const setLang = useCallbackApp((l) => {
    setLangState(l);
    setTweak('language', l);
  }, [setTweak]);

  const navigate = useCallbackApp((page, id = null) => {
    setCurrentPage(page);
    setSelectedId(id);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'about': return <AboutPage navigate={navigate} />;
      case 'labs': return <LabsPage navigate={navigate} />;
      case 'blog': return <BlogPage navigate={navigate} />;
      case 'join': return <JoinPage navigate={navigate} projectId={selectedId} />;
      case 'project': return <ProjectDetailPage projectId={selectedId} navigate={navigate} />;
      case 'post': return <PostDetailPage postId={selectedId} navigate={navigate} />;
      default: return <HomePage navigate={navigate} />;
    }
  };

  return (
    <LangProvider lang={lang} setLang={setLang}>
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
    </LangProvider>
  );
}

export default App;
