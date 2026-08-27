// hub-app.jsx — Kurucu Hattı: kabuk + auth kapısı + rol kapısı
// HUB_SPEC §5.1 (aynı Supabase istemcisi, aynı oturum) + §5.2 (açılış akışı).
// Router yok; sayfa geçişi sonraki adımlarda useState + sessionStorage ile.
import React from 'react';
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase, setRememberMe } from '../lib/supabase';

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

// ─── Üyelik / rol context'i ────────────────────────────────────────────
// Rol her oturum açılışında BİR KEZ RPC ile çekilir, context'e konur;
// localStorage'a YAZILMAZ (HUB_SPEC §5.2). Arayüzde yalnızca menü
// görünürlüğü için kullanılır — gerçek kısıt RLS'tedir.
const HubMemberContext = createContext(null);

export function useHubMember() {
  return useContext(HubMemberContext);
}

// ─── Uygulama kabuğu (rol geçtikten sonra) ─────────────────────────────
// Adım 3: yalnızca kimlik + rol + çıkış. Sidebar ve sayfalar sonraki adımlarda.
function HubApp({ email, onLogout }) {
  const role = useHubMember();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--adm-bg)', fontFamily: 'var(--font-body)', color: 'var(--adm-text)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--adm-border)', background: 'var(--adm-bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--adm-red)', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>SH</div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15 }}>Kurucu Hattı</div>
            <div style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{email} · {role}</div>
          </div>
        </div>
        <button onClick={onLogout}
          style={{ background: 'none', border: '1px solid var(--adm-border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--adm-text-secondary)', fontSize: 13, fontFamily: 'var(--font-body)' }}>
          Çıkış
        </button>
      </header>
      <main style={{ padding: 40, maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, marginBottom: 8, letterSpacing: '-0.01em' }}>Hoş geldin</h1>
        <p style={{ color: 'var(--adm-text-secondary)' }}>
          Auth ve rol kapısı hazır. Rolün: <strong>{role}</strong>. Tablo, Hat ve Bugün
          ekranları sonraki adımlarda eklenecek.
        </p>
      </main>
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
      <HubApp email={session.user.email || ''} onLogout={handleLogout} />
    </HubMemberContext.Provider>
  );
}
