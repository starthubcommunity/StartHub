// admin-app.jsx — App shell, sidebar, routing
import React from 'react';
import { useState as useStateA, useEffect as useEffectA } from 'react';
import { AdminProvider, useAdmin } from './admin-store';
import { AIcon } from './admin-ui';
import { DashboardPage } from './admin-pages';
import { ContentPage } from './admin-pages3';
import { AutomationPage } from './admin-automation';
import { AnalyticsPage } from './admin-analytics';
import { PeoplePage, SponsorsPage, TrashPage } from './admin-pages2';
import { ApplicationsPage } from './admin-applications';
import { SettingsPage } from './admin-settings';
import PermissionsScreen from './permissions-screen';
import { supabase, setRememberMe } from '../lib/supabase';
import { PermsProvider, usePerms } from '../lib/use-perms';

// Ortak kart kabuğu — giriş / şifremi unuttum / e-posta gönderildi ekranları
// hepsi bu çerçeveyi paylaşır.
function AuthShell({ title, desc, children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--adm-bg)', fontFamily: 'var(--font-body)', padding: 20, boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 16 }}>SH</div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, color: 'var(--adm-text)', letterSpacing: '-0.02em' }}>Start-Hub</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Yönetim Paneli</div>
        </div>
        <div style={{ background: 'var(--adm-card)', border: '1px solid var(--adm-border-light)', borderRadius: 16, padding: 28 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, marginBottom: 4, color: 'var(--adm-text)', letterSpacing: '-0.01em' }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 22 }}>{desc}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

const adm_inputStyle = { width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid var(--adm-border-light)', background: 'var(--adm-bg)', fontSize: 14, color: 'var(--adm-text)', boxSizing: 'border-box', outline: 'none', fontFamily: 'var(--font-body)' };

// Göz ikonuyla göster/gizle yapılabilen şifre alanı — giriş ve şifre
// belirleme ekranlarında ortak kullanılıyor.
function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useStateA(false);
  return (
    <div style={{ position: 'relative' }}>
      <input value={value} onChange={onChange} type={show ? 'text' : 'password'} required placeholder={placeholder}
        style={{ ...adm_inputStyle, paddingRight: 42 }} />
      <button type="button" onClick={() => setShow(s => !s)} title={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: 'var(--adm-text-dim)', display: 'flex', alignItems: 'center' }}>
        <AIcon name={show ? 'eyeOff' : 'eye'} size={16} />
      </button>
    </div>
  );
}

// ─── ŞİFREMİ UNUTTUM ────────────────────────────────────────────────────
function ForgotPasswordPage({ onBack }) {
  const [email, setEmail]     = useStateA('');
  const [error, setError]     = useStateA('');
  const [loading, setLoading] = useStateA(false);
  const [sent, setSent]       = useStateA(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    // Markalı StartHub maili — Supabase'in sade maili değil. invite-member
    // 'recovery' linkini üretip send-mail ile gönderir. Yanıt her durumda aynı.
    try { await supabase.functions.invoke('invite-member', { body: { email: email.trim(), area: 'admin', mode: 'recovery' } }); }
    catch (_) { /* yanıt her durumda aynı */ }
    setLoading(false);
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell title="İşlem alındı" desc="">
        <p style={{ fontSize: 14, color: 'var(--adm-text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
          Eğer bu e-posta yetkiliyse, şifre belirleme bağlantısı gönderildi. Gelen kutunuzu kontrol edin.
        </p>
        <button onClick={onBack} style={{ width: '100%', padding: '11px', borderRadius: 9, border: '1px solid var(--adm-border-light)', background: 'none', color: 'var(--adm-text)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Girişe dön
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Şifremi unuttum" desc="E-posta adresinize bir sıfırlama bağlantısı gönderelim.">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--adm-text-dim)', display: 'block', marginBottom: 6 }}>E-POSTA</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="ornek@starthub.com" style={adm_inputStyle} />
        </div>
        {error && <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px' }}>{error}</div>}
        <button type="submit" disabled={loading}
          style={{ marginTop: 4, padding: '11px', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, letterSpacing: '-0.01em' }}>
          {loading ? 'Gönderiliyor…' : 'Sıfırlama Bağlantısı Gönder'}
        </button>
        <button type="button" onClick={onBack}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--adm-text-dim)', cursor: 'pointer', textAlign: 'center' }}>
          ← Girişe dön
        </button>
      </form>
    </AuthShell>
  );
}

// ─── YENİ ŞİFRE BELİRLE (sıfırlama linkinden dönünce) ──────────────────
function SetNewPasswordPage({ onDone }) {
  const [password, setPassword]   = useStateA('');
  const [password2, setPassword2] = useStateA('');
  const [error, setError]         = useStateA('');
  const [loading, setLoading]     = useStateA(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return; }
    if (password !== password2) { setError('Şifreler birbiriyle eşleşmiyor.'); return; }
    setLoading(true); setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError('Şifre güncellenemedi: ' + err.message); return; }
    onDone();
  };

  return (
    <AuthShell title="Yeni şifre belirle" desc="Hesabınız için yeni bir şifre girin.">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--adm-text-dim)', display: 'block', marginBottom: 6 }}>YENİ ŞİFRE</label>
          <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--adm-text-dim)', display: 'block', marginBottom: 6 }}>YENİ ŞİFRE (TEKRAR)</label>
          <PasswordInput value={password2} onChange={e => setPassword2(e.target.value)} placeholder="••••••••" />
        </div>
        {error && <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px' }}>{error}</div>}
        <button type="submit" disabled={loading}
          style={{ marginTop: 4, padding: '11px', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, letterSpacing: '-0.01em' }}>
          {loading ? 'Kaydediliyor…' : 'Şifreyi Kaydet'}
        </button>
      </form>
    </AuthShell>
  );
}

// ─── HESAP OLUŞTUR ────────────────────────────────────────────────────
// Kişi yalnızca e-postasını girer. invite-member yetkiyi kontrol eder;
// yetkiliyse şifre-belirleme maili gider. Ekran her zaman aynı mesajı verir
// (yetkili/yetkisiz ayırt edilemesin).
function CreateAccountPage({ onBack, area }) {
  const [email, setEmail]     = useStateA('');
  const [loading, setLoading] = useStateA(false);
  const [sent, setSent]       = useStateA(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await supabase.functions.invoke('invite-member', { body: { email: email.trim(), area } }); }
    catch (_) { /* yanıt her durumda aynı — hatayı da yutuyoruz */ }
    setLoading(false);
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell title="İşlem alındı" desc="">
        <p style={{ fontSize: 14, color: 'var(--adm-text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
          Eğer bu e-posta yetkiliyse, şifre belirleme bağlantısı gönderildi. Gelen kutunu kontrol et.
        </p>
        <button onClick={onBack} style={{ width: '100%', padding: '11px', borderRadius: 9, border: '1px solid var(--adm-border-light)', background: 'none', color: 'var(--adm-text)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Girişe dön
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Hesap oluştur" desc="Yetkili e-postanı gir; şifreni sen belirleyeceksin.">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--adm-text-dim)', display: 'block', marginBottom: 6 }}>E-POSTA</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="ornek@starthub.com" style={adm_inputStyle} />
        </div>
        <button type="submit" disabled={loading}
          style={{ marginTop: 4, padding: '11px', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Gönderiliyor…' : 'Bağlantı gönder'}
        </button>
        <button type="button" onClick={onBack}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--adm-text-dim)', cursor: 'pointer', textAlign: 'center' }}>
          ← Girişe dön
        </button>
      </form>
    </AuthShell>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────
function LoginPage() {
  const [email, setEmail]       = useStateA('');
  const [password, setPassword] = useStateA('');
  const [error, setError]       = useStateA('');
  const [loading, setLoading]   = useStateA(false);
  const [remember, setRemember] = useStateA(true);
  const [forgot, setForgot]     = useStateA(false);
  const [signup, setSignup]     = useStateA(false);

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

  if (forgot) return <ForgotPasswordPage onBack={() => setForgot(false)} />;
  if (signup) return <CreateAccountPage area="admin" onBack={() => setSignup(false)} />;

  return (
    <AuthShell title="Giriş Yap" desc="Yetkili hesabınızla devam edin.">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--adm-text-dim)', display: 'block', marginBottom: 6 }}>E-POSTA</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="ornek@starthub.com" style={adm_inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--adm-text-dim)', display: 'block', marginBottom: 6 }}>ŞİFRE</label>
          <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--adm-text-dim)', userSelect: 'none' }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#DC2626', cursor: 'pointer' }} />
            Beni hatırla
          </label>
          <button type="button" onClick={() => setForgot(true)}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 12.5, color: '#DC2626', fontWeight: 600, cursor: 'pointer' }}>
            Şifremi unuttum
          </button>
        </div>
        {error && <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px' }}>{error}</div>}
        <button type="submit" disabled={loading}
          style={{ marginTop: 4, padding: '11px', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, letterSpacing: '-0.01em' }}>
          {loading ? 'Giriş yapılıyor…' : 'Giriş Yap →'}
        </button>
        <button type="button" onClick={() => setSignup(true)}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--adm-text-dim)', cursor: 'pointer', textAlign: 'center' }}>
          Hesap oluştur
        </button>
      </form>
    </AuthShell>
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

// ─── ERİŞİM YOK ───────────────────────────────────────────────────────
function NoAccessPage({ email, onLogout }) {
  return (
    <AuthShell title="Bu alana erişiminiz yok" desc="Hesabınız yönetim paneline tanımlı değil.">
      <p style={{ fontSize: 14, color: 'var(--adm-text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
        <strong style={{ color: 'var(--adm-text)' }}>{email}</strong> ile giriş yaptınız, ancak bu alana
        erişim yetkiniz bulunmuyor. Yetkilendirme için bir yöneticiyle iletişime geçin.
      </p>
      <button onClick={onLogout} style={{ width: '100%', padding: '11px', borderRadius: 9, border: '1px solid var(--adm-border-light)', background: 'none', color: 'var(--adm-text)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
        Çıkış
      </button>
    </AuthShell>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────
function AdminApp() {
  const [session, setSession]         = useStateA(null);
  const [authLoading, setAuthLoading] = useStateA(true);
  const [recovery, setRecovery]       = useStateA(false); // şifre sıfırlama linkinden dönüldü mü
  const [role, setRole]               = useStateA(null);  // 'admin' | 'editor' | null
  const [roleLoading, setRoleLoading] = useStateA(false);
  const [page, setPage]               = useStateA(() => sessionStorage.getItem('sh_adm_page') || 'dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useStateA(false);
  const { trash, saveError } = useAdmin();
  const { can, loading: permsLoading } = usePerms();

  // Tüm hook'lar koşulsuz — early return'lardan önce
  useEffectA(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!active) return;
      setSession(s);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') { setRecovery(true); setSession(s); return; }
      if (event === 'SIGNED_OUT') { setSession(null); setRole(null); setRecovery(false); return; }
      setSession(s);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  // Rol her oturum açılışında bir kez RPC ile çekilir (hub §5.2 deseni).
  useEffectA(() => {
    if (!session) { setRole(null); return; }
    let active = true;
    setRoleLoading(true);
    supabase.rpc('admin_role').then(({ data, error }) => {
      if (!active) return;
      setRole(error ? null : (data ?? null));
      setRoleLoading(false);
    });
    return () => { active = false; };
  }, [session?.user?.id]);

  useEffectA(() => { sessionStorage.setItem('sh_adm_page', page); }, [page]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (authLoading) return <AuthLoading />;
  if (recovery)    return <SetNewPasswordPage onDone={() => setRecovery(false)} />;
  if (!session)    return <LoginPage />;
  if (roleLoading || permsLoading) return <AuthLoading />;
  if (!role)       return <NoAccessPage email={session.user.email || ''} onLogout={handleLogout} />;

  // Supabase session'dan kullanıcı bilgisi türet
  const email     = session.user.email || '';
  const initials  = email[0]?.toUpperCase() || 'A';
  const shortName = email.split('@')[0];

  // Menü YETKİYE göre çizilir (rol adına göre değil). Yetkisi olmayan öğe
  // menüde HİÇ görünmez. Asıl kapı RLS'tir; bu yalnızca kafa karışıklığını önler.
  const NAV = [
    { id: 'dashboard',     label: 'Dashboard',       icon: 'dashboard',  perm: null },
    { id: 'posts',         label: 'Yazılar',          icon: 'layers',    perm: 'posts.read' },
    { id: 'analytics',     label: 'Analitik',         icon: 'trendingUp', perm: 'analytics.read' },
    { id: 'automation',    label: 'Otomasyon',        icon: 'zap',       perm: 'automation.read' },
    { id: 'people',        label: 'Ekip & Mentörler', icon: 'users',     perm: 'people.read' },
    { id: 'sponsors',      label: 'Destekçiler',      icon: 'handshake', perm: 'sponsors.read' },
    { id: 'applications',  label: 'Başvurular',       icon: 'penEdit',   perm: 'applications.read' },
    { id: 'members',       label: 'Yetkiler',         icon: 'users',     perm: 'members.manage' },
    { id: 'settings',      label: 'Site Ayarları',    icon: 'settings',  perm: 'settings.write' },
    { id: 'trash',         label: 'Son Silinenler',   icon: 'trash', badge: trash.length, perm: 'trash.read' },
  ];
  const nav = NAV.filter(n => !n.perm || can(n.perm));
  const activePage = nav.some(n => n.id === page) ? page : (nav[0]?.id || 'dashboard');

  const renderPage = () => {
    switch (activePage) {
      case 'posts':      return <ContentPage />;
      case 'analytics':  return <AnalyticsPage />;
      case 'automation': return <AutomationPage />;
      case 'people':     return <PeoplePage />;
      case 'sponsors':      return <SponsorsPage />;
      case 'applications':  return <ApplicationsPage />;
      case 'members':       return <PermissionsScreen area="admin" />;
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
            <button key={n.id} className={`adm-sidebar__link ${activePage === n.id ? 'adm-sidebar__link--active' : ''}`} onClick={() => { setPage(n.id); setMobileNavOpen(false); }}>
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
            <span className="adm-breadcrumb__current">{nav.find(n => n.id === activePage)?.label || 'Dashboard'}</span>
          </div>
          <div className="adm-topbar__right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--adm-text)' }}>{shortName}</div>
              <div style={{ fontSize: 11, color: 'var(--adm-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{role}</div>
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
    <PermsProvider area="admin">
      <AdminProvider>
        <AdminApp />
      </AdminProvider>
    </PermsProvider>
  );
}

export default AdminRoot;
