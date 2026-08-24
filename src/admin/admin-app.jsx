// admin-app.jsx — App shell, sidebar, routing
import React from 'react';
import { useState as useStateA, useEffect as useEffectA } from 'react';
import { AdminProvider, useAdmin } from './admin-store';
import { AIcon } from './admin-ui';
import { DashboardPage, ProjectsPage } from './admin-pages';
import { ContentPage } from './admin-pages3';
import { AutomationPage } from './admin-automation';
import { AnalyticsPage } from './admin-analytics';
import { PeoplePage, SponsorsPage, TrashPage } from './admin-pages2';
import { ApplicationsPage } from './admin-applications';
import { SettingsPage } from './admin-settings';
import { supabase, setRememberMe } from '../lib/supabase';

// ─── LOGIN PAGE ───────────────────────────────────────────────────────
function LoginPage() {
  const [email, setEmail]       = useStateA('');
  const [password, setPassword] = useStateA('');
  const [error, setError]       = useStateA('');
  const [loading, setLoading]   = useStateA(false);
  const [remember, setRemember] = useStateA(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    // Oturumun nerede saklanacağını (localStorage/sessionStorage) girişten
    // ÖNCE ayarlıyoruz — Supabase, oturumu bu depolara handleSubmit içinde
    // yazacak.
    setRememberMe(remember);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError('E-posta veya şifre hatalı.');
      setLoading(false);
    }
    // Başarılıysa onAuthStateChange AdminApp'te session'ı otomatik günceller
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--adm-bg)', fontFamily: 'var(--font-body)', padding: 20, boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 16 }}>SH</div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, color: 'var(--adm-text)', letterSpacing: '-0.02em' }}>Start-Hub</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Yönetim Paneli</div>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--adm-card)', border: '1px solid var(--adm-border-light)', borderRadius: 16, padding: 28 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, marginBottom: 4, color: 'var(--adm-text)', letterSpacing: '-0.01em' }}>Giriş Yap</div>
          <div style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 22 }}>Yetkili hesabınızla devam edin.</div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--adm-text-dim)', display: 'block', marginBottom: 6 }}>E-POSTA</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="ornek@starthub.com"
                style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid var(--adm-border-light)', background: 'var(--adm-bg)', fontSize: 14, color: 'var(--adm-text)', boxSizing: 'border-box', outline: 'none', fontFamily: 'var(--font-body)' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--adm-text-dim)', display: 'block', marginBottom: 6 }}>ŞİFRE</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" required placeholder="••••••••"
                style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid var(--adm-border-light)', background: 'var(--adm-bg)', fontSize: 14, color: 'var(--adm-text)', boxSizing: 'border-box', outline: 'none', fontFamily: 'var(--font-body)' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--adm-text-dim)', userSelect: 'none' }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#DC2626', cursor: 'pointer' }} />
              Beni hatırla
            </label>
            {error && <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px' }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ marginTop: 4, padding: '11px', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, letterSpacing: '-0.01em' }}>
              {loading ? 'Giriş yapılıyor…' : 'Giriş Yap →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── LOADING SCREEN ───────────────────────────────────────────────────
function AuthLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--adm-bg)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 16 }}>SH</div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────
function AdminApp() {
  const [session, setSession]         = useStateA(null);
  const [authLoading, setAuthLoading] = useStateA(true);
  const [page, setPage]               = useStateA(() => sessionStorage.getItem('sh_adm_page') || 'dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useStateA(false);
  const { trash, saveError } = useAdmin();

  // Tüm hook'lar koşulsuz — early return'lardan önce
  useEffectA(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffectA(() => { sessionStorage.setItem('sh_adm_page', page); }, [page]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (authLoading) return <AuthLoading />;
  if (!session)    return <LoginPage />;

  // Supabase session'dan kullanıcı bilgisi türet
  const email     = session.user.email || '';
  const initials  = email[0]?.toUpperCase() || 'A';
  const shortName = email.split('@')[0];

  const nav = [
    { id: 'dashboard',     label: 'Dashboard',       icon: 'dashboard' },
    { id: 'projects',      label: 'Projeler',         icon: 'rocket' },
    { id: 'posts',         label: 'Yazılar',          icon: 'layers' },
    { id: 'analytics',     label: 'Analitik',         icon: 'trendingUp' },
    { id: 'automation',    label: 'Otomasyon',        icon: 'zap' },
    { id: 'people',        label: 'Ekip & Mentörler', icon: 'users' },
    { id: 'sponsors',      label: 'Destekçiler',      icon: 'handshake' },
    { id: 'applications',  label: 'Başvurular',       icon: 'penEdit' },
    { id: 'settings',      label: 'Site Ayarları',    icon: 'settings' },
    { id: 'trash',         label: 'Son Silinenler',   icon: 'trash', badge: trash.length },
  ];

  const renderPage = () => {
    switch (page) {
      case 'projects':   return <ProjectsPage />;
      case 'posts':      return <ContentPage />;
      case 'analytics':  return <AnalyticsPage />;
      case 'automation': return <AutomationPage />;
      case 'people':     return <PeoplePage />;
      case 'sponsors':      return <SponsorsPage />;
      case 'applications':  return <ApplicationsPage />;
      case 'settings':      return <SettingsPage />;
      case 'trash':         return <TrashPage />;
      default:           return <DashboardPage />;
    }
  };

  return (
    <div className="adm-layout">
      {/* Mobil sidebar arkaplanı — dışarı tıklayınca kapanır */}
      {mobileNavOpen && <div className="adm-sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />}

      {/* Sidebar */}
      <aside className={`adm-sidebar ${mobileNavOpen ? 'adm-sidebar--open' : ''}`}>
        <div className="adm-sidebar__brand">
          <div className="adm-sidebar__logo">SH</div>
          <div>
            <div className="adm-sidebar__title">Start-Hub</div>
            <div className="adm-sidebar__sub">Admin Panel</div>
          </div>
        </div>

        <nav className="adm-sidebar__nav">
          <div className="adm-sidebar__section">İçerik Yönetimi</div>
          {nav.map(n => (
            <button key={n.id} className={`adm-sidebar__link ${page === n.id ? 'adm-sidebar__link--active' : ''}`} onClick={() => { setPage(n.id); setMobileNavOpen(false); }}>
              <AIcon name={n.icon} size={18} />
              <span>{n.label}</span>
              {n.badge > 0 && <span className="adm-sidebar__badge">{n.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="adm-sidebar__footer">
          <a className="adm-sidebar__link" href="/">
            <AIcon name="eye" size={18} />
            <span>Siteyi Görüntüle</span>
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="adm-main">
        <div className="adm-topbar">
          <div className="adm-breadcrumb">
            <button className="adm-mobile-menu-btn" onClick={() => setMobileNavOpen(true)} title="Menü" aria-label="Menü">
              <AIcon name="menu" size={20} />
            </button>
            <span className="adm-breadcrumb__root">Admin</span>
            <AIcon name="chevronRight" size={14} style={{ color: 'var(--adm-text-dim)' }} />
            <span className="adm-breadcrumb__current">{nav.find(n => n.id === page)?.label || 'Dashboard'}</span>
          </div>
          <div className="adm-topbar__right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--adm-text)' }}>{shortName}</div>
              <div style={{ fontSize: 11, color: 'var(--adm-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>admin</div>
            </div>
            <div className="adm-avatar" style={{ background: '#DC2626' }}>{initials}</div>
            <button onClick={handleLogout} title="Çıkış Yap"
              style={{ background: 'none', border: '1px solid var(--adm-border-light)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--adm-text-dim)', fontSize: 12, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <AIcon name="logout" size={14} /> Çıkış
            </button>
          </div>
        </div>
        <div className="adm-content">
          {saveError && (
            <div className="adm-savebar">
              <AIcon name="trash" size={15} /> Depolama dolu — görselleri küçültmeyi dene. Son değişiklik kaydedilememiş olabilir.
            </div>
          )}
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

function AdminRoot() {
  return (
    <AdminProvider>
      <AdminApp />
    </AdminProvider>
  );
}

export default AdminRoot;
