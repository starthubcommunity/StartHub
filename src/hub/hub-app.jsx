// hub-app.jsx — Kurucu Hattı: kabuk + auth kapısı + rol kapısı
// HUB_SPEC §5.1 (aynı Supabase istemcisi, aynı oturum) + §5.2 (açılış akışı).
// Router yok; sayfa geçişi sonraki adımlarda useState + sessionStorage ile.
import React from 'react';
import { useState, useEffect } from 'react';
import { supabase, setRememberMe } from '../lib/supabase';
import { AIcon } from '../admin/admin-ui';
import { HubStoreProvider } from './hub-store';
import { HubMemberContext, useHubMember } from './hub-member';
import { EMPTY_FILTERS } from './components/filter-bar';
import TodayPage from './pages/today';
import TablePage from './pages/table';
import BoardPage from './pages/board';
import TemplatesPage from './pages/templates';
import ImportPage from './pages/import';

// useHubMember() geriye dönük uyumluluk için buradan da dışa aktarılır
// (Adım 3 kabul kriteri bu isme atıf yapıyor).
export { useHubMember };

// ─── Paylaşılan stiller (admin AuthShell deseni, --adm-* token'ları) ──────
const inputStyle = { width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid var(--adm-border-light)', background: 'var(--adm-bg)', fontSize: 14, color: 'var(--adm-text)', boxSizing: 'border-box', outline: 'none', fontFamily: 'var(--font-body)' };
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--adm-text-dim)', display: 'block', marginBottom: 6 };
const btnPrimary = { marginTop: 4, padding: '11px', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', cursor: 'pointer' };
const btnGhost = { width: '100%', padding: '11px', borderRadius: 9, border: '1px solid var(--adm-border-light)', background: 'none', color: 'var(--adm-text)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const errorBox = { fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px' };

// ─── Ortak kart kabuğu ──────────────────────────────────────────────────
function AuthShell({ title, desc, children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--adm-bg)', fontFamily: 'var(--font-body)', padding: 20, boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 16 }}>SH</div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, color: 'var(--adm-text)', letterSpacing: '-0.02em' }}>Start-Hub</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Kurucu Hattı</div>
        </div>
        <div style={{ background: 'var(--adm-bg-card)', border: '1px solid var(--adm-border-light)', borderRadius: 16, padding: 28 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, marginBottom: 4, color: 'var(--adm-text)', letterSpacing: '-0.01em' }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 22 }}>{desc}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Şifre alanı (göster/gizle) ─────────────────────────────────────────
function EyeIcon({ off }) {
  return off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input value={value} onChange={onChange} type={show ? 'text' : 'password'} required placeholder={placeholder}
        style={{ ...inputStyle, paddingRight: 42 }} />
      <button type="button" onClick={() => setShow(s => !s)} title={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: 'var(--adm-text-dim)', display: 'flex', alignItems: 'center' }}>
        <EyeIcon off={show} />
      </button>
    </div>
  );
}

// ─── Şifremi unuttum ────────────────────────────────────────────────────
function ForgotPasswordPage({ onBack }) {
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/hub/`,
    });
    setLoading(false);
    if (err) { setError('Bağlantı gönderilemedi: ' + err.message); return; }
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell title="E-posta gönderildi" desc="Gelen kutunuzu kontrol edin.">
        <p style={{ fontSize: 14, color: 'var(--adm-text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
          <strong style={{ color: 'var(--adm-text)' }}>{email}</strong> adresine bir şifre sıfırlama
          bağlantısı gönderdik. Bağlantıya tıklayıp yeni şifrenizi belirleyebilirsiniz.
        </p>
        <button onClick={onBack} style={btnGhost}>Girişe dön</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Şifremi unuttum" desc="E-posta adresinize bir sıfırlama bağlantısı gönderelim.">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>E-POSTA</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="ornek@starthub.com" style={inputStyle} />
        </div>
        {error && <div style={errorBox}>{error}</div>}
        <button type="submit" disabled={loading} style={{ ...btnPrimary, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
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

// ─── Yeni şifre belirle (sıfırlama linkinden dönünce) ───────────────────
function SetNewPasswordPage({ onDone }) {
  const [password, setPassword]   = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

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
          <label style={labelStyle}>YENİ ŞİFRE</label>
          <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <div>
          <label style={labelStyle}>YENİ ŞİFRE (TEKRAR)</label>
          <PasswordInput value={password2} onChange={e => setPassword2(e.target.value)} placeholder="••••••••" />
        </div>
        {error && <div style={errorBox}>{error}</div>}
        <button type="submit" disabled={loading} style={{ ...btnPrimary, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Kaydediliyor…' : 'Şifreyi Kaydet'}
        </button>
      </form>
    </AuthShell>
  );
}

// ─── Giriş ──────────────────────────────────────────────────────────────
// Hub'da "Kayıt ol" bağlantısı YOKTUR (HUB_SPEC §5.1): yeni kullanıcı
// cofounder tarafından hub_members'a eklenir.
function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [remember, setRemember] = useState(true);
  const [forgot, setForgot]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    // Oturumun nerede saklanacağını (localStorage/sessionStorage) girişten
    // ÖNCE ayarlıyoruz — /admin/ ile aynı "Beni hatırla" davranışı.
    setRememberMe(remember);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError('E-posta veya şifre hatalı.');
      setLoading(false);
    }
    // Başarılıysa onAuthStateChange oturumu HubRoot'ta günceller.
  };

  if (forgot) return <ForgotPasswordPage onBack={() => setForgot(false)} />;

  return (
    <AuthShell title="Giriş Yap" desc="Yetkili hesabınızla devam edin.">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>E-POSTA</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="ornek@starthub.com" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>ŞİFRE</label>
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
        {error && <div style={errorBox}>{error}</div>}
        <button type="submit" disabled={loading} style={{ ...btnPrimary, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Giriş yapılıyor…' : 'Giriş Yap →'}
        </button>
      </form>
    </AuthShell>
  );
}

// ─── Yükleniyor ─────────────────────────────────────────────────────────
function AuthLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--adm-bg)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 16 }}>SH</div>
    </div>
  );
}

// ─── Erişim yok (oturum var, rol yok) ──────────────────────────────────
function NoAccessPage({ email, onLogout }) {
  return (
    <AuthShell title="Bu alana erişiminiz yok" desc="Hesabınız Kurucu Hattı'na tanımlı değil.">
      <p style={{ fontSize: 14, color: 'var(--adm-text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
        <strong style={{ color: 'var(--adm-text)' }}>{email}</strong> ile giriş yaptınız, ancak bu
        alana erişim yetkiniz bulunmuyor. Yetkilendirme için bir kurucuyla iletişime geçin.
      </p>
      <button onClick={onLogout} style={btnGhost}>Çıkış</button>
    </AuthShell>
  );
}

// ─── Uygulama kabuğu (rol geçtikten sonra) ─────────────────────────────
// Router yok: sayfa geçişi useState + sessionStorage (proje kuralı).
// Bu adımda yalnızca "Tablo" bağlı; diğer sayfalar sonraki adımlarda.
const NAV = [
  { id: 'today',     label: 'Bugün',      icon: 'dashboard', ready: true },
  { id: 'table',     label: 'Tablo',      icon: 'layers',    ready: true },
  { id: 'board',     label: 'Hat',        icon: 'trendingUp', ready: true },
  { id: 'templates', label: 'Şablonlar',  icon: 'penEdit',   ready: true },
  { id: 'import',    label: 'Yetenek avı', icon: 'upload',    ready: true },
  { id: 'metrics',   label: 'Metrikler',  icon: 'trendingUp', ready: false },
  { id: 'settings',  label: 'Ayarlar',    icon: 'settings',   ready: false },
];

function HubApp({ email, onLogout }) {
  const role = useHubMember();
  const [page, setPage] = useState(() => sessionStorage.getItem('sh_hub_page') || 'today');
  useEffect(() => { sessionStorage.setItem('sh_hub_page', page); }, [page]);

  // Tablo ve Hat aynı filtre durumunu paylaşır — sayfa değişince korunur (§8.3).
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });

  return (
    <div className="hub-layout">
      <aside className="hub-sidebar">
        <div className="hub-sidebar__brand">
          <div className="hub-sidebar__logo">SH</div>
          <div>
            <div className="hub-sidebar__title">Kurucu Hattı</div>
            <div className="hub-sidebar__sub">{role}</div>
          </div>
        </div>
        <nav className="hub-sidebar__nav">
          {NAV.map((n) => (
            <button key={n.id}
              className={`hub-sidebar__link ${page === n.id ? 'hub-sidebar__link--active' : ''}`}
              disabled={!n.ready}
              title={n.ready ? '' : 'Sonraki adımda'}
              onClick={() => n.ready && setPage(n.id)}>
              <AIcon name={n.icon} size={17} />
              <span>{n.label}</span>
              {!n.ready && <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6 }}>yakında</span>}
            </button>
          ))}
        </nav>
        <div className="hub-sidebar__foot">
          <button className="hub-sidebar__link" onClick={onLogout}>
            <AIcon name="logout" size={17} /><span>Çıkış</span>
          </button>
        </div>
      </aside>

      <div className="hub-main">
        <div className="hub-topbar">
          <span style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>
            {NAV.find((n) => n.id === page)?.label}
          </span>
          <span style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>{email}</span>
        </div>
        <div className="hub-content">
          {page === 'today' ? <TodayPage onGoto={setPage} />
            : page === 'table' ? <TablePage filters={filters} setFilters={setFilters} />
            : page === 'board' ? <BoardPage filters={filters} setFilters={setFilters} />
            : page === 'templates' ? <TemplatesPage />
            : page === 'import' ? <ImportPage />
            : <div className="adm-empty">Bu ekran sonraki adımda gelecek.</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Kök: açılış akışı (HUB_SPEC §5.2) ─────────────────────────────────
// 1) getSession → authLoading
// 2) oturum yok → LoginPage
// 3) oturum var → hub_role() RPC → roleLoading
// 4) rol null → NoAccessPage
// 5) rol var → HubApp
export default function HubRoot() {
  const [session, setSession]         = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [recovery, setRecovery]       = useState(false);
  const [role, setRole]               = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
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

  // Oturum değişince rolü BİR KEZ çek. localStorage'a yazılmaz — yetki
  // değişirse bir sonraki açılışta güncellenir.
  useEffect(() => {
    if (!session) { setRole(null); return; }
    let active = true;
    setRoleLoading(true);
    supabase.rpc('hub_role').then(({ data, error }) => {
      if (!active) return;
      setRole(error ? null : (data ?? null));
      setRoleLoading(false);
    });
    return () => { active = false; };
  }, [session?.user?.id]);

  const handleLogout = () => supabase.auth.signOut();

  if (authLoading) return <AuthLoading />;
  if (recovery)    return <SetNewPasswordPage onDone={() => setRecovery(false)} />;
  if (!session)    return <LoginPage />;
  if (roleLoading) return <AuthLoading />;
  if (!role)       return <NoAccessPage email={session.user.email || ''} onLogout={handleLogout} />;

  return (
    <HubMemberContext.Provider value={role}>
      <HubStoreProvider>
        <HubApp email={session.user.email || ''} onLogout={handleLogout} />
      </HubStoreProvider>
    </HubMemberContext.Provider>
  );
}
