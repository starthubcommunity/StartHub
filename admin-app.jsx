// admin-app.jsx — App shell, sidebar, routing
const { useState: useStateA, useEffect: useEffectA, useCallback: useCallbackA } = React;

// ─── DEMO CREDENTIALS ────────────────────────────────────────────────
const USERS = [
  { email: 'admin@starthub.com',     password: 'admin123', role: 'admin',     name: 'Admin',     avatar: 'A', color: '#DC2626' },
  { email: 'moderator@starthub.com', password: 'mod123',   role: 'moderator', name: 'Moderatör', avatar: 'M', color: '#7C3AED' },
];

// ─── LOGIN PAGE ───────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail]       = useStateA('');
  const [password, setPassword] = useStateA('');
  const [error, setError]       = useStateA('');
  const [loading, setLoading]   = useStateA(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const user = USERS.find(u => u.email === email.trim().toLowerCase() && u.password === password);
    if (user) { onLogin(user); }
    else { setError('E-posta veya şifre hatalı.'); setLoading(false); }
  };

  const fillDemo = (u) => { setEmail(u.email); setPassword(u.password); setError(''); };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--adm-bg)', fontFamily: 'var(--font-body)' }}>
      <div style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 24 }}>
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
            {error && <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ marginTop: 4, padding: '11px', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, letterSpacing: '-0.01em' }}>
              {loading ? 'Giriş yapılıyor…' : 'Giriş Yap →'}
            </button>
          </form>
        </div>

        {/* Demo credentials */}
        <div style={{ background: 'var(--adm-card)', border: '1px solid var(--adm-border-light)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--adm-text-dim)', marginBottom: 10 }}>DEMO HESAPLARI</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {USERS.map(u => (
              <button key={u.email} onClick={() => fillDemo(u)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--adm-border-light)', background: 'var(--adm-bg)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: u.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{u.avatar}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--adm-text)' }}>{u.name}
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: u.color + '1A', color: u.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{u.role}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{u.email}</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--adm-text-dim)' }}>Doldur →</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────
function AdminApp() {
  const [session, setSession] = useStateA(() => {
    try { return JSON.parse(sessionStorage.getItem('sh_adm_session')) || null; } catch { return null; }
  });
  const [page, setPage] = useStateA(() => sessionStorage.getItem('sh_adm_page') || 'dashboard');
  const { resetAll, trash, saveError } = useAdmin();

  const handleLogin = (user) => {
    sessionStorage.setItem('sh_adm_session', JSON.stringify(user));
    React.startTransition(() => setSession(user));
  };
  const handleLogout = () => {
    sessionStorage.removeItem('sh_adm_session');
    React.startTransition(() => setSession(null));
  };

  if (!session) return <LoginPage onLogin={handleLogin} />;

  const isAdmin = session.role === 'admin';

  useEffectA(() => { sessionStorage.setItem('sh_adm_page', page); }, [page]);

  const allNav = [
    { id: 'dashboard',  label: 'Dashboard',       icon: 'dashboard' },
    { id: 'projects',   label: 'Projeler',         icon: 'rocket' },
    { id: 'posts',      label: 'Yazılar',          icon: 'layers' },
    { id: 'automation', label: 'Otomasyon',        icon: 'zap',       adminOnly: true },
    { id: 'people',     label: 'Ekip & Mentörler', icon: 'users',     adminOnly: true },
    { id: 'sponsors',   label: 'Destekçiler',      icon: 'handshake', adminOnly: true },
    { id: 'trash',      label: 'Son Silinenler',   icon: 'trash',     adminOnly: true, badge: trash.length },
  ];
  const nav = allNav.filter(n => !n.adminOnly || isAdmin);

  const renderPage = () => {
    // Moderatör yetki sınırı
    if (!isAdmin && ['automation','people','sponsors','trash'].includes(page)) return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--adm-text-dim)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, color: 'var(--adm-text)' }}>Erişim Kısıtlandı</div>
        <div style={{ fontSize: 14, marginTop: 8 }}>Bu sayfayı görüntülemek için Admin yetkisi gereklidir.</div>
      </div>
    );
    switch(page) {
      case 'projects':   return <ProjectsPage />;
      case 'posts':      return <ContentPage />;
      case 'automation': return <AutomationPage />;
      case 'people':     return <PeoplePage />;
      case 'sponsors':   return <SponsorsPage />;
      case 'trash':      return <TrashPage />;
      default:           return <DashboardPage />;
    }
  };

  return (
    <div className="adm-layout">
      {/* Sidebar */}
      <aside className="adm-sidebar">
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
            <button key={n.id} className={`adm-sidebar__link ${page === n.id ? 'adm-sidebar__link--active' : ''}`} onClick={() => setPage(n.id)}>
              <AIcon name={n.icon} size={18} />
              <span>{n.label}</span>
              {n.badge > 0 && <span className="adm-sidebar__badge">{n.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="adm-sidebar__footer">
          {isAdmin && (
            <button className="adm-sidebar__link" onClick={resetAll} title="Tüm değişiklikleri sıfırla">
              <AIcon name="refresh" size={18} />
              <span>Sıfırla</span>
            </button>
          )}
          <a className="adm-sidebar__link" href="StartHub Website.html">
            <AIcon name="eye" size={18} />
            <span>Siteyi Görüntüle</span>
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="adm-main">
        <div className="adm-topbar">
          <div className="adm-breadcrumb">
            <span className="adm-breadcrumb__root">Admin</span>
            <AIcon name="chevronRight" size={14} style={{ color: 'var(--adm-text-dim)' }} />
            <span className="adm-breadcrumb__current">{nav.find(n => n.id === page)?.label || 'Dashboard'}</span>
          </div>
          <div className="adm-topbar__right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--adm-text)' }}>{session.name}</div>
              <div style={{ fontSize: 11, color: 'var(--adm-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{session.role}</div>
            </div>
            <div className="adm-avatar" style={{ background: session.color }}>{session.avatar}</div>
            <button onClick={handleLogout} title="Çıkış Yap" style={{ background: 'none', border: '1px solid var(--adm-border-light)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--adm-text-dim)', fontSize: 12, fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: 5 }}>
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

// Mount
function AdminRoot() {
  return (
    <AdminProvider>
      <AdminApp />
    </AdminProvider>
  );
}

const adminRootEl = document.getElementById('admin-root');
const adminReactRoot = ReactDOM.createRoot(adminRootEl);
adminReactRoot.render(<AdminRoot />);
